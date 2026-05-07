import React, { useMemo, useState } from 'react';
import { loadData, getSaleSettlementBreakdown, getCanonicalCustomerBalanceSnapshot } from '../services/storage';
import { CashAdjustment, Expense, PurchaseOrder, Transaction } from '../types';

type LedgerType = 'sale' | 'payment' | 'purchase' | 'expense' | 'return' | 'adjustment' | 'credit';
type PayType = 'cash' | 'online' | 'credit' | 'mixed' | 'na';

type Row = {
  id: string;
  date: string;
  type: LedgerType;
  description: string;
  reference: string;
  party: string;
  payment: PayType;
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
  receivableDelta: number;
  payableDelta: number;
};

const fmt = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

export default function Cashbook() {
  const data = useMemo(() => loadData(), []);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payFilter, setPayFilter] = useState<'all' | 'cash' | 'online' | 'credit'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LedgerType>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [full, setFull] = useState(false);

  const rows = useMemo(() => {
    const txRows: Row[] = (data.transactions || []).map((tx: Transaction) => {
      if (tx.type === 'sale') {
        const s = getSaleSettlementBreakdown(tx);
        return {
          id: `tx-${tx.id}`,
          date: tx.date,
          type: s.creditDue > 0 ? 'credit' : 'sale',
          description: `Sale #${tx.id.slice(-6)} — ${tx.customerName || 'Walk-in Customer'}`,
          reference: tx.id,
          party: tx.customerName || 'Walk-in Customer',
          payment: s.creditDue > 0 && (s.cashPaid > 0 || s.onlinePaid > 0) ? 'mixed' : s.creditDue > 0 ? 'credit' : s.onlinePaid > 0 ? 'online' : 'cash',
          cashIn: s.cashPaid,
          cashOut: 0,
          bankIn: s.onlinePaid,
          bankOut: 0,
          receivableDelta: s.creditDue,
          payableDelta: 0,
        };
      }
      if (tx.type === 'payment') {
        const isOnline = (tx.paymentMethod || '').toLowerCase() === 'online';
        return { id: `tx-${tx.id}`, date: tx.date, type: 'payment', description: `Payment Receipt #${tx.id.slice(-6)} — ${tx.customerName || 'Customer'}`,
          reference: tx.id, party: tx.customerName || 'Customer', payment: isOnline ? 'online' : 'cash', cashIn: isOnline ? 0 : tx.total, cashOut: 0, bankIn: isOnline ? tx.total : 0, bankOut: 0, receivableDelta: -Math.abs(tx.total), payableDelta: 0 };
      }
      const isOnline = (tx.paymentMethod || '').toLowerCase() === 'online';
      const storeCreditCreated = Math.max(0, Number(tx.storeCreditCreated || 0));
      return { id: `tx-${tx.id}`, date: tx.date, type: 'return', description: `Return/Refund #${tx.id.slice(-6)} — ${tx.customerName || 'Customer'}`,
        reference: tx.id, party: tx.customerName || 'Customer', payment: isOnline ? 'online' : 'cash', cashIn: 0, cashOut: isOnline ? 0 : Math.abs(tx.total), bankIn: 0, bankOut: isOnline ? Math.abs(tx.total) : 0,
        receivableDelta: -storeCreditCreated, payableDelta: 0 };
    });

    const purchaseRows: Row[] = (data.purchaseOrders || []).flatMap((po: PurchaseOrder) => {
      const base: Row = { id: `po-${po.id}`, date: po.orderDate || po.createdAt, type: 'purchase', description: `Purchase #${po.id.slice(-6)} — ${po.partyName}`,
        reference: po.billNumber || po.id, party: po.partyName, payment: 'credit', cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0,
        receivableDelta: 0, payableDelta: Math.max(0, Number(po.totalAmount || 0)) };
      const pays = (po.paymentHistory || []).map((p) => ({ id: `pop-${po.id}-${p.id}`, date: p.paidAt, type: 'payment' as LedgerType, description: `Supplier Payment #${p.id.slice(-6)} — ${po.partyName}`,
        reference: po.id, party: po.partyName, payment: p.method === 'online' ? 'online' as PayType : 'cash' as PayType, cashIn: 0, cashOut: p.method === 'online' ? 0 : p.amount, bankIn: 0, bankOut: p.method === 'online' ? p.amount : 0,
        receivableDelta: 0, payableDelta: -Math.abs(p.amount) }));
      return [base, ...pays];
    });

    const expenseRows: Row[] = (data.expenses || []).map((e: Expense) => ({
      id: `exp-${e.id}`, date: e.createdAt, type: 'expense', description: `Expense — ${e.title}`,
      reference: e.id, party: e.category || '-', payment: 'cash', cashIn: 0, cashOut: Math.abs(e.amount || 0), bankIn: 0, bankOut: 0, receivableDelta: 0, payableDelta: 0,
    }));

    const adjRows: Row[] = (data.cashAdjustments || []).map((a: CashAdjustment) => ({
      id: `adj-${a.id}`, date: a.createdAt, type: 'adjustment', description: a.type === 'cash_addition' ? `Manual Cash Added — ${a.note || ''}` : `Manual Cash Withdrawn — ${a.note || ''}`,
      reference: a.id, party: '-', payment: 'cash', cashIn: a.type === 'cash_addition' ? a.amount : 0, cashOut: a.type === 'cash_withdrawal' ? a.amount : 0,
      bankIn: 0, bankOut: 0, receivableDelta: 0, payableDelta: 0,
    }));

    const corrRows: Row[] = [
      ...(data.deleteCompensations || []).map((c) => ({ id: `dc-${c.id}`, date: c.createdAt, type: 'adjustment' as LedgerType, description: `Delete compensation — ${c.customerName || 'Customer'}`,
        reference: c.transactionId, party: c.customerName || '-', payment: 'cash' as PayType, cashIn: 0, cashOut: c.amount, bankIn: 0, bankOut: 0, receivableDelta: 0, payableDelta: 0 })),
      ...(data.updatedTransactionEvents || []).map((u) => ({ id: `ute-${u.id}`, date: u.updatedAt, type: 'adjustment' as LedgerType, description: `Transaction edit correction — ${u.customerName || u.updatedTransactionId.slice(-6)}`,
        reference: u.originalTransactionId, party: u.customerName || '-', payment: 'na' as PayType, cashIn: Math.max(0, Number(u.cashbookDelta?.cashIn || 0)), cashOut: Math.max(0, Number(u.cashbookDelta?.cashOut || 0)),
        bankIn: Math.max(0, Number(u.cashbookDelta?.onlineIn || 0)), bankOut: Math.max(0, Number(u.cashbookDelta?.onlineOut || 0)), receivableDelta: Number(u.cashbookDelta?.currentDueEffect || 0), payableDelta: 0 })),
    ];

    return [...txRows, ...purchaseRows, ...expenseRows, ...adjRows, ...corrRows].filter(r => !!r.date);
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const t = new Date(r.date).getTime();
      if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
      if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
      if (payFilter !== 'all' && r.payment !== payFilter && !(payFilter === 'online' && r.payment === 'mixed')) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (!q) return true;
      return `${r.description} ${r.reference} ${r.party}`.toLowerCase().includes(q);
    }).sort((a,b)=> sort==='newest' ? new Date(b.date).getTime()-new Date(a.date).getTime() : new Date(a.date).getTime()-new Date(b.date).getTime());
  }, [rows, from, to, payFilter, typeFilter, search, sort]);

  const kpi = useMemo(() => {
    const cash = filtered.reduce((s, r) => s + r.cashIn - r.cashOut, 0);
    const bank = filtered.reduce((s, r) => s + r.bankIn - r.bankOut, 0);
    const receivable = getCanonicalCustomerBalanceSnapshot(data.customers || [], data.transactions || []).reduce((s, c) => s + Math.max(0, (c.totalDue || 0) - (c.storeCredit || 0)), 0);
    const payable = (data.purchaseOrders || []).reduce((s, p) => s + Math.max(0, Number(p.remainingAmount ?? Math.max(0, (p.totalAmount || 0) - (p.totalPaid || 0)))), 0);
    return { cash, bank, receivable, payable };
  }, [filtered, data]);

  let runningCash = 0; let runningBank = 0;

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">Cashbook</h1><p className="text-sm text-muted-foreground">Track all cash and bank flows across your business.</p></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
      <div className="rounded border p-3 bg-emerald-50"><div>Cash in hand</div><div className="text-xl font-bold text-emerald-700">{fmt(kpi.cash)}</div></div>
      <div className="rounded border p-3 bg-blue-50"><div>Bank</div><div className="text-xl font-bold text-blue-700">{fmt(kpi.bank)}</div></div>
      <div className="rounded border p-3 bg-orange-50"><div>Customer/Party Receivable</div><div className="text-xl font-bold text-orange-700">{fmt(kpi.receivable)}</div></div>
      <div className="rounded border p-3 bg-rose-50"><div>Customer/Party Payable</div><div className="text-xl font-bold text-rose-700">{fmt(kpi.payable)}</div></div>
    </div>
    <div className="rounded border p-3 space-y-3">
      <div className="grid md:grid-cols-6 gap-2">
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border rounded px-2 h-9"/>
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border rounded px-2 h-9"/>
        <select value={payFilter} onChange={e=>setPayFilter(e.target.value as any)} className="border rounded px-2 h-9"><option value="all">All Payment</option><option value="cash">Cash</option><option value="online">Bank/Online</option><option value="credit">Credit</option></select>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value as any)} className="border rounded px-2 h-9"><option value="all">All Type</option><option value="sale">Sale</option><option value="payment">Payment</option><option value="purchase">Purchase</option><option value="expense">Expense</option><option value="return">Return</option><option value="adjustment">Adjustment</option><option value="credit">Credit</option></select>
        <select value={sort} onChange={e=>setSort(e.target.value as any)} className="border rounded px-2 h-9"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
        <button onClick={()=>setFull(v=>!v)} className="border rounded px-2 h-9">{full ? 'Compact columns' : 'Show full accountant columns'}</button>
      </div>
      <input placeholder="Search description/customer/party/reference" value={search} onChange={e=>setSearch(e.target.value)} className="border rounded px-2 h-9 w-full"/>
      <div className="overflow-auto">
        <table className="min-w-[1200px] w-full text-xs">
          <thead><tr className="text-left border-b"><th>Date</th><th>Type</th><th>Description</th><th>Payment</th><th className="text-right">Cash In</th><th className="text-right">Cash Out</th><th className="text-right">Bank In</th><th className="text-right">Bank Out</th>{full && <><th className="text-right">Receivable Δ</th><th className="text-right">Payable Δ</th><th className="text-right">Cash Bal</th><th className="text-right">Bank Bal</th></>} </tr></thead>
          <tbody>{filtered.map(r=>{ runningCash += r.cashIn-r.cashOut; runningBank += r.bankIn-r.bankOut; return <tr key={r.id} className="border-b"><td>{new Date(r.date).toLocaleString()}</td><td>{r.type}</td><td>{r.description}</td><td>{r.payment}</td><td className="text-right text-emerald-700">{r.cashIn?fmt(r.cashIn):'-'}</td><td className="text-right text-red-600">{r.cashOut?fmt(r.cashOut):'-'}</td><td className="text-right text-blue-700">{r.bankIn?fmt(r.bankIn):'-'}</td><td className="text-right text-red-600">{r.bankOut?fmt(r.bankOut):'-'}</td>{full && <><td className="text-right text-orange-700">{r.receivableDelta?fmt(r.receivableDelta):'-'}</td><td className="text-right text-rose-700">{r.payableDelta?fmt(r.payableDelta):'-'}</td><td className="text-right">{fmt(runningCash)}</td><td className="text-right">{fmt(runningBank)}</td></>}</tr>})}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
