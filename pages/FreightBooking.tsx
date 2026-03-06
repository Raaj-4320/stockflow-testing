import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { FreightBroker, FreightInquiry, Product } from '../types';
import { createFreightBroker, createFreightInquiry, getFreightBrokers, getFreightInquiries, loadData, updateFreightInquiry } from '../services/storage';

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
  baseProductDetails: string;
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
  freightPerCbm: number;
  cbmPerCartoon: number;
  totalCbm: number;
  cbmRate: number;
  cbmCost: number;
  cbmPerPiece: number;
  productCostPerPiece: number;
  sellingPrice: number;
  profitPerPiece: number;
  profitPercent: number;
};

const emptyForm = (): InquiryFormState => ({
  source: 'new',
  productName: '',
  variant: '',
  color: '',
  category: '',
  baseProductDetails: '',
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
  freightPerCbm: 0,
  cbmPerCartoon: 0,
  totalCbm: 0,
  cbmRate: 0,
  cbmCost: 0,
  cbmPerPiece: 0,
  productCostPerPiece: 0,
  sellingPrice: 0,
  profitPerPiece: 0,
  profitPercent: 0,
});

const to2 = (n: number) => Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
const calcForm = (f: InquiryFormState): InquiryFormState => {
  const totalPieces = Math.max(0, f.piecesPerCartoon) * Math.max(0, f.numberOfCartoons);
  const totalRmb = Math.max(0, f.rmbPricePerPiece) * totalPieces;
  const totalInr = Math.max(0, f.inrPricePerPiece) * totalPieces;
  const totalCbm = Math.max(0, f.cbmPerCartoon) * Math.max(0, f.numberOfCartoons);
  const cbmCost = totalCbm * Math.max(0, f.cbmRate);
  const cbmPerPiece = totalPieces > 0 ? cbmCost / totalPieces : 0;
  const productCostPerPiece = Math.max(0, f.inrPricePerPiece) + cbmPerPiece;
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
    profitPerPiece: to2(profitPerPiece),
    profitPercent: to2(profitPercent),
  };
};

export default function FreightBooking() {
  const [activeTab, setActiveTab] = useState<FreightTab>('inquiries');
  const [products, setProducts] = useState<Product[]>([]);
  const [brokers, setBrokers] = useState<FreightBroker[]>([]);
  const [inquiries, setInquiries] = useState<FreightInquiry[]>([]);
  const [q, setQ] = useState('');

  const [isChoiceOpen, setIsChoiceOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editing, setEditing] = useState<FreightInquiry | null>(null);
  const [summaryInquiry, setSummaryInquiry] = useState<FreightInquiry | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<FreightInquiry | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState<InquiryFormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState('');

  const refresh = () => {
    setProducts(loadData().products || []);
    setBrokers(getFreightBrokers());
    setInquiries(getFreightInquiries());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('local-storage-update', refresh);
    return () => window.removeEventListener('local-storage-update', refresh);
  }, []);

  const filteredInquiries = useMemo(() => {
    const x = q.trim().toLowerCase();
    if (!x) return inquiries;
    return inquiries.filter(i => (
      i.id.toLowerCase().includes(x)
      || i.productName.toLowerCase().includes(x)
      || (i.inventoryProductId || '').toLowerCase().includes(x)
    ));
  }, [q, inquiries]);

  const selectableProducts = useMemo(() => {
    const x = productSearch.trim().toLowerCase();
    if (!x) return products;
    return products.filter(p => p.name.toLowerCase().includes(x) || p.barcode.toLowerCase().includes(x));
  }, [productSearch, products]);

  const patchForm = (patch: Partial<InquiryFormState>) => setForm(prev => calcForm({ ...prev, ...patch }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.productName.trim()) next.productName = 'Product name is required';
    if (!form.orderType) next.orderType = 'Order type is required';
    if (form.piecesPerCartoon <= 0) next.piecesPerCartoon = 'Pieces per cartoon is required';
    if (form.numberOfCartoons <= 0) next.numberOfCartoons = 'Number of cartoons is required';
    if (form.rmbPricePerPiece <= 0 && form.inrPricePerPiece <= 0) next.price = 'Enter RMB or INR price per piece';
    if (form.sellingPrice <= 0) next.sellingPrice = 'Selling price is required';
    const hasNegative = [form.piecesPerCartoon, form.numberOfCartoons, form.rmbPricePerPiece, form.inrPricePerPiece, form.sellingPrice, form.cbmPerCartoon, form.cbmRate].some(v => v < 0);
    if (hasNegative) next.negative = 'Negative values are not allowed';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openCreateChoice = () => {
    setCreateMode(null);
    setProductSearch('');
    setErrors({});
    setIsChoiceOpen(true);
  };

  const handleChooseMode = (mode: CreateMode) => {
    setCreateMode(mode);
    setIsChoiceOpen(false);
    if (mode === 'new') {
      setForm(calcForm(emptyForm()));
      setEditing(null);
      setIsFormOpen(true);
    }
  };

  const selectInventoryProduct = (p: Product) => {
    setForm(calcForm({
      ...emptyForm(),
      source: 'inventory',
      inventoryProductId: p.id,
      productPhoto: p.image,
      productName: p.name,
      category: p.category || '',
      baseProductDetails: p.description || '',
    }));
    setEditing(null);
    setIsFormOpen(true);
    setIsChoiceOpen(false);
  };

  const hasUnsavedInput = () => JSON.stringify(calcForm(form)) !== JSON.stringify(calcForm(emptyForm()));

  const closeForm = () => {
    if (hasUnsavedInput()) {
      setConfirmExitOpen(true);
      return;
    }
    setIsFormOpen(false);
  };

  const saveInquiry = async (status: 'draft' | 'saved' = 'saved') => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const payload: FreightInquiry = {
      id: editing?.id || `inquiry-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      status,
      source: form.source,
      inventoryProductId: form.inventoryProductId,
      productPhoto: form.productPhoto,
      productName: form.productName.trim(),
      variant: form.variant.trim() || undefined,
      color: form.color.trim() || undefined,
      category: form.category.trim() || undefined,
      baseProductDetails: form.baseProductDetails.trim() || undefined,
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
      freightPerCbm: form.freightPerCbm,
      cbmPerCartoon: form.cbmPerCartoon,
      totalCbm: form.totalCbm,
      cbmRate: form.cbmRate,
      cbmCost: form.cbmCost,
      cbmPerPiece: form.cbmPerPiece,
      productCostPerPiece: form.productCostPerPiece,
      sellingPrice: form.sellingPrice,
      profitPerPiece: form.profitPerPiece,
      profitPercent: form.profitPercent,
      futureOrderId: editing?.futureOrderId,
      convertedAt: editing?.convertedAt,
      convertedBy: editing?.convertedBy,
      createdAt: editing?.createdAt || now,
      updatedAt: now,
    };

    if (editing) await updateFreightInquiry(payload);
    else await createFreightInquiry(payload);

    refresh();
    setSummaryInquiry(payload);
    setIsSummaryOpen(true);
    setIsFormOpen(false);
    setForm(calcForm(emptyForm()));
    setEditing(null);
    setErrors({});
  };

  const openDetails = (inq: FreightInquiry) => {
    setSelectedInquiry(inq);
    setIsDetailsOpen(true);
  };

  const createBroker = async () => {
    const name = newBrokerName.trim();
    if (!name) return;
    const broker = await createFreightBroker({ name });
    refresh();
    patchForm({ brokerId: broker.id, brokerName: broker.name });
    setNewBrokerName('');
  };

  const statusTone = (status: FreightInquiry['status']) => ({
    draft: 'bg-slate-100 text-slate-700',
    saved: 'bg-emerald-100 text-emerald-700',
    confirmed: 'bg-amber-100 text-amber-700',
    converted: 'bg-indigo-100 text-indigo-700',
  }[status]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Freight Booking</h1>
        <p className="text-sm text-muted-foreground">Manage freight inquiries and keep structure ready for confirmed order conversion.</p>
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
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">{activeTab === 'orders' ? 'Orders tab is reserved for future confirmed order flow.' : 'Brokers tab will be expanded in the next step.'}</CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Inquiries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
              <Input placeholder="Search by order ID, product name, invoice number" value={q} onChange={e => setQ(e.target.value)} />
              <Button variant="outline">Filter</Button>
              <Button variant="outline">Sort</Button>
              <Button onClick={openCreateChoice}>Create Inquiry</Button>
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
                  {filteredInquiries.length === 0 ? (
                    <tr><td className="p-4 text-muted-foreground" colSpan={6}>No inquiries found.</td></tr>
                  ) : filteredInquiries.map(inq => (
                    <tr key={inq.id} className="border-t">
                      <td className="p-3">{inq.productPhoto ? <img src={inq.productPhoto} className="h-12 w-12 object-cover rounded border" /> : <div className="h-12 w-12 rounded border bg-muted" />}</td>
                      <td className="p-3 font-medium">{inq.productName}</td>
                      <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${statusTone(inq.status)}`}>{inq.status}</span></td>
                      <td className="p-3">{[inq.variant, inq.color].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="p-3">{inq.orderType === 'in_house' ? 'In House Order (Own)' : 'Customer Order (Trade)'}</td>
                      <td className="p-3"><Button size="sm" variant="outline" onClick={() => openDetails(inq)}>View Details</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {isChoiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setIsChoiceOpen(false)}>
          <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Create Inquiry</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => handleChooseMode('inventory')}>Use Existing Inventory Product</Button>
                <Button variant="outline" onClick={() => handleChooseMode('new')}>Create New Product Inquiry</Button>
              </div>

              {createMode === 'inventory' && (
                <div className="space-y-2">
                  <Input placeholder="Search inventory product" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                  <div className="max-h-64 overflow-auto border rounded">
                    {selectableProducts.map(p => (
                      <button key={p.id} className="w-full text-left p-2 border-b hover:bg-muted/50" onClick={() => selectInventoryProduct(p)}>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.category} • {p.barcode}</div>
                      </button>
                    ))}
                    {!selectableProducts.length && <div className="p-3 text-sm text-muted-foreground">No products.</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={closeForm}>
          <Card className="w-full max-w-5xl max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Create Inquiry</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Product details</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div><Label>Product photo upload (URL)</Label><Input value={form.productPhoto || ''} onChange={e => patchForm({ productPhoto: e.target.value })} placeholder="Paste image URL or data URL" /></div>
                  <div><Label>Product name</Label><Input value={form.productName} onChange={e => patchForm({ productName: e.target.value })} />{errors.productName && <p className="text-xs text-red-600">{errors.productName}</p>}</div>
                  <div><Label>Variant</Label><Input value={form.variant} onChange={e => patchForm({ variant: e.target.value })} /></div>
                  <div><Label>Color</Label><Input value={form.color} onChange={e => patchForm({ color: e.target.value })} /></div>
                  <div><Label>Category</Label><Input value={form.category} onChange={e => patchForm({ category: e.target.value })} /></div>
                  <div><Label>Base product details</Label><Input value={form.baseProductDetails} onChange={e => patchForm({ baseProductDetails: e.target.value })} /></div>
                </div>
                {form.productPhoto && <img src={form.productPhoto} className="h-20 w-20 object-cover border rounded" />}
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Order details</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Order type</Label>
                    <select className="h-10 w-full border rounded px-3 text-sm" value={form.orderType} onChange={e => patchForm({ orderType: e.target.value as InquiryFormState['orderType'] })}>
                      <option value="in_house">In House Order (Own)</option>
                      <option value="customer_trade">Customer Order (Trade)</option>
                    </select>
                    {errors.orderType && <p className="text-xs text-red-600">{errors.orderType}</p>}
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Broker logic</h3>
                {form.orderType === 'customer_trade' ? (
                  <div><Label>Broker</Label><Input value="Owner" readOnly /></div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Broker selection</Label>
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
                      <div className="flex gap-2"><Input value={newBrokerName} onChange={e => setNewBrokerName(e.target.value)} placeholder="Broker name" /><Button type="button" variant="outline" onClick={createBroker}>Add</Button></div>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Quantity</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><Label>Pieces per cartoon</Label><Input type="number" min="0" value={form.piecesPerCartoon} onChange={e => patchForm({ piecesPerCartoon: Number(e.target.value) || 0 })} />{errors.piecesPerCartoon && <p className="text-xs text-red-600">{errors.piecesPerCartoon}</p>}</div>
                  <div><Label>Number of cartoons</Label><Input type="number" min="0" value={form.numberOfCartoons} onChange={e => patchForm({ numberOfCartoons: Number(e.target.value) || 0 })} />{errors.numberOfCartoons && <p className="text-xs text-red-600">{errors.numberOfCartoons}</p>}</div>
                  <div><Label>Total pieces</Label><Input value={form.totalPieces} readOnly /></div>
                  <div><Label>Freight / CBM</Label><Input type="number" min="0" value={form.freightPerCbm} onChange={e => patchForm({ freightPerCbm: Number(e.target.value) || 0 })} /></div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Pricing & CBM</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><Label>RMB price per piece</Label><Input type="number" min="0" value={form.rmbPricePerPiece} onChange={e => patchForm({ rmbPricePerPiece: Number(e.target.value) || 0 })} /></div>
                  <div><Label>Total RMB</Label><Input value={form.totalRmb} readOnly /></div>
                  <div><Label>INR price per piece</Label><Input type="number" min="0" value={form.inrPricePerPiece} onChange={e => patchForm({ inrPricePerPiece: Number(e.target.value) || 0 })} /></div>
                  <div><Label>Total INR</Label><Input value={form.totalInr} readOnly /></div>
                  <div><Label>Exchange rate (INR to RMB)</Label><Input type="number" min="0" value={form.exchangeRate} onChange={e => patchForm({ exchangeRate: Number(e.target.value) || 0 })} /></div>
                  <div><Label>CBM per cartoon</Label><Input type="number" min="0" value={form.cbmPerCartoon} onChange={e => patchForm({ cbmPerCartoon: Number(e.target.value) || 0 })} /></div>
                  <div><Label>Total CBM</Label><Input value={form.totalCbm} readOnly /></div>
                  <div><Label>CBM rate</Label><Input type="number" min="0" value={form.cbmRate} onChange={e => patchForm({ cbmRate: Number(e.target.value) || 0 })} /></div>
                  <div><Label>CBM cost</Label><Input value={form.cbmCost} readOnly /></div>
                  <div><Label>CBM per piece</Label><Input value={form.cbmPerPiece} readOnly /></div>
                  <div><Label>Product cost per piece</Label><Input value={form.productCostPerPiece} readOnly /></div>
                  <div><Label>Selling price</Label><Input type="number" min="0" value={form.sellingPrice} onChange={e => patchForm({ sellingPrice: Number(e.target.value) || 0 })} />{errors.sellingPrice && <p className="text-xs text-red-600">{errors.sellingPrice}</p>}</div>
                  <div><Label>Profit %</Label><Input value={form.profitPercent} readOnly /></div>
                </div>
                {(errors.price || errors.negative) && <p className="text-xs text-red-600">{errors.price || errors.negative}</p>}
              </section>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={() => saveInquiry('draft')}>Save Draft</Button>
                <Button onClick={() => saveInquiry('saved')}>Save</Button>
                <Button variant="outline" onClick={closeForm}>Exit</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {confirmExitOpen && (
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle>Discard changes?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Work will not be saved. Are you sure you want to exit?</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmExitOpen(false)}>Continue Editing</Button>
                <Button variant="destructive" onClick={() => { setConfirmExitOpen(false); setIsFormOpen(false); setForm(calcForm(emptyForm())); setErrors({}); }}>Discard</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isSummaryOpen && summaryInquiry && (
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4" onClick={() => setIsSummaryOpen(false)}>
          <Card className="w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Inquiry Saved</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Inquiry ID:</span> {summaryInquiry.id}</div>
                <div><span className="text-muted-foreground">Status:</span> {summaryInquiry.status}</div>
                <div><span className="text-muted-foreground">Product:</span> {summaryInquiry.productName}</div>
                <div><span className="text-muted-foreground">Variant / Color:</span> {[summaryInquiry.variant, summaryInquiry.color].filter(Boolean).join(' / ') || '—'}</div>
                <div><span className="text-muted-foreground">Order type:</span> {summaryInquiry.orderType === 'in_house' ? 'In House Order (Own)' : 'Customer Order (Trade)'}</div>
                <div><span className="text-muted-foreground">Broker:</span> {summaryInquiry.brokerName || 'Owner'}</div>
                <div><span className="text-muted-foreground">Total pieces:</span> {summaryInquiry.totalPieces}</div>
                <div><span className="text-muted-foreground">No. of cartoons:</span> {summaryInquiry.numberOfCartoons}</div>
                <div><span className="text-muted-foreground">Total RMB:</span> {summaryInquiry.totalRmb}</div>
                <div><span className="text-muted-foreground">Total INR:</span> {summaryInquiry.totalInr}</div>
                <div><span className="text-muted-foreground">Total CBM:</span> {summaryInquiry.totalCbm}</div>
                <div><span className="text-muted-foreground">Cost per piece:</span> {summaryInquiry.productCostPerPiece}</div>
                <div><span className="text-muted-foreground">Selling price:</span> {summaryInquiry.sellingPrice}</div>
                <div><span className="text-muted-foreground">Profit %:</span> {summaryInquiry.profitPercent}</div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsSummaryOpen(false)}>Close</Button>
                <Button variant="outline" onClick={() => { setIsSummaryOpen(false); openDetails(summaryInquiry); }}>View Details</Button>
                <Button onClick={() => { setIsSummaryOpen(false); openCreateChoice(); }}>Create Another Inquiry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isDetailsOpen && selectedInquiry && (
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4" onClick={() => setIsDetailsOpen(false)}>
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Inquiry Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div><span className="text-muted-foreground">Product:</span> {selectedInquiry.productName}</div>
                <div><span className="text-muted-foreground">Variant / Color:</span> {[selectedInquiry.variant, selectedInquiry.color].filter(Boolean).join(' / ') || '—'}</div>
                <div><span className="text-muted-foreground">Category:</span> {selectedInquiry.category || '—'}</div>
                <div><span className="text-muted-foreground">Total pieces:</span> {selectedInquiry.totalPieces}</div>
                <div><span className="text-muted-foreground">Pieces/cartoon:</span> {selectedInquiry.piecesPerCartoon}</div>
                <div><span className="text-muted-foreground">No. cartoons:</span> {selectedInquiry.numberOfCartoons}</div>
                <div><span className="text-muted-foreground">RMB piece / total:</span> {selectedInquiry.rmbPricePerPiece} / {selectedInquiry.totalRmb}</div>
                <div><span className="text-muted-foreground">INR piece / total:</span> {selectedInquiry.inrPricePerPiece} / {selectedInquiry.totalInr}</div>
                <div><span className="text-muted-foreground">Exchange rate:</span> {selectedInquiry.exchangeRate}</div>
                <div><span className="text-muted-foreground">CBM cartoon / total:</span> {selectedInquiry.cbmPerCartoon} / {selectedInquiry.totalCbm}</div>
                <div><span className="text-muted-foreground">CBM rate / cost:</span> {selectedInquiry.cbmRate} / {selectedInquiry.cbmCost}</div>
                <div><span className="text-muted-foreground">CBM per piece:</span> {selectedInquiry.cbmPerPiece}</div>
                <div><span className="text-muted-foreground">Product cost per piece:</span> {selectedInquiry.productCostPerPiece}</div>
                <div><span className="text-muted-foreground">Selling price:</span> {selectedInquiry.sellingPrice}</div>
                <div><span className="text-muted-foreground">Profit %:</span> {selectedInquiry.profitPercent}</div>
                <div><span className="text-muted-foreground">Broker:</span> {selectedInquiry.brokerName || 'Owner'}</div>
                <div><span className="text-muted-foreground">Status:</span> {selectedInquiry.status}</div>
              </div>
              <div className="rounded border border-dashed p-3 text-muted-foreground">Future action placeholder: Convert to Confirmed Order.</div>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
