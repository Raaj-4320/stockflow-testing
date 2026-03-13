import * as XLSX from 'xlsx';
import { CartItem, Customer, Product, PurchaseOrder, PurchaseOrderLine, Transaction } from '../types';
import { addCategory, addCustomer, addProduct, createPurchaseOrder, loadData, processTransaction } from './storage';
import { NO_COLOR, NO_VARIANT } from './productVariants';

export type ImportIssue = { sheet: string; row: number; field: string; message: string };
export type ImportResult = { totalRows: number; importedRows: number; errors: ImportIssue[]; summary: string };

type Row = Record<string, any>;

const toStr = (v: any) => (v === null || v === undefined ? '' : String(v).trim());
const toNum = (v: any) => {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const readRows = async (file: File, sheetName: string): Promise<Row[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const name = workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
};

const writeTemplate = (sheetName: string, headers: string[], sample: any[]) => {
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${sheetName}_Import_Template.xlsx`);
};

export const downloadInventoryTemplate = () => writeTemplate(
  'Inventory',
  ['Barcode', 'Product Name', 'Category', 'Buy Price', 'Sell Price', 'Stock', 'HSN/SAC', 'Description'],
  ['SKU-1001', 'Cotton Shirt', 'Apparel', 250, 499, 20, '6109', 'Regular fit']
);

export const downloadCustomersTemplate = () => writeTemplate(
  'Customers',
  ['Name', 'Phone'],
  ['Ravi Kumar', '9876543210']
);

export const downloadTransactionsTemplate = () => writeTemplate(
  'Transactions',
  ['Transaction ID', 'Date', 'Type', 'Customer Phone', 'Payment Method', 'Product Barcode', 'Variant', 'Color', 'Quantity', 'Unit Sell Price', 'Item Discount', 'Tax Rate', 'Notes', 'Amount'],
  ['TX-1001', new Date().toISOString(), 'sale', '9876543210', 'Cash', 'SKU-1001', NO_VARIANT, NO_COLOR, 2, 499, 0, 0, 'imported sale', '']
);

export const downloadPurchaseTemplate = () => writeTemplate(
  'Purchase',
  ['Order ID', 'Order Date', 'Party Name', 'Notes', 'Source Type', 'Product Barcode', 'Product Name', 'Category', 'Variant', 'Color', 'Quantity', 'Unit Cost'],
  ['PO-1001', new Date().toISOString(), 'ABC Suppliers', 'monthly restock', 'inventory', 'SKU-1001', '', '', NO_VARIANT, NO_COLOR, 10, 220]
);

export const importInventoryFromFile = async (file: File): Promise<ImportResult> => {
  const rows = await readRows(file, 'Inventory');
  const data = loadData();
  const errors: ImportIssue[] = [];
  const existingBarcodes = new Set((data.products || []).map(p => toStr(p.barcode).toLowerCase()));
  const seen = new Set<string>();
  const valid: Product[] = [];

  rows.forEach((row, i) => {
    const rowNo = i + 2;
    const barcode = toStr(row['Barcode']);
    const name = toStr(row['Product Name']);
    const category = toStr(row['Category']);
    const buyPrice = toNum(row['Buy Price']);
    const sellPrice = toNum(row['Sell Price']);
    const stock = toNum(row['Stock']);
    if (!barcode) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Barcode', message: 'Barcode is required' });
    if (!name) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Product Name', message: 'Product Name is required' });
    if (!category) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Category', message: 'Category is required' });
    if (!Number.isFinite(buyPrice) || buyPrice < 0) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Buy Price', message: 'Buy Price must be a valid non-negative number' });
    if (!Number.isFinite(sellPrice) || sellPrice < 0) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Sell Price', message: 'Sell Price must be a valid non-negative number' });
    if (!Number.isFinite(stock) || stock < 0) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Stock', message: 'Stock must be a valid non-negative number' });

    const key = barcode.toLowerCase();
    if (key && seen.has(key)) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Barcode', message: 'Duplicate barcode in file' });
    if (key && existingBarcodes.has(key)) errors.push({ sheet: 'Inventory', row: rowNo, field: 'Barcode', message: 'Barcode already exists' });
    if (key) seen.add(key);

    if (!errors.some(e => e.row === rowNo)) {
      valid.push({
        id: `import-product-${Date.now()}-${i}`,
        barcode,
        name,
        category,
        buyPrice,
        sellPrice,
        stock,
        image: '',
        description: toStr(row['Description']),
        hsn: toStr(row['HSN/SAC']),
        totalSold: 0,
      });
    }
  });

  if (errors.length) return { totalRows: rows.length, importedRows: 0, errors, summary: 'Validation failed. No products imported.' };

  for (const product of valid) {
    if (product.category) addCategory(product.category);
    await addProduct(product);
  }

  return { totalRows: rows.length, importedRows: valid.length, errors: [], summary: `Imported ${valid.length} products successfully.` };
};

export const importCustomersFromFile = async (file: File): Promise<ImportResult> => {
  const rows = await readRows(file, 'Customers');
  const data = loadData();
  const errors: ImportIssue[] = [];
  const existingPhones = new Set((data.customers || []).map(c => toStr(c.phone).replace(/\D/g, '')));
  const seen = new Set<string>();
  const valid: Customer[] = [];

  rows.forEach((row, i) => {
    const rowNo = i + 2;
    const name = toStr(row['Name']);
    const phone = toStr(row['Phone']);
    const nPhone = phone.replace(/\D/g, '');
    if (!name) errors.push({ sheet: 'Customers', row: rowNo, field: 'Name', message: 'Name is required' });
    if (!phone) errors.push({ sheet: 'Customers', row: rowNo, field: 'Phone', message: 'Phone is required' });
    if (nPhone.length < 8) errors.push({ sheet: 'Customers', row: rowNo, field: 'Phone', message: 'Phone format is invalid' });
    if (nPhone && seen.has(nPhone)) errors.push({ sheet: 'Customers', row: rowNo, field: 'Phone', message: 'Duplicate phone in file' });
    if (nPhone && existingPhones.has(nPhone)) errors.push({ sheet: 'Customers', row: rowNo, field: 'Phone', message: 'Customer phone already exists' });
    if (nPhone) seen.add(nPhone);

    if (!errors.some(e => e.row === rowNo)) {
      valid.push({
        id: `import-customer-${Date.now()}-${i}`,
        name,
        phone,
        totalSpend: 0,
        totalDue: 0,
        visitCount: 0,
        lastVisit: new Date().toISOString(),
      });
    }
  });

  if (errors.length) return { totalRows: rows.length, importedRows: 0, errors, summary: 'Validation failed. No customers imported.' };

  valid.forEach(c => addCustomer(c));
  return { totalRows: rows.length, importedRows: valid.length, errors: [], summary: `Imported ${valid.length} customers successfully.` };
};

export const importTransactionsFromFile = async (file: File): Promise<ImportResult> => {
  const rows = await readRows(file, 'Transactions');
  const data = loadData();
  const errors: ImportIssue[] = [];
  const existingTxIds = new Set((data.transactions || []).map(t => t.id));
  const productsByBarcode = new Map((data.products || []).map(p => [toStr(p.barcode).toLowerCase(), p]));
  const customersByPhone = new Map((data.customers || []).map(c => [toStr(c.phone).replace(/\D/g, ''), c]));

  const grouped = new Map<string, Row[]>();
  rows.forEach((r, i) => {
    const txId = toStr(r['Transaction ID']);
    const rowNo = i + 2;
    if (!txId) {
      errors.push({ sheet: 'Transactions', row: rowNo, field: 'Transaction ID', message: 'Transaction ID is required' });
      return;
    }
    if (!grouped.has(txId)) grouped.set(txId, []);
    grouped.get(txId)!.push({ ...r, __rowNo: rowNo });
  });

  const importTx: Transaction[] = [];
  const stockByProduct = new Map((data.products || []).map(p => [p.id, p.stock || 0]));
  const soldByProduct = new Map((data.products || []).map(p => [p.id, p.totalSold || 0]));

  for (const [txId, txRows] of grouped.entries()) {
    const row0 = txRows[0];
    const date = toStr(row0['Date']);
    const type = toStr(row0['Type']).toLowerCase();
    const paymentMethod = toStr(row0['Payment Method']) || 'Cash';
    const taxRate = toNum(row0['Tax Rate']);
    const customerPhone = toStr(row0['Customer Phone']).replace(/\D/g, '');
    const customer = customerPhone ? customersByPhone.get(customerPhone) : undefined;

    if (existingTxIds.has(txId)) {
      errors.push({ sheet: 'Transactions', row: Number(row0.__rowNo), field: 'Transaction ID', message: 'Transaction ID already exists' });
      continue;
    }
    if (!date || Number.isNaN(Date.parse(date))) errors.push({ sheet: 'Transactions', row: Number(row0.__rowNo), field: 'Date', message: 'Date format is invalid' });
    if (!['sale', 'return', 'payment'].includes(type)) errors.push({ sheet: 'Transactions', row: Number(row0.__rowNo), field: 'Type', message: 'Type must be sale, return, or payment' });
    if (!['Cash', 'Credit', 'Online'].includes(paymentMethod)) errors.push({ sheet: 'Transactions', row: Number(row0.__rowNo), field: 'Payment Method', message: 'Payment Method is invalid' });
    if (paymentMethod === 'Credit' && !customer) errors.push({ sheet: 'Transactions', row: Number(row0.__rowNo), field: 'Customer Phone', message: 'Credit transactions require an existing customer phone' });

    if (type === 'payment') {
      const amount = toNum(row0['Amount']);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({ sheet: 'Transactions', row: Number(row0.__rowNo), field: 'Amount', message: 'Amount must be greater than zero for payment' });
        continue;
      }
      importTx.push({
        id: txId,
        date: new Date(date).toISOString(),
        type: 'payment',
        items: [],
        total: amount,
        customerId: customer?.id,
        customerName: customer?.name,
        paymentMethod: paymentMethod as Transaction['paymentMethod'],
        notes: toStr(row0['Notes']) || undefined,
      });
      continue;
    }

    const items: CartItem[] = [];
    let subtotal = 0;
    let discount = 0;
    txRows.forEach(r => {
      const rowNo = Number(r.__rowNo);
      const barcode = toStr(r['Product Barcode']).toLowerCase();
      const qty = toNum(r['Quantity']);
      const unitSell = toNum(r['Unit Sell Price']);
      const itemDiscount = Number.isFinite(toNum(r['Item Discount'])) ? toNum(r['Item Discount']) : 0;
      const variant = toStr(r['Variant']) || NO_VARIANT;
      const color = toStr(r['Color']) || NO_COLOR;
      const product = barcode ? productsByBarcode.get(barcode) : undefined;

      if (!barcode) errors.push({ sheet: 'Transactions', row: rowNo, field: 'Product Barcode', message: 'Product Barcode is required' });
      if (!product) errors.push({ sheet: 'Transactions', row: rowNo, field: 'Product Barcode', message: 'Product reference not found' });
      if (!Number.isFinite(qty) || qty <= 0) errors.push({ sheet: 'Transactions', row: rowNo, field: 'Quantity', message: 'Quantity must be greater than zero' });
      if (!Number.isFinite(unitSell) || unitSell < 0) errors.push({ sheet: 'Transactions', row: rowNo, field: 'Unit Sell Price', message: 'Unit Sell Price is invalid' });
      if (itemDiscount < 0) errors.push({ sheet: 'Transactions', row: rowNo, field: 'Item Discount', message: 'Item Discount cannot be negative' });

      if (!product || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitSell) || unitSell < 0) return;

      const currentStock = stockByProduct.get(product.id) || 0;
      const currentSold = soldByProduct.get(product.id) || 0;
      if (type === 'sale' && qty > currentStock) {
        errors.push({ sheet: 'Transactions', row: rowNo, field: 'Quantity', message: `Insufficient stock for barcode ${product.barcode}` });
      }
      if (type === 'return' && qty > currentSold) {
        errors.push({ sheet: 'Transactions', row: rowNo, field: 'Quantity', message: `Return quantity exceeds sold quantity for barcode ${product.barcode}` });
      }

      subtotal += unitSell * qty;
      discount += itemDiscount;
      items.push({
        ...product,
        quantity: qty,
        sellPrice: unitSell,
        buyPrice: Number.isFinite(product.buyPrice) ? product.buyPrice : 0,
        selectedVariant: variant,
        selectedColor: color,
        discountAmount: itemDiscount,
      });

      if (type === 'sale') {
        stockByProduct.set(product.id, currentStock - qty);
        soldByProduct.set(product.id, currentSold + qty);
      } else {
        stockByProduct.set(product.id, currentStock + qty);
        soldByProduct.set(product.id, Math.max(0, currentSold - qty));
      }
    });

    const finalTaxRate = Number.isFinite(taxRate) ? taxRate : 0;
    const taxable = subtotal - discount;
    const tax = taxable * (finalTaxRate / 100);
    const total = type === 'return' ? -(taxable + tax) : (taxable + tax);

    importTx.push({
      id: txId,
      date: new Date(date).toISOString(),
      type: type as Transaction['type'],
      customerId: customer?.id,
      customerName: customer?.name,
      paymentMethod: paymentMethod as Transaction['paymentMethod'],
      items,
      subtotal,
      discount,
      tax,
      taxRate: finalTaxRate,
      total,
      notes: toStr(row0['Notes']) || undefined,
    });
  }

  if (errors.length) return { totalRows: rows.length, importedRows: 0, errors, summary: 'Validation failed. No transactions imported.' };

  for (const tx of importTx) {
    processTransaction(tx);
  }

  return { totalRows: rows.length, importedRows: importTx.length, errors: [], summary: `Imported ${importTx.length} transactions successfully.` };
};

export const importPurchaseFromFile = async (file: File): Promise<ImportResult> => {
  const rows = await readRows(file, 'Purchase');
  const data = loadData();
  const errors: ImportIssue[] = [];
  const partiesByName = new Map((data.purchaseParties || []).map(p => [toStr(p.name).toLowerCase(), p]));
  const productsByBarcode = new Map((data.products || []).map(p => [toStr(p.barcode).toLowerCase(), p]));
  const existingOrderIds = new Set((data.purchaseOrders || []).map(o => o.id));

  const grouped = new Map<string, Row[]>();
  rows.forEach((r, i) => {
    const orderId = toStr(r['Order ID']);
    const rowNo = i + 2;
    if (!orderId) {
      errors.push({ sheet: 'Purchase', row: rowNo, field: 'Order ID', message: 'Order ID is required' });
      return;
    }
    if (!grouped.has(orderId)) grouped.set(orderId, []);
    grouped.get(orderId)!.push({ ...r, __rowNo: rowNo });
  });

  const orders: PurchaseOrder[] = [];
  for (const [orderId, orderRows] of grouped.entries()) {
    const row0 = orderRows[0];
    const rowNo0 = Number(row0.__rowNo);
    const partyName = toStr(row0['Party Name']);
    const party = partiesByName.get(partyName.toLowerCase());
    const orderDateRaw = toStr(row0['Order Date']);
    const orderDate = orderDateRaw && !Number.isNaN(Date.parse(orderDateRaw)) ? new Date(orderDateRaw).toISOString() : '';

    if (existingOrderIds.has(orderId)) errors.push({ sheet: 'Purchase', row: rowNo0, field: 'Order ID', message: 'Order ID already exists' });
    if (!partyName) errors.push({ sheet: 'Purchase', row: rowNo0, field: 'Party Name', message: 'Party Name is required' });
    if (partyName && !party) errors.push({ sheet: 'Purchase', row: rowNo0, field: 'Party Name', message: 'Party not found. Create party before import.' });
    if (!orderDate) errors.push({ sheet: 'Purchase', row: rowNo0, field: 'Order Date', message: 'Order Date format is invalid' });

    const lines: PurchaseOrderLine[] = [];
    orderRows.forEach(r => {
      const rowNo = Number(r.__rowNo);
      const sourceType = toStr(r['Source Type']).toLowerCase();
      const quantity = toNum(r['Quantity']);
      const unitCost = toNum(r['Unit Cost']);
      const barcode = toStr(r['Product Barcode']).toLowerCase();
      const product = barcode ? productsByBarcode.get(barcode) : undefined;
      const productName = toStr(r['Product Name']);

      if (!['inventory', 'new'].includes(sourceType)) errors.push({ sheet: 'Purchase', row: rowNo, field: 'Source Type', message: 'Source Type must be inventory or new' });
      if (!Number.isFinite(quantity) || quantity <= 0) errors.push({ sheet: 'Purchase', row: rowNo, field: 'Quantity', message: 'Quantity must be greater than zero' });
      if (!Number.isFinite(unitCost) || unitCost <= 0) errors.push({ sheet: 'Purchase', row: rowNo, field: 'Unit Cost', message: 'Unit Cost must be greater than zero' });
      if (sourceType === 'inventory' && !product) errors.push({ sheet: 'Purchase', row: rowNo, field: 'Product Barcode', message: 'Inventory product barcode not found' });
      if (sourceType === 'new' && !productName) errors.push({ sheet: 'Purchase', row: rowNo, field: 'Product Name', message: 'Product Name is required for new source type' });

      if (!errors.some(e => e.row === rowNo)) {
        lines.push({
          id: `${orderId}-${rowNo}`,
          sourceType: sourceType as 'inventory' | 'new',
          productId: sourceType === 'inventory' ? product?.id : undefined,
          productName: sourceType === 'inventory' ? (product?.name || '') : productName,
          category: sourceType === 'inventory' ? product?.category : toStr(r['Category']) || undefined,
          image: sourceType === 'inventory' ? product?.image : undefined,
          variant: toStr(r['Variant']) || undefined,
          color: toStr(r['Color']) || undefined,
          quantity,
          unitCost,
          totalCost: quantity * unitCost,
        });
      }
    });

    if (!errors.some(e => orderRows.some(r => Number(r.__rowNo) === e.row))) {
      const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0);
      const totalAmount = lines.reduce((s, l) => s + l.totalCost, 0);
      const now = new Date().toISOString();
      orders.push({
        id: orderId,
        partyId: party!.id,
        partyName: party!.name,
        partyPhone: party!.phone,
        partyGst: party!.gst,
        partyLocation: party!.location,
        status: 'ordered',
        orderDate,
        notes: toStr(row0['Notes']) || undefined,
        lines,
        totalQuantity,
        totalAmount,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (errors.length) return { totalRows: rows.length, importedRows: 0, errors, summary: 'Validation failed. No purchase orders imported.' };

  for (const order of orders) await createPurchaseOrder(order);
  return { totalRows: rows.length, importedRows: orders.length, errors: [], summary: `Imported ${orders.length} purchase orders successfully.` };
};
