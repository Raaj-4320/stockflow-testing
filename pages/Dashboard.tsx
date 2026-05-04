import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from '../components/ui';
import { Customer, PurchaseOrder, PurchaseParty, Transaction } from '../types';
import { getCanonicalCustomerBalanceSnapshot, getPurchaseOrders, getPurchaseParties, loadData, processTransaction, recordPurchaseOrderPayment } from '../services/storage';
import { formatINRPrecise } from '../services/numberFormat';
import { getPaymentStatusColorClass } from '../utils_paymentStatusStyles';

type CustomerReceivableRow = Customer & { receivable: number };
type PartyPayableRow = PurchaseParty & { payable: number; dueOrders: PurchaseOrder[] };

export default function Dashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<PurchaseParty[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMethod, setReceiveMethod] = useState<'Cash' | 'Online'>('Cash');
  const [receiveNote, setReceiveNote] = useState('');
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const [partyId, setPartyId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'online'>('cash');
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  const refresh = () => {
    const data = loadData();
    setCustomers(data.customers || []);
    setTransactions(data.transactions || []);
    setParties(getPurchaseParties());
    setOrders(getPurchaseOrders());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('local-storage-update', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('local-storage-update', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const canonicalSnapshot = useMemo(() => getCanonicalCustomerBalanceSnapshot(customers, transactions), [customers, transactions]);

  const customerReceivables = useMemo<CustomerReceivableRow[]>(() => {
    return customers
      .map((customer) => ({
        ...customer,
        receivable: Math.max(0, Number(canonicalSnapshot.balances.get(customer.id)?.totalDue || 0)),
      }))
      .filter((customer) => customer.receivable > 0)
      .sort((a, b) => b.receivable - a.receivable);
  }, [customers, canonicalSnapshot]);

  const partyPayables = useMemo<PartyPayableRow[]>(() => {
    const dueOrders = orders
      .filter((order) => Math.max(0, Number(order.remainingAmount || 0)) > 0)
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    return parties
      .map((party) => {
        const partyDueOrders = dueOrders.filter((order) => order.partyId === party.id);
        const payable = partyDueOrders.reduce((sum, order) => sum + Math.max(0, Number(order.remainingAmount || 0)), 0);
        return { ...party, payable, dueOrders: partyDueOrders };
      })
      .filter((party) => party.payable > 0)
      .sort((a, b) => b.payable - a.payable);
  }, [parties, orders]);

  const totalReceivable = useMemo(() => customerReceivables.reduce((sum, customer) => sum + customer.receivable, 0), [customerReceivables]);
  const totalPayable = useMemo(() => partyPayables.reduce((sum, party) => sum + party.payable, 0), [partyPayables]);

  const selectedCustomer = customerReceivables.find((c) => c.id === customerId) || null;
  const selectedParty = partyPayables.find((p) => p.id === partyId) || null;

  const handleReceive = () => {
    setReceiveError(null);
    if (!selectedCustomer) return setReceiveError('Select customer.');
    const amount = Number(receiveAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setReceiveError('Enter valid amount.');
    const tx: Transaction = {
      id: Date.now().toString(),
      items: [],
      total: amount,
      date: new Date().toISOString(),
      type: 'payment',
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      paymentMethod: receiveMethod,
      notes: receiveNote.trim() || undefined,
    };
    processTransaction(tx);
    setReceiveAmount('');
    setReceiveNote('');
    refresh();
  };

  const handlePay = async () => {
    setPayError(null);
    if (!selectedParty) return setPayError('Select party.');
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setPayError('Enter valid amount.');
    if (amount > selectedParty.payable + 0.0001) return setPayError('Amount exceeds payable.');

    let remaining = Number(amount.toFixed(2));
    for (const order of selectedParty.dueOrders) {
      if (remaining <= 0) break;
      const orderRemaining = Math.max(0, Number(order.remainingAmount || 0));
      if (orderRemaining <= 0) continue;
      const allocation = Math.min(remaining, orderRemaining);
      await recordPurchaseOrderPayment(order.id, allocation, payMethod, `${payNote.trim() || 'Dashboard payable settlement'} | party:${selectedParty.name}`);
      remaining = Number((remaining - allocation).toFixed(2));
    }

    setPayAmount('');
    setPayNote('');
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Receivable and payable overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="min-h-[140px]">
          <CardHeader><CardTitle className="text-sm text-blue-700">Total Receivable</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-700">{formatINRPrecise(totalReceivable)}</div></CardContent>
        </Card>
        <Card className="min-h-[140px]">
          <CardHeader><CardTitle className={`text-sm ${getPaymentStatusColorClass('credit due')}`}>Total Payable</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-700">{formatINRPrecise(totalPayable)}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Customer Receivables</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {customerReceivables.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.phone || '-'}</div></div>
                <div className="font-semibold text-blue-700">{formatINRPrecise(c.receivable)}</div>
              </div>
            ))}
            {!customerReceivables.length && <p className="text-sm text-muted-foreground">No receivable customers.</p>}

            <div className="border-t pt-3 space-y-2">
              <Label>Receive Payment</Label>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer</option>
                {customerReceivables.map(c => <option key={c.id} value={c.id}>{c.name} ({formatINRPrecise(c.receivable)})</option>)}
              </Select>
              <Input placeholder="Amount" type="number" min="0" step="0.01" value={receiveAmount} onChange={(e) => setReceiveAmount(e.target.value)} />
              <Select value={receiveMethod} onChange={(e) => setReceiveMethod(e.target.value as 'Cash' | 'Online')}>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
              </Select>
              <Input placeholder="Note / reference (optional)" value={receiveNote} onChange={(e) => setReceiveNote(e.target.value)} />
              {receiveError && <p className="text-xs text-red-600">{receiveError}</p>}
              <Button onClick={handleReceive}>Receive</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Party/Supplier Payables</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {partyPayables.map((p) => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.phone || '-'}</div></div>
                <div className="font-semibold text-orange-700">{formatINRPrecise(p.payable)}</div>
              </div>
            ))}
            {!partyPayables.length && <p className="text-sm text-muted-foreground">No payable parties.</p>}

            <div className="border-t pt-3 space-y-2">
              <Label>Pay Supplier/Party</Label>
              <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">Select party</option>
                {partyPayables.map(p => <option key={p.id} value={p.id}>{p.name} ({formatINRPrecise(p.payable)})</option>)}
              </Select>
              <Input placeholder="Amount" type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as 'cash' | 'online')}>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </Select>
              <Input placeholder="Note / reference (optional)" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              {payError && <p className="text-xs text-red-600">{payError}</p>}
              <Button onClick={() => void handlePay()}>Pay</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
