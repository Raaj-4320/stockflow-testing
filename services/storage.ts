
import { Product, Transaction, AppState, Customer, StoreProfile, UpfrontOrder } from '../types';
import { db, auth, storage } from './firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';

let isCloudSynced = false;

const defaultProfile: StoreProfile = {
  storeName: "StockFlow Store",
  ownerName: "",
  gstin: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  state: "",
  defaultTaxRate: 0,
  defaultTaxLabel: 'None',
  invoiceFormat: 'standard'
};

const initialData: AppState = {
  products: [],
  transactions: [],
  categories: [],
  customers: [],
  profile: defaultProfile,
  upfrontOrders: []
};

let memoryState: AppState = { ...initialData };
let hasInitialSynced = false;
let unsubscribeSnapshot: any = null;

// Listen for auth state changes to trigger sync
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            hasInitialSynced = true;
            syncFromCloud();
        } else {
            // Clear state on logout
            memoryState = { ...initialData };
            hasInitialSynced = false;
            isCloudSynced = false;
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            window.dispatchEvent(new Event('local-storage-update'));
        }
    });
}

const syncFromCloud = async () => {
    if (!db || !auth) return;
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        // Use UID for strict isolation
        const docRef = doc(db, "stores", user.uid);
        
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
        }
        
        unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const cloudData = docSnap.data() as AppState;
                memoryState = {
                    ...initialData,
                    ...cloudData,
                    categories: cloudData.categories || [],
                    customers: cloudData.customers || [],
                    upfrontOrders: cloudData.upfrontOrders || [],
                    profile: { ...defaultProfile, ...(cloudData.profile || {}) }
                };
                if (memoryState.profile.defaultTaxRate === undefined) {
                    memoryState.profile.defaultTaxRate = 0;
                    memoryState.profile.defaultTaxLabel = 'None';
                }
                if (!memoryState.profile.invoiceFormat) {
                    memoryState.profile.invoiceFormat = 'standard';
                }
                isCloudSynced = true;
                window.dispatchEvent(new Event('local-storage-update'));
            } else {
                isCloudSynced = true;
                syncToCloud(memoryState).catch((error) => {
                    console.error('[firestore] Initial store sync failed', error);
                });
            }
        }, (error) => {
            console.error("Error listening to cloud data:", error);
        });
        
    } catch (e) { 
        console.error("Error setting up cloud listener:", e); 
    }
};

// Helper to recursively remove undefined values for Firestore compatibility
const sanitizeData = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(v => sanitizeData(v));
    }
    
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value !== undefined) {
                newObj[key] = sanitizeData(value);
            }
        }
    }
    return newObj;
};

const isDataUrlImage = (value: string | undefined): boolean => {
  return !!value && value.startsWith('data:image');
};

const STORAGE_UPLOAD_TIMEOUT_MS = 20000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const getStorageErrorMessage = (error: any): string => {
  const code = error?.code || '';

  if (code.includes('unauthorized') || code.includes('permission-denied')) {
    return 'Image upload failed due to storage permissions. Please contact support.';
  }

  if (code.includes('quota-exceeded')) {
    return 'Image upload failed because storage quota was exceeded. Please try again later.';
  }

  if (code.includes('retry-limit-exceeded') || code.includes('unknown')) {
    return 'Image upload failed. Please try again.';
  }

  if ((error?.message || '').toLowerCase().includes('timed out')) {
    return 'Image upload failed. Please try again.';
    return 'Image upload failed due to a network or CORS configuration issue. Please try again.';
  }

  return 'Image upload failed. Please try again.';
};

const uploadProductImageIfNeeded = async (
  product: Product,
  userId: string
): Promise<Product> => {
  if (!storage || !isDataUrlImage(product.image)) {
    return product;
  }

  try {
    const imageRef = ref(
      storage,
      `stores/${userId}/products/${product.id}-${Date.now()}.jpg`
    );

    console.debug('[storage] Product image upload start', {
      productId: product.id,
      path: imageRef.fullPath
    });

    const uploadResult = await withTimeout(
      uploadString(imageRef, product.image, 'data_url'),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Storage upload timed out'
    );

    const downloadURL = await withTimeout(
      getDownloadURL(uploadResult.ref),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Storage download URL retrieval timed out'
    );

    console.debug('[storage] Product image uploaded', {
      productId: product.id,
      fullPath: uploadResult.ref.fullPath,
      bucket: uploadResult.ref.bucket
    });

    return { ...product, image: downloadURL };
  } catch (error) {
    console.error('[storage] Product image upload failure', {
      productId: product.id,
      error
    });

    throw new Error(getStorageErrorMessage(error));
  }
};
const normalizeProductsForCloud = async (products: Product[], userId: string): Promise<Product[]> => {
  return Promise.all(products.map(product => uploadProductImageIfNeeded(product, userId)));
};

const syncToCloud = async (data: AppState) => {
    if (!db || !isCloudSynced || !auth) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
        const normalizedProducts = await normalizeProductsForCloud(data.products || [], user.uid);
        const normalizedState = { ...data, products: normalizedProducts };
        const cleanData = sanitizeData(normalizedState);
        await setDoc(doc(db, "stores", user.uid), cleanData, { merge: true });
        console.debug('[firestore] Store sync successful', {
          uid: user.uid,
          productsCount: normalizedProducts.length
        });
    } catch (e) {
        console.error('[firestore] Error syncing to cloud', {
          uid: user.uid,
          error: e
        });
        throw e;
    }
};

export const loadData = (): AppState => {
  if (db && !hasInitialSynced && navigator.onLine) {
      hasInitialSynced = true;
      syncFromCloud();
  }
  return memoryState;
};

export const getNextBarcode = (category: string): string => {
  const data = loadData();
  const categoryIndex = data.categories.indexOf(category);
  if (categoryIndex === -1) return `GEN-${Math.floor(1000 + Math.random() * 9000)}`;

  const startRange = categoryIndex * 500;
  const endRange = (categoryIndex + 1) * 500;

  const categoryProducts = data.products.filter(p => p.category === category && p.barcode.startsWith('GEN-'));
  
  let maxNum = startRange;
  categoryProducts.forEach(p => {
    const numStr = p.barcode.replace('GEN-', '');
    const num = parseInt(numStr);
    if (!isNaN(num) && num > maxNum && num < endRange) {
      maxNum = num;
    }
  });

  const nextNum = maxNum + 1;
  const formattedNum = nextNum.toString().padStart(3, '0');
  return `GEN-${formattedNum}`;
};

export const saveData = async (data: AppState, options?: { throwOnError?: boolean }) => {
  memoryState = data;
  window.dispatchEvent(new Event('local-storage-update'));

  if (!db) return;

  try {
    await syncToCloud(data);
  } catch (error) {
    if (options?.throwOnError) {
      throw error;
    }
    console.error('[firestore] saveData failed', error);
  }
};

export const updateStoreProfile = (profile: StoreProfile) => {
    const data = loadData();
    void saveData({ ...data, profile });
};

export const resetData = () => {
    memoryState = { ...initialData };
    window.dispatchEvent(new Event('local-storage-update'));
    if (db) {
      syncToCloud(memoryState).catch((error) => {
        console.error('[firestore] Reset sync failed', error);
      });
    }
    window.location.reload();
};

export const addProduct = async (product: Product): Promise<Product[]> => {
  const data = loadData();
  const userId = auth?.currentUser?.uid || 'local';
  const preparedProduct = await uploadProductImageIfNeeded({ ...product, totalSold: 0 }, userId);
  const newProducts = [...data.products, preparedProduct];
  await saveData({ ...data, products: newProducts }, { throwOnError: true });
  return newProducts;
};

export const updateProduct = async (product: Product): Promise<Product[]> => {
  const data = loadData();
  const userId = auth?.currentUser?.uid || 'local';
  const preparedProduct = await uploadProductImageIfNeeded(product, userId);
  const newProducts = data.products.map(p => p.id === product.id ? preparedProduct : p);
  await saveData({ ...data, products: newProducts }, { throwOnError: true });
  return newProducts;
};

export const deleteProduct = async (id: string): Promise<Product[]> => {
  const data = loadData();
  const newProducts = data.products.filter(p => p.id !== id);
  await saveData({ ...data, products: newProducts }, { throwOnError: true });
  return newProducts;
};

export const addCategory = (category: string): string[] => {
  const data = loadData();
  if (data.categories.some(c => c.toLowerCase() === category.toLowerCase())) {
      return data.categories;
  }
  const newCategories = [...data.categories, category];
  void saveData({ ...data, categories: newCategories });
  return newCategories;
};

export const deleteCategory = (category: string): AppState => {
  const data = loadData();
  const newCategories = data.categories.filter(c => c !== category);
  const deletedCategoryName = `deleted category ${category}`;
  
  // Add the "deleted category" to categories list if it doesn't exist
  if (!newCategories.includes(deletedCategoryName)) {
      newCategories.push(deletedCategoryName);
  }

  const newProducts = data.products.map(p => 
      p.category === category ? { ...p, category: deletedCategoryName } : p
  );

  const newState = { ...data, categories: newCategories, products: newProducts };
  void saveData(newState);
  return newState;
};

export const renameCategory = (oldName: string, newName: string): AppState => {
    const data = loadData();
    const newCategories = data.categories.map(c => c === oldName ? newName : c);
    const newProducts = data.products.map(p => 
        p.category === oldName ? { ...p, category: newName } : p
    );
    const newState = { ...data, categories: newCategories, products: newProducts };
    void saveData(newState);
    return newState;
};

export const addCustomer = (customer: Customer): Customer[] => {
    const data = loadData();
    const newCustomer = { ...customer, totalDue: 0 };
    const newCustomers = [...data.customers, newCustomer];
    void saveData({ ...data, customers: newCustomers });
    return newCustomers;
}

export const addUpfrontOrder = (order: UpfrontOrder): AppState => {
    const data = loadData();
    const newOrders = [...data.upfrontOrders, order];
    const newState = { ...data, upfrontOrders: newOrders };
    void saveData(newState);
    return newState;
};

export const updateUpfrontOrder = (order: UpfrontOrder): AppState => {
    const data = loadData();
    const newOrders = data.upfrontOrders.map(o => o.id === order.id ? order : o);
    const newState = { ...data, upfrontOrders: newOrders };
    void saveData(newState);
    return newState;
};

export const collectUpfrontPayment = (orderId: string, amount: number): AppState => {
    const data = loadData();
    const order = data.upfrontOrders.find(o => o.id === orderId);
    if (!order) return data;

    const newAdvance = order.advancePaid + amount;
    const newRemaining = order.totalCost - newAdvance;
    const newStatus = newRemaining <= 0 ? 'cleared' : 'unpaid';

    const updatedOrder: UpfrontOrder = {
        ...order,
        advancePaid: newAdvance,
        remainingAmount: Math.max(0, newRemaining),
        status: newStatus
    };

    const newOrders = data.upfrontOrders.map(o => o.id === orderId ? updatedOrder : o);
    const newState = { ...data, upfrontOrders: newOrders };
    void saveData(newState);
    return newState;
};

export const deleteCustomer = (id: string): Customer[] => {
    const data = loadData();
    const newCustomers = data.customers.filter(c => c.id !== id);
    void saveData({ ...data, customers: newCustomers });
    return newCustomers;
}

export const processTransaction = (transaction: Transaction): AppState => {
  const data = loadData();
  const newTransactions = [transaction, ...data.transactions];
  let newProducts = [...data.products];
  if (transaction.type !== 'payment') {
      newProducts = data.products.map(p => {
        const itemInCart = transaction.items.find(i => i.id === p.id);
        if (itemInCart) {
          const qty = itemInCart.quantity;
          if (transaction.type === 'sale') {
            return { ...p, stock: p.stock - qty, totalSold: (p.totalSold || 0) + qty };
          } else {
            return { ...p, stock: p.stock + qty, totalSold: Math.max(0, (p.totalSold || 0) - qty) };
          }
        }
        return p;
      });
  }
  let newCustomers = [...data.customers];
  if (transaction.customerId) {
      const customerIndex = newCustomers.findIndex(c => c.id === transaction.customerId);
      if (customerIndex >= 0) {
          const c = newCustomers[customerIndex];
          let newTotalSpend = c.totalSpend;
          let newTotalDue = c.totalDue;
          let newVisitCount = c.visitCount;
          let newLastVisit = c.lastVisit;
          const amount = Math.abs(transaction.total);
          if (transaction.type === 'sale') {
              newTotalSpend += amount;
              newVisitCount += 1;
              newLastVisit = new Date().toISOString();
              if (transaction.paymentMethod === 'Credit') newTotalDue += amount;
          } else if (transaction.type === 'return') {
              newTotalSpend -= amount;
              if (transaction.paymentMethod === 'Credit') newTotalDue -= amount;
          } else if (transaction.type === 'payment') {
              newTotalDue -= amount;
              newLastVisit = new Date().toISOString();
          }
          newCustomers[customerIndex] = { ...c, totalSpend: newTotalSpend, totalDue: newTotalDue, visitCount: newVisitCount, lastVisit: newLastVisit };
      }
  }
  const newState = { ...data, products: newProducts, transactions: newTransactions, customers: newCustomers };
  void saveData(newState);
  return newState;
};
