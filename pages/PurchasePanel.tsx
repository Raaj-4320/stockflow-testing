import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { Product, PurchaseOrder, PurchaseOrderLine, PurchaseParty } from '../types';
import { createPurchaseOrder, createPurchaseParty, getPurchaseOrders, getPurchaseParties, loadData, receivePurchaseOrder } from '../services/storage';
import { getProductStockRows } from '../services/productVariants';
import { Check, Plus, Search, Truck } from 'lucide-react';

type Tab = 'orders' | 'parties';

type DraftLine = {
  id: string;
  sourceType: 'inventory' | 'new';
  productId?: string;
  productName: string;
  category?: string;
  image?: string;
  variant?: string;
  color?: string;
  quantity: number;
  unitCost: number;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function PurchasePanel() {
  const [tab, setTab] = useState<Tab>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [parties, setParties] = useState<PurchaseParty[]>([]);

  const [search, setSearch] = useState('');
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyGst, setPartyGst] = useState('');
  const [partyLocation, setPartyLocation] = useState('');
  const [partyContact, setPartyContact] = useState('');
  const [partyNotes, setPartyNotes] = useState('');

  const [quickProductId, setQuickProductId] = useState('');
  const [quickVariant, setQuickVariant] = useState('');
  const [quickColor, setQuickColor] = useState('');
  const [quickQty, setQuickQty] = useState(0);
  const [quickUnitCost, setQuickUnitCost] = useState(0);

  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductImage, setNewProductImage] = useState('');
  const [newProductVariant, setNewProductVariant] = useState('');
  const [newProductColor, setNewProductColor] = useState('');
  const [newProductQty, setNewProductQty] = useState(0);
  const [newProductCost, setNewProductCost] = useState(0);

  const refresh = () => {
    const data = loadData();
    setProducts(data.products || []);
    setOrders(getPurchaseOrders());
    setParties(getPurchaseParties());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('local-storage-update', refresh);
    return () => window.removeEventListener('local-storage-update', refresh);
  }, []);

  const productOptions = useMemo(() => products.filter(p => [p.name, p.category, p.barcode].join(' ').toLowerCase().includes(search.toLowerCase())), [products, search]);

  const filteredOrders = useMemo(() => orders.filter(o => [o.partyName, o.id, ...o.lines.map(l => l.productName)].join(' ').toLowerCase().includes(search.toLowerCase())), [orders, search]);

  const resetCreateOrder = () => {
    setPartyId('');
    setNotes('');
    setLines([]);
    setQuickProductId('');
    setQuickVariant('');
    setQuickColor('');
    setQuickQty(0);
    setQuickUnitCost(0);
    setNewProductName('');
    setNewProductCategory('');
    setNewProductImage('');
    setNewProductVariant('');
    setNewProductColor('');
    setNewProductQty(0);
    setNewProductCost(0);
  };

  const addInventoryLine = () => {
    const product = products.find(p => p.id === quickProductId);
    if (!product || quickQty <= 0 || quickUnitCost <= 0) return;
    setLines(prev => [...prev, {
      id: uid(),
      sourceType: 'inventory',
      productId: product.id,
      productName: product.name,
      category: product.category,
      image: product.image,
      variant: quickVariant || undefined,
      color: quickColor || undefined,
      quantity: quickQty,
      unitCost: quickUnitCost,
    }]);
    setQuickQty(0);
    setQuickUnitCost(0);
  };

  const addNewProductLine = () => {
    if (!newProductName.trim() || newProductQty <= 0 || newProductCost <= 0) return;
    setLines(prev => [...prev, {
      id: uid(),
      sourceType: 'new',
      productName: newProductName.trim(),
      category: newProductCategory.trim() || 'Uncategorized',
      image: newProductImage.trim(),
      variant: newProductVariant.trim() || undefined,
      color: newProductColor.trim() || undefined,
      quantity: newProductQty,
      unitCost: newProductCost,
    }]);
    setNewProductName('');
    setNewProductCategory('');
    setNewProductImage('');
    setNewProductVariant('');
    setNewProductColor('');
    setNewProductQty(0);
    setNewProductCost(0);
  };

  const saveOrder = async () => {
    const party = parties.find(p => p.id === partyId);
    if (!party || !lines.length) return;
    const orderLines: PurchaseOrderLine[] = lines.map(l => ({
      ...l,
      totalCost: l.quantity * l.unitCost,
    }));
    const totalQuantity = orderLines.reduce((s, l) => s + l.quantity, 0);
    const totalAmount = orderLines.reduce((s, l) => s + l.totalCost, 0);
    const now = new Date().toISOString();
    const order: PurchaseOrder = {
      id: `po-${uid()}`,
      partyId: party.id,
      partyName: party.name,
      partyPhone: party.phone,
      partyGst: party.gst,
      partyLocation: party.location,
      status: 'ordered',
      orderDate: now,
      notes: notes.trim() || undefined,
      lines: orderLines,
      totalQuantity,
      totalAmount,
      receivedQuantity: 0,
      createdAt: now,
      updatedAt: now,
    };
    await createPurchaseOrder(order);
    setShowCreateOrder(false);
    resetCreateOrder();
    refresh();
  };

  const saveParty = async () => {
    if (!partyName.trim()) return;
    await createPurchaseParty({
      name: partyName,
      phone: partyPhone,
      gst: partyGst,
      location: partyLocation,
      contactPerson: partyContact,
      notes: partyNotes,
    });
    setPartyName('');
    setPartyPhone('');
    setPartyGst('');
    setPartyLocation('');
    setPartyContact('');
    setPartyNotes('');
    refresh();
  };

  const receiveOrder = async (id: string) => {
    await receivePurchaseOrder(id);
    refresh();
  };

  const selectedProduct = products.find(p => p.id === quickProductId);
  const selectedStockRows = selectedProduct ? getProductStockRows(selectedProduct) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase Panel</h1>
        <p className="text-sm text-muted-foreground">Create reusable parties, place purchase orders, and receive products into inventory.</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button size="sm" variant={tab === 'orders' ? 'default' : 'outline'} onClick={() => setTab('orders')}>Purchase Orders</Button>
        <Button size="sm" variant={tab === 'parties' ? 'default' : 'outline'} onClick={() => setTab('parties')}>Parties</Button>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder={tab === 'orders' ? 'Search orders, parties, products...' : 'Search products to quickly add to order...'} />
      </div>

      {tab === 'parties' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Create Party</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Name</Label><Input value={partyName} onChange={e => setPartyName(e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={partyPhone} onChange={e => setPartyPhone(e.target.value)} /></div>
              <div><Label>GST</Label><Input value={partyGst} onChange={e => setPartyGst(e.target.value)} /></div>
              <div><Label>Location</Label><Input value={partyLocation} onChange={e => setPartyLocation(e.target.value)} /></div>
              <div><Label>Contact Person</Label><Input value={partyContact} onChange={e => setPartyContact(e.target.value)} /></div>
              <div><Label>Notes</Label><textarea value={partyNotes} onChange={e => setPartyNotes(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" rows={3} /></div>
              <Button onClick={saveParty}><Plus className="w-4 h-4 mr-1" /> Save Party</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Saved Parties</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {parties.map(p => (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.phone || '—'} · {p.gst || 'No GST'} · {p.location || 'No location'}</div>
                  <div className="text-xs text-muted-foreground">Contact: {p.contactPerson || '—'}</div>
                </div>
              ))}
              {!parties.length && <div className="text-sm text-muted-foreground">No parties saved yet.</div>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetCreateOrder(); setShowCreateOrder(true); }}><Plus className="w-4 h-4 mr-1" /> Create Purchase Order</Button>
          </div>

          {showCreateOrder && (
            <Card>
              <CardHeader><CardTitle>Create Purchase Order</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Party</Label>
                    <select value={partyId} onChange={e => setPartyId(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                      <option value="">Select party</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.phone || 'No phone'})</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Order Notes</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional" />
                  </div>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Add Existing Inventory Product Line</CardTitle></CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-3">
                    <div><Label>Product</Label><select value={quickProductId} onChange={e => { setQuickProductId(e.target.value); setQuickVariant(''); setQuickColor(''); }} className="h-10 w-full rounded-md border px-3 text-sm"><option value="">Select product</option>{productOptions.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}</select></div>
                    <div><Label>Variant / Color</Label><select value={`${quickVariant}||${quickColor}`} onChange={e => { const [v,c] = e.target.value.split('||'); setQuickVariant(v || ''); setQuickColor(c || ''); }} className="h-10 w-full rounded-md border px-3 text-sm"><option value="||">No Variant / No Color</option>{selectedStockRows.map((r, i) => <option key={`${i}-${r.variant}-${r.color}`} value={`${r.variant}||${r.color}`}>{r.variant} / {r.color} (stock {r.stock})</option>)}</select></div>
                    <div><Label>Qty</Label><Input type="number" value={quickQty} onChange={e => setQuickQty(Number(e.target.value) || 0)} /></div>
                    <div><Label>Unit Cost</Label><Input type="number" value={quickUnitCost} onChange={e => setQuickUnitCost(Number(e.target.value) || 0)} /></div>
                    <div className="md:col-span-2 flex items-end"><Button type="button" onClick={addInventoryLine}>Add Line</Button></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Add New Product Line (not in inventory)</CardTitle></CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-3">
                    <div><Label>Name</Label><Input value={newProductName} onChange={e => setNewProductName(e.target.value)} /></div>
                    <div><Label>Category</Label><Input value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} /></div>
                    <div><Label>Image URL</Label><Input value={newProductImage} onChange={e => setNewProductImage(e.target.value)} /></div>
                    <div><Label>Variant</Label><Input value={newProductVariant} onChange={e => setNewProductVariant(e.target.value)} /></div>
                    <div><Label>Color</Label><Input value={newProductColor} onChange={e => setNewProductColor(e.target.value)} /></div>
                    <div><Label>Qty</Label><Input type="number" value={newProductQty} onChange={e => setNewProductQty(Number(e.target.value) || 0)} /></div>
                    <div><Label>Unit Cost</Label><Input type="number" value={newProductCost} onChange={e => setNewProductCost(Number(e.target.value) || 0)} /></div>
                    <div className="md:col-span-2 flex items-end"><Button type="button" onClick={addNewProductLine}>Add New Product Line</Button></div>
                  </CardContent>
                </Card>

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="font-medium">Order Lines ({lines.length})</div>
                  {lines.map(l => (
                    <div key={l.id} className="flex justify-between text-sm border-t pt-2">
                      <div>{l.productName} {l.variant || l.color ? `• ${l.variant || 'No Variant'} / ${l.color || 'No Color'}` : ''} ({l.sourceType})</div>
                      <div>{l.quantity} × ₹{l.unitCost} = ₹{(l.quantity * l.unitCost).toFixed(2)}</div>
                    </div>
                  ))}
                  {!lines.length && <div className="text-sm text-muted-foreground">No lines added yet.</div>}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateOrder(false)}>Cancel</Button>
                  <Button onClick={saveOrder} disabled={!partyId || !lines.length}><Check className="w-4 h-4 mr-1" /> Save Order</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {filteredOrders.map(order => (
                <div key={order.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{order.id}</div>
                      <div className="text-xs text-muted-foreground">Party: {order.partyName} • {new Date(order.orderDate).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{order.partyPhone || 'No phone'} • GST: {order.partyGst || '—'} • {order.partyLocation || 'No location'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">₹{order.totalAmount.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">Qty {order.totalQuantity}</div>
                      <div className="text-xs uppercase">{order.status.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {order.lines.map(line => (
                      <div key={line.id} className="text-xs text-muted-foreground flex justify-between border-t pt-1">
                        <span>{line.productName} {line.variant || line.color ? `• ${line.variant || 'No Variant'} / ${line.color || 'No Color'}` : ''}</span>
                        <span>{line.quantity} × ₹{line.unitCost} = ₹{line.totalCost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => receiveOrder(order.id)} disabled={order.status === 'received'}>
                      <Truck className="w-4 h-4 mr-1" /> {order.status === 'received' ? 'Received' : 'Receive to Inventory'}
                    </Button>
                  </div>
                </div>
              ))}
              {!filteredOrders.length && <div className="text-sm text-muted-foreground">No purchase orders yet.</div>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
