import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { FreightBroker, FreightInquiry, Product } from '../types';
import { addCategory, createFreightBroker, createFreightInquiry, getFreightBrokers, getFreightInquiries, loadData, updateFreightInquiry } from '../services/storage';
import { Plus, Upload } from 'lucide-react';

type FreightTab = 'orders' | 'inquiries' | 'brokers';
type CreateMode = 'inventory' | 'new';

type InquiryFormState = {
  source: 'inventory' | 'new';
  inventoryProductId?: string;
  productPhoto?: string;
  productName: string;
  variant: string;
  color: string;
  category: string;
  additionalProductDetails: string;
  orderType: 'in_house' | 'customer_trade';
  brokerId?: string;
  brokerName: string;
  brokerType: 'broker' | 'owner';
  piecesPerCartoon: number;
  numberOfCartoons: number;
  totalPieces: number;
  rmbPricePerPiece: number;
  totalRmb: number;
  inrPricePerPiece: number;
  totalInr: number;
  exchangeRate: number;
  cbmPerCartoon: number;
  totalCbm: number;
  cbmRate: number;
  cbmCost: number;
  cbmPerPiece: number;
  productCostPerPiece: number;
  productCostTotalAmount: number;
  sellingPrice: number;
  profitPerPiece: number;
  profitPercent: number;
};

const to2 = (n: number) => Number.isFinite(n) ? Number(n.toFixed(2)) : 0;

const emptyForm = (): InquiryFormState => ({
  source: 'new',
  productName: '',
  variant: '',
  color: '',
  category: '',
  additionalProductDetails: '',
  orderType: 'in_house',
  brokerName: '',
  brokerType: 'broker',
  piecesPerCartoon: 0,
  numberOfCartoons: 0,
  totalPieces: 0,
  rmbPricePerPiece: 0,
  totalRmb: 0,
  inrPricePerPiece: 0,
  totalInr: 0,
  exchangeRate: 1,
  cbmPerCartoon: 0,
  totalCbm: 0,
  cbmRate: 0,
  cbmCost: 0,
  cbmPerPiece: 0,
  productCostPerPiece: 0,
  productCostTotalAmount: 0,
  sellingPrice: 0,
  profitPerPiece: 0,
  profitPercent: 0,
});

const getInventoryVariant = (p: Product) => (p.description || '').trim();

const calcForm = (f: InquiryFormState) => {
  const totalPieces = Math.max(0, f.piecesPerCartoon) * Math.max(0, f.numberOfCartoons);
  const totalRmb = Math.max(0, f.rmbPricePerPiece) * totalPieces;
  const totalInr = Math.max(0, f.inrPricePerPiece) * totalPieces;
  const totalCbm = Math.max(0, f.cbmPerCartoon) * Math.max(0, f.numberOfCartoons);
  const cbmCost = totalCbm * Math.max(0, f.cbmRate);
  const cbmPerPiece = totalPieces > 0 ? cbmCost / totalPieces : 0;
  const productCostPerPiece = Math.max(0, f.inrPricePerPiece) + cbmPerPiece;
  const productCostTotalAmount = productCostPerPiece * totalPieces;
  const profitPerPiece = Math.max(0, f.sellingPrice) - productCostPerPiece;
  const profitPercent = productCostPerPiece > 0 ? (profitPerPiece / productCostPerPiece) * 100 : 0;

  return {
    ...f,
    brokerType: f.orderType === 'customer_trade' ? 'owner' : 'broker',
    brokerName: f.orderType === 'customer_trade' ? 'Owner' : f.brokerName,
    totalPieces: to2(totalPieces),
    totalRmb: to2(totalRmb),
    totalInr: to2(totalInr),
    totalCbm: to2(totalCbm),
    cbmCost: to2(cbmCost),
    cbmPerPiece: to2(cbmPerPiece),
    productCostPerPiece: to2(productCostPerPiece),
    productCostTotalAmount: to2(productCostTotalAmount),
    profitPerPiece: to2(profitPerPiece),
    profitPercent: to2(profitPercent),
  };
};

export default function FreightBooking() {
  const [activeTab, setActiveTab] = useState<FreightTab>('inquiries');
  const [products, setProducts] = useState<Product[]>([]);
  const [brokers, setBrokers] = useState<FreightBroker[]>([]);
  const [inquiries, setInquiries] = useState<FreightInquiry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [choiceMode, setChoiceMode] = useState<CreateMode | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const [selectedInquiry, setSelectedInquiry] = useState<FreightInquiry | null>(null);
  const [summaryInquiry, setSummaryInquiry] = useState<FreightInquiry | null>(null);
  const [editingInquiry, setEditingInquiry] = useState<FreightInquiry | null>(null);

  const [form, setForm] = useState<InquiryFormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categorySearch, setCategorySearch] = useState('');
  const [newBrokerName, setNewBrokerName] = useState('');
  const [manualInrOverride, setManualInrOverride] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);

  const refresh = () => {
    const data = loadData();
    setProducts(data.products || []);
    setCategories(data.categories || []);
    setInquiries(getFreightInquiries());
    setBrokers(getFreightBrokers());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('local-storage-update', refresh);
    return () => window.removeEventListener('local-storage-update', refresh);
  }, []);

  const filteredInquiries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inquiries;
    return inquiries.filter(item =>
      item.id.toLowerCase().includes(q)
      || item.productName.toLowerCase().includes(q)
      || (item.variant || '').toLowerCase().includes(q)
      || (item.color || '').toLowerCase().includes(q)
    );
  }, [inquiries, search]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => {
      const variant = getInventoryVariant(p).toLowerCase();
      return p.name.toLowerCase().includes(q) || variant.includes(q) || p.barcode.toLowerCase().includes(q);
    });
  }, [products, productSearch]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(c => c.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const patchForm = (patch: Partial<InquiryFormState>) => {
    setForm(prev => calcForm({ ...prev, ...patch }));
  };

  const patchRmbOrRate = (patch: Partial<InquiryFormState>) => {
    setForm(prev => {
      const next = { ...prev, ...patch };
      if (!manualInrOverride) next.inrPricePerPiece = to2(next.rmbPricePerPiece * next.exchangeRate);
      return calcForm(next);
    });
  };

  const setInrManual = (value: number) => {
    setManualInrOverride(true);
    patchForm({ inrPricePerPiece: value });
  };

  const uploadFileToDataUrl = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => patchForm({ productPhoto: typeof reader.result === 'string' ? reader.result : '' });
    reader.readAsDataURL(file);
  };

  const onDropImage: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setDraggingImage(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadFileToDataUrl(file);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.productName.trim()) next.productName = 'Product name is required';
    if (!form.orderType) next.orderType = 'Order type is required';
    if (form.piecesPerCartoon <= 0) next.piecesPerCartoon = 'Pieces per cartoon is required';
    if (form.numberOfCartoons <= 0) next.numberOfCartoons = 'Number of cartoons is required';
    if (form.rmbPricePerPiece <= 0 && form.inrPricePerPiece <= 0) next.pricing = 'Enter RMB or INR price per piece';
    if (form.sellingPrice <= 0) next.sellingPrice = 'Selling price is required';

    const nonNegativeFields = [
      form.piecesPerCartoon,
      form.numberOfCartoons,
      form.rmbPricePerPiece,
      form.inrPricePerPiece,
      form.exchangeRate,
      form.cbmPerCartoon,
      form.cbmRate,
      form.sellingPrice,
    ];
    if (nonNegativeFields.some(v => v < 0)) next.negative = 'Negative values are not allowed';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openCreate = () => {
    setChoiceMode(null);
    setProductSearch('');
    setShowChoiceModal(true);
  };

  const chooseCreateMode = (mode: CreateMode) => {
    setChoiceMode(mode);
    if (mode === 'new') {
      setShowChoiceModal(false);
      setForm(calcForm(emptyForm()));
      setManualInrOverride(false);
      setShowFormModal(true);
      setEditingInquiry(null);
    }
  };

  const useInventoryProduct = (product: Product) => {
    setShowChoiceModal(false);
    setEditingInquiry(null);
    setManualInrOverride(false);
    setForm(calcForm({
      ...emptyForm(),
      source: 'inventory',
      inventoryProductId: product.id,
      productPhoto: product.image,
      productName: product.name,
      variant: getInventoryVariant(product),
      color: '',
      category: product.category || '',
      additionalProductDetails: product.description || '',
    }));
    setShowFormModal(true);
  };

  const hasUnsavedChange = () => JSON.stringify(calcForm(form)) !== JSON.stringify(calcForm(emptyForm()));

  const requestExitForm = () => {
    if (hasUnsavedChange()) {
      setShowExitModal(true);
      return;
    }
    setShowFormModal(false);
  };

  const createBroker = async () => {
    if (!newBrokerName.trim()) return;
    const broker = await createFreightBroker({ name: newBrokerName.trim() });
    refresh();
    patchForm({ brokerId: broker.id, brokerName: broker.name });
    setNewBrokerName('');
  };

  const createCategoryFromSearch = () => {
    const value = categorySearch.trim();
    if (!value) return;
    addCategory(value);
    refresh();
    patchForm({ category: value });
    setCategorySearch('');
  };

  const saveInquiry = async (status: 'draft' | 'saved') => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const payload: FreightInquiry = {
      id: editingInquiry?.id || `inquiry-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      status,
      source: form.source,
      inventoryProductId: form.inventoryProductId,
      productPhoto: form.productPhoto,
      productName: form.productName.trim(),
      variant: form.variant.trim() || undefined,
      color: form.color.trim() || undefined,
      category: form.category.trim() || undefined,
      baseProductDetails: form.additionalProductDetails.trim() || undefined,
      orderType: form.orderType,
      brokerId: form.orderType === 'customer_trade' ? undefined : form.brokerId,
      brokerName: form.orderType === 'customer_trade' ? 'Owner' : (form.brokerName.trim() || undefined),
      brokerType: form.orderType === 'customer_trade' ? 'owner' : 'broker',
      totalPieces: form.totalPieces,
      piecesPerCartoon: form.piecesPerCartoon,
      numberOfCartoons: form.numberOfCartoons,
      rmbPricePerPiece: form.rmbPricePerPiece,
      totalRmb: form.totalRmb,
      inrPricePerPiece: form.inrPricePerPiece,
      totalInr: form.totalInr,
      exchangeRate: form.exchangeRate,
      freightPerCbm: 0,
      cbmPerCartoon: form.cbmPerCartoon,
      totalCbm: form.totalCbm,
      cbmRate: form.cbmRate,
      cbmCost: form.cbmCost,
      cbmPerPiece: form.cbmPerPiece,
      productCostPerPiece: form.productCostPerPiece,
      sellingPrice: form.sellingPrice,
      profitPerPiece: form.profitPerPiece,
      profitPercent: form.profitPercent,
      futureOrderId: editingInquiry?.futureOrderId,
      convertedAt: editingInquiry?.convertedAt,
      convertedBy: editingInquiry?.convertedBy,
      createdAt: editingInquiry?.createdAt || now,
      updatedAt: now,
      updatedBy: undefined,
    };

    if (editingInquiry) await updateFreightInquiry(payload);
    else await createFreightInquiry(payload);

    refresh();
    setSummaryInquiry(payload);
    setShowSummaryModal(true);
    setShowFormModal(false);
    setForm(calcForm(emptyForm()));
    setManualInrOverride(false);
    setErrors({});
  };

  const openDetails = (inquiry: FreightInquiry) => {
    setSelectedInquiry(inquiry);
    setShowDetailsModal(true);
  };

  const statusClass = (status: FreightInquiry['status']) => ({
    draft: 'bg-slate-100 text-slate-700',
    saved: 'bg-emerald-100 text-emerald-700',
    confirmed: 'bg-amber-100 text-amber-700',
    converted: 'bg-indigo-100 text-indigo-700',
  }[status]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Freight Booking</h1>
        <p className="text-sm text-muted-foreground">Create and manage freight inquiries.</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {([
          ['orders', 'Orders'],
          ['inquiries', 'Inquiries'],
          ['brokers', 'Brokers'],
        ] as Array<[FreightTab, string]>).map(([key, label]) => (
          <Button key={key} variant={activeTab === key ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab(key)}>{label}</Button>
        ))}
      </div>

      {activeTab !== 'inquiries' ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {activeTab === 'orders' ? 'Orders tab is reserved for future confirmed order flow.' : 'Brokers tab will be expanded next.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Inquiries</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
              <Input placeholder="Search by order ID, product name, invoice number" value={search} onChange={e => setSearch(e.target.value)} />
              <Button variant="outline">Filter</Button>
              <Button variant="outline">Sort</Button>
              <Button onClick={openCreate}>Create Inquiry</Button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-3 text-left font-medium">Product photo</th>
                    <th className="p-3 text-left font-medium">Product name</th>
                    <th className="p-3 text-left font-medium">Status of the order</th>
                    <th className="p-3 text-left font-medium">Variant/color</th>
                    <th className="p-3 text-left font-medium">Order type</th>
                    <th className="p-3 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredInquiries.length && <tr><td className="p-4 text-muted-foreground" colSpan={6}>No inquiries found.</td></tr>}
                  {filteredInquiries.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.productPhoto ? <img src={item.productPhoto} className="h-12 w-12 object-cover border rounded" /> : <div className="h-12 w-12 border rounded bg-muted" />}</td>
                      <td className="p-3 font-medium">{item.productName}</td>
                      <td className="p-3"><span className={`inline-block px-2 py-1 text-xs rounded ${statusClass(item.status)}`}>{item.status}</span></td>
                      <td className="p-3">{[item.variant, item.color].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="p-3">{item.orderType === 'in_house' ? 'In House Order (Own)' : 'Customer Order (Trade)'}</td>
                      <td className="p-3"><Button variant="outline" size="sm" onClick={() => openDetails(item)}>View Details</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showChoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setShowChoiceModal(false)}>
          <Card className="w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Create Inquiry</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => chooseCreateMode('inventory')}>Use Existing Inventory Product</Button>
                <Button variant="outline" onClick={() => chooseCreateMode('new')}>Create New Product Inquiry</Button>
              </div>

              {choiceMode === 'inventory' && (
                <div className="space-y-2">
                  <Input placeholder="Search product by name or variant" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                  <div className="max-h-64 overflow-auto border rounded">
                    {!filteredProducts.length && <div className="p-3 text-sm text-muted-foreground">No products found.</div>}
                    {filteredProducts.map(p => (
                      <button key={p.id} className="w-full text-left p-2 border-b hover:bg-muted/50 flex items-center gap-3" onClick={() => useInventoryProduct(p)}>
                        {p.image ? <img src={p.image} className="h-10 w-10 rounded border object-cover" /> : <div className="h-10 w-10 rounded border bg-muted" />}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">Variant: {getInventoryVariant(p) || '—'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4" onClick={requestExitForm}>
          <Card className="w-full max-w-6xl max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Create Inquiry</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Product details</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Product photo</Label>
                      <div
                        className={`mt-1 rounded-lg border-2 border-dashed p-4 text-sm ${draggingImage ? 'border-primary bg-primary/5' : 'border-border'}`}
                        onDragOver={e => { e.preventDefault(); setDraggingImage(true); }}
                        onDragLeave={() => setDraggingImage(false)}
                        onDrop={onDropImage}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50">
                            <Upload className="w-4 h-4" /> Add Photo
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadFileToDataUrl(file); }} />
                          </label>
                          <span className="text-muted-foreground">or drag & drop image here</span>
                          {form.productPhoto && <Button type="button" variant="outline" size="sm" onClick={() => patchForm({ productPhoto: undefined })}>Remove</Button>}
                        </div>
                        {form.productPhoto && <img src={form.productPhoto} className="mt-3 h-20 w-20 rounded border object-cover" />}
                      </div>
                    </div>

                    <div><Label>Product name</Label><Input value={form.productName} onChange={e => patchForm({ productName: e.target.value })} />{errors.productName && <p className="text-xs text-red-600">{errors.productName}</p>}</div>
                    <div><Label>Variant</Label><Input value={form.variant} onChange={e => patchForm({ variant: e.target.value })} /></div>
                    <div><Label>Color</Label><Input value={form.color} onChange={e => patchForm({ color: e.target.value })} /></div>
                    <div>
                      <Label>Category</Label>
                      <Input placeholder="Search category" value={categorySearch} onChange={e => setCategorySearch(e.target.value)} />
                      {!!categorySearch.trim() && !filteredCategories.some(c => c.toLowerCase() === categorySearch.trim().toLowerCase()) && (
                        <button type="button" className="mt-1 text-xs text-primary" onClick={createCategoryFromSearch}>Create "{categorySearch.trim()}"</button>
                      )}
                      {!!filteredCategories.length && (
                        <div className="mt-1 max-h-24 overflow-auto border rounded">
                          {filteredCategories.map(c => <button type="button" key={c} className="block w-full text-left px-2 py-1 text-sm hover:bg-muted/50" onClick={() => { patchForm({ category: c }); setCategorySearch(''); }}>{c}</button>)}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Selected: {form.category || '—'}</p>
                    </div>
                    <div className="sm:col-span-2"><Label>Additional product details</Label><Input value={form.additionalProductDetails} onChange={e => patchForm({ additionalProductDetails: e.target.value })} /></div>
                  </div>
                </section>

                <section className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Order details</h3>
                  <div>
                    <Label>Order type</Label>
                    <div className="mt-2 grid sm:grid-cols-2 gap-2 text-sm">
                      <label className={`border rounded p-2 cursor-pointer ${form.orderType === 'in_house' ? 'border-primary bg-primary/5' : ''}`}><input type="radio" className="mr-2" checked={form.orderType === 'in_house'} onChange={() => patchForm({ orderType: 'in_house' })} />In House Order (Own)</label>
                      <label className={`border rounded p-2 cursor-pointer ${form.orderType === 'customer_trade' ? 'border-primary bg-primary/5' : ''}`}><input type="radio" className="mr-2" checked={form.orderType === 'customer_trade'} onChange={() => patchForm({ orderType: 'customer_trade' })} />Customer Order (Trade)</label>
                    </div>
                    {errors.orderType && <p className="text-xs text-red-600">{errors.orderType}</p>}
                  </div>

                  {form.orderType === 'customer_trade' ? (
                    <div><Label>Broker</Label><Input value="Owner" readOnly /></div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Broker</Label>
                        <select className="h-10 w-full border rounded px-3 text-sm" value={form.brokerId || ''} onChange={e => {
                          const broker = brokers.find(b => b.id === e.target.value);
                          patchForm({ brokerId: broker?.id, brokerName: broker?.name || '' });
                        }}>
                          <option value="">Select broker</option>
                          {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Create new broker</Label>
                        <div className="flex gap-2"><Input value={newBrokerName} onChange={e => setNewBrokerName(e.target.value)} placeholder="Broker name" /><Button type="button" variant="outline" onClick={createBroker}><Plus className="w-4 h-4" /></Button></div>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <section className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Quantity</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label>Pieces per cartoon</Label><Input type="number" min="0" value={form.piecesPerCartoon} onChange={e => patchForm({ piecesPerCartoon: Number(e.target.value) || 0 })} />{errors.piecesPerCartoon && <p className="text-xs text-red-600">{errors.piecesPerCartoon}</p>}</div>
                  <div><Label>Number of cartoons</Label><Input type="number" min="0" value={form.numberOfCartoons} onChange={e => patchForm({ numberOfCartoons: Number(e.target.value) || 0 })} />{errors.numberOfCartoons && <p className="text-xs text-red-600">{errors.numberOfCartoons}</p>}</div>
                  <div><Label>Total pieces</Label><Input value={form.totalPieces} readOnly /></div>
                </div>
              </section>

              <section className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Pricing</h3>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="border rounded p-3 space-y-2">
                    <h4 className="font-medium text-sm">RMB Price</h4>
                    <div><Label>RMB per piece</Label><Input type="number" min="0" value={form.rmbPricePerPiece} onChange={e => patchRmbOrRate({ rmbPricePerPiece: Number(e.target.value) || 0 })} /></div>
                    <div><Label>Total RMB</Label><Input value={form.totalRmb} readOnly /></div>
                    <div className="text-xs text-muted-foreground">{form.rmbPricePerPiece} × {form.totalPieces} = {form.totalRmb} RMB</div>
                    <div><Label>Exchange rate (RMB → INR)</Label><Input type="number" min="0" value={form.exchangeRate} onChange={e => patchRmbOrRate({ exchangeRate: Number(e.target.value) || 0 })} /></div>
                  </div>

                  <div className="border rounded p-3 space-y-2">
                    <h4 className="font-medium text-sm">INR Price</h4>
                    <div><Label>INR per piece</Label><Input type="number" min="0" value={form.inrPricePerPiece} onChange={e => setInrManual(Number(e.target.value) || 0)} /></div>
                    <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setManualInrOverride(false); patchRmbOrRate({}); }}>Use Auto</Button><span className="text-xs text-muted-foreground self-center">{manualInrOverride ? 'Manual override' : 'Auto from RMB × rate'}</span></div>
                    <div><Label>Total INR</Label><Input value={form.totalInr} readOnly /></div>
                    <div className="text-xs text-muted-foreground">{form.inrPricePerPiece} × {form.totalPieces} = ₹{form.totalInr}</div>
                  </div>

                  <div className="border rounded p-3 space-y-2">
                    <h4 className="font-medium text-sm">CBM</h4>
                    <div><Label>CBM per cartoon</Label><Input type="number" min="0" value={form.cbmPerCartoon} onChange={e => patchForm({ cbmPerCartoon: Number(e.target.value) || 0 })} /></div>
                    <div><Label>Total CBM</Label><Input value={form.totalCbm} readOnly /></div>
                    <div><Label>CBM rate (₹ per CBM)</Label><Input type="number" min="0" value={form.cbmRate} onChange={e => patchForm({ cbmRate: Number(e.target.value) || 0 })} /></div>
                    <div><Label>CBM cost</Label><Input value={form.cbmCost} readOnly /></div>
                    <div><Label>CBM cost per piece</Label><Input value={form.cbmPerPiece} readOnly /></div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Product cost per piece</Label><Input value={form.productCostPerPiece} readOnly /></div>
                  <div><Label>Product cost total order amount</Label><Input value={form.productCostTotalAmount} readOnly /></div>
                </div>
                {(errors.pricing || errors.negative) && <p className="text-xs text-red-600">{errors.pricing || errors.negative}</p>}
              </section>

              <section className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Profit</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label>Selling price</Label><Input type="number" min="0" value={form.sellingPrice} onChange={e => patchForm({ sellingPrice: Number(e.target.value) || 0 })} />{errors.sellingPrice && <p className="text-xs text-red-600">{errors.sellingPrice}</p>}</div>
                  <div><Label>Profit per piece</Label><Input value={form.profitPerPiece} readOnly /></div>
                  <div><Label>Profit %</Label><Input value={form.profitPercent} readOnly /></div>
                </div>
                <p className="text-xs text-muted-foreground">Profit per piece = Selling price − Product cost per piece</p>
              </section>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => saveInquiry('draft')}>Save Draft</Button>
                <Button onClick={() => saveInquiry('saved')}>Save</Button>
                <Button variant="outline" onClick={requestExitForm}>Exit</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showExitModal && (
        <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle>Exit without saving?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Your work will not be saved.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExitModal(false)}>Continue Editing</Button>
                <Button variant="destructive" onClick={() => { setShowExitModal(false); setShowFormModal(false); setForm(calcForm(emptyForm())); setErrors({}); }}>Discard</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showSummaryModal && summaryInquiry && (
        <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowSummaryModal(false)}>
          <Card className="w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Inquiry Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
                <div>{summaryInquiry.productPhoto ? <img src={summaryInquiry.productPhoto} className="h-24 w-24 rounded border object-cover" /> : <div className="h-24 w-24 rounded border bg-muted" />}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Product:</span> {summaryInquiry.productName}</div>
                  <div><span className="text-muted-foreground">Inquiry ID:</span> {summaryInquiry.id}</div>
                  <div><span className="text-muted-foreground">Variant / Color:</span> {[summaryInquiry.variant, summaryInquiry.color].filter(Boolean).join(' / ') || '—'}</div>
                  <div><span className="text-muted-foreground">Order type:</span> {summaryInquiry.orderType === 'in_house' ? 'In House Order' : 'Customer Order'}</div>
                  <div><span className="text-muted-foreground">Broker:</span> {summaryInquiry.brokerName || 'Owner'}</div>
                  <div><span className="text-muted-foreground">Status:</span> {summaryInquiry.status}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total pieces</div><div className="font-semibold">{summaryInquiry.totalPieces}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total cartons</div><div className="font-semibold">{summaryInquiry.numberOfCartoons}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total RMB</div><div className="font-semibold">{summaryInquiry.totalRmb}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total INR</div><div className="font-semibold">₹{summaryInquiry.totalInr}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total CBM</div><div className="font-semibold">{summaryInquiry.totalCbm}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Cost per piece</div><div className="font-semibold">₹{summaryInquiry.productCostPerPiece}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Selling price</div><div className="font-semibold">₹{summaryInquiry.sellingPrice}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Profit %</div><div className="font-semibold">{summaryInquiry.profitPercent}%</div></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowSummaryModal(false); openDetails(summaryInquiry); }}>View Details</Button>
                <Button onClick={() => { setShowSummaryModal(false); openCreate(); }}>Create Another Inquiry</Button>
                <Button variant="outline" onClick={() => setShowSummaryModal(false)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDetailsModal && selectedInquiry && (
        <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowDetailsModal(false)}>
          <Card className="w-full max-w-5xl max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Inquiry Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <section className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Product Information</h3>
                <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]">
                  <div>{selectedInquiry.productPhoto ? <img src={selectedInquiry.productPhoto} className="h-20 w-20 rounded border object-cover" /> : <div className="h-20 w-20 rounded border bg-muted" />}</div>
                  <div><div className="text-muted-foreground">Product name</div><div>{selectedInquiry.productName}</div></div>
                  <div><div className="text-muted-foreground">Variant / Color</div><div>{[selectedInquiry.variant, selectedInquiry.color].filter(Boolean).join(' / ') || '—'}</div></div>
                </div>
              </section>

              <section className="border rounded-lg p-4 grid sm:grid-cols-3 gap-3">
                <div><div className="text-muted-foreground">Order Information</div><div>{selectedInquiry.orderType === 'in_house' ? 'In House Order (Own)' : 'Customer Order (Trade)'}</div></div>
                <div><div className="text-muted-foreground">Broker</div><div>{selectedInquiry.brokerName || 'Owner'}</div></div>
                <div><div className="text-muted-foreground">Status</div><div>{selectedInquiry.status}</div></div>
              </section>

              <section className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Quantity</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><div className="text-muted-foreground">Pieces per cartoon</div><div>{selectedInquiry.piecesPerCartoon}</div></div>
                  <div><div className="text-muted-foreground">Number of cartoons</div><div>{selectedInquiry.numberOfCartoons}</div></div>
                  <div><div className="text-muted-foreground">Total pieces</div><div>{selectedInquiry.totalPieces}</div></div>
                </div>
              </section>

              <section className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Pricing Breakdown</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><div className="text-muted-foreground">RMB per piece / Total</div><div>{selectedInquiry.rmbPricePerPiece} / {selectedInquiry.totalRmb}</div></div>
                  <div><div className="text-muted-foreground">INR per piece / Total</div><div>₹{selectedInquiry.inrPricePerPiece} / ₹{selectedInquiry.totalInr}</div></div>
                  <div><div className="text-muted-foreground">Exchange rate</div><div>{selectedInquiry.exchangeRate}</div></div>
                </div>
              </section>

              <section className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Freight / CBM</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><div className="text-muted-foreground">CBM per cartoon / Total CBM</div><div>{selectedInquiry.cbmPerCartoon} / {selectedInquiry.totalCbm}</div></div>
                  <div><div className="text-muted-foreground">CBM rate / CBM cost</div><div>₹{selectedInquiry.cbmRate} / ₹{selectedInquiry.cbmCost}</div></div>
                  <div><div className="text-muted-foreground">CBM per piece</div><div>₹{selectedInquiry.cbmPerPiece}</div></div>
                </div>
              </section>

              <section className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Profit Summary</h3>
                <div className="grid sm:grid-cols-4 gap-3">
                  <div><div className="text-muted-foreground">Product cost per piece</div><div>₹{selectedInquiry.productCostPerPiece}</div></div>
                  <div><div className="text-muted-foreground">Selling price</div><div>₹{selectedInquiry.sellingPrice}</div></div>
                  <div><div className="text-muted-foreground">Profit per piece</div><div>₹{selectedInquiry.profitPerPiece}</div></div>
                  <div><div className="text-muted-foreground">Profit %</div><div>{selectedInquiry.profitPercent}%</div></div>
                </div>
              </section>

              <div className="rounded border border-dashed p-3 text-muted-foreground">Future action placeholder: Convert to Confirmed Order.</div>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setShowDetailsModal(false)}>Close</Button></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
