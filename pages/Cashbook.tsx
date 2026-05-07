import React, { useEffect, useMemo, useState } from 'react';
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
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asPlainObject = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const toNum = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const pickRef = (tx: any) => [tx?.invoiceNo, tx?.receiptNo, tx?.billNo, tx?.reference, tx?.orderId, tx?.id].find((v) => typeof v === 'string' && v.trim()) || String(tx?.id || '').slice(-6) || 'UNKNOWN';
const pickCustomer = (tx: any, customers: any[]) => {
  const linked = tx?.customerId ? asArray<any>(customers).find((c) => c?.id === tx.customerId)?.name : '';
  return linked || tx?.customerName || tx?.customer?.name || tx?.customerPhone || 'Walk-in Customer';
};
const pickMethod = (tx: any, settlement?: { cashPaid: number; onlinePaid: number; creditDue: number }): PayType => {
  const m = String(tx?.paymentMethod || tx?.paymentDetails?.method || tx?.method || tx?.mode || '').toLowerCase();
  if (m.includes('cash')) return 'cash';
  if (m.includes('online') || m.includes('bank') || m.includes('upi') || m.includes('card')) return 'online';
  if (m.includes('credit') || m.includes('due')) return 'credit';
  if (settlement) {
    if (settlement.cashPaid > 0 && settlement.onlinePaid <= 0 && settlement.creditDue <= 0) return 'cash';
    if (settlement.onlinePaid > 0 && settlement.cashPaid <= 0 && settlement.creditDue <= 0) return 'online';
    if (settlement.creditDue > 0 && settlement.cashPaid <= 0 && settlement.onlinePaid <= 0) return 'credit';
    if (settlement.cashPaid > 0 || settlement.onlinePaid > 0 || settlement.creditDue > 0) return 'mixed';
  }
  return 'na';
};
const getMoney = (tx: any) => {
  const total = toNum(tx?.total || tx?.amount || tx?.grandTotal || ((toNum(tx?.subtotal) + toNum(tx?.tax)) - toNum(tx?.discount)));
  const cashPaid = toNum(tx?.cashPaid);
  const onlinePaid = toNum(tx?.onlinePaid);
  const creditDue = toNum(tx?.creditDue);
  return { total, cashPaid, onlinePaid, creditDue, paidAmount: toNum(tx?.paidAmount || tx?.paymentAmount) };
};

export default function Cashbook() {
  const data = useMemo(() => loadData(), []);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payFilter, setPayFilter] = useState<'all' | 'cash' | 'online' | 'credit'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LedgerType>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [full, setFull] = useState(false);
  const [visibleRowCount, setVisibleRowCount] = useState(35);

  const safeTransactions = asArray<Transaction>(data.transactions);
  const safePurchaseOrders = asArray<PurchaseOrder>(data.purchaseOrders);
  const safeExpenses = asArray<Expense>(data.expenses);
  const safeCashAdjustments = asArray<CashAdjustment>(data.cashAdjustments);
  const safeDeleteCompensations = asArray<any>(data.deleteCompensations);
  const safeUpdatedTransactionEvents = asArray<any>(data.updatedTransactionEvents);
  const safeCustomers = asArray<any>(data.customers);

  const rows = useMemo(() => {
    const txRows: Row[] = safeTransactions.map((tx: Transaction) => {
      const txAny = tx as any;
      const ref = pickRef(txAny);
      const customer = pickCustomer(txAny, safeCustomers);
      const settlement = tx.type === 'sale' ? getSaleSettlementBreakdown(tx) : { cashPaid: 0, onlinePaid: 0, creditDue: 0 };
      const legacy = getMoney(txAny);
      const derivedSale = (settlement.cashPaid + settlement.onlinePaid + settlement.creditDue) > 0
        ? settlement
        : (() => {
            const method = pickMethod(txAny);
            if (legacy.cashPaid || legacy.onlinePaid || legacy.creditDue) return { cashPaid: legacy.cashPaid, onlinePaid: legacy.onlinePaid, creditDue: legacy.creditDue };
            if (method === 'cash') return { cashPaid: legacy.total, onlinePaid: 0, creditDue: 0 };
            if (method === 'online') return { cashPaid: 0, onlinePaid: legacy.total, creditDue: 0 };
            if (method === 'credit') return { cashPaid: 0, onlinePaid: 0, creditDue: legacy.total };
            return { cashPaid: 0, onlinePaid: 0, creditDue: 0 };
          })();

      if (tx.type === 'sale') {
        return { id: `tx-${tx.id}`, date: tx.date || txAny.createdAt || txAny.updatedAt || '', type: derivedSale.creditDue > 0 ? 'credit' : 'sale',
          description: `Sale Invoice #${ref} — ${customer}`, reference: ref, party: customer, payment: pickMethod(txAny, derivedSale),
          cashIn: derivedSale.cashPaid, cashOut: 0, bankIn: derivedSale.onlinePaid, bankOut: 0, receivableDelta: derivedSale.creditDue, payableDelta: 0 };
      }
      if (tx.type === 'payment') {
        const amt = legacy.paidAmount || legacy.total;
        const m = pickMethod(txAny);
        return { id: `tx-${tx.id}`, date: tx.date || txAny.createdAt || txAny.updatedAt || '', type: 'payment', description: `Payment Receipt #${ref} — ${customer}`,
          reference: ref, party: customer, payment: m, cashIn: m === 'online' ? 0 : amt, cashOut: 0, bankIn: m === 'online' ? amt : 0, bankOut: 0, receivableDelta: -Math.abs(amt), payableDelta: 0 };
      }
      const refund = toNum(txAny.refundAmount || txAny.returnTotal || legacy.total);
      const m = pickMethod(txAny);
      const storeOnly = String(txAny.returnHandlingMode || '').toLowerCase() === 'store_credit';
      return { id: `tx-${tx.id}`, date: tx.date || txAny.createdAt || txAny.updatedAt || '', type: 'return', description: `Return/Refund #${ref} — ${customer}`,
        reference: ref, party: customer, payment: storeOnly ? 'credit' : m, cashIn: 0, cashOut: !storeOnly && m !== 'online' ? Math.abs(refund) : 0, bankIn: 0,
        bankOut: !storeOnly && m === 'online' ? Math.abs(refund) : 0, receivableDelta: -Math.max(0, toNum(txAny.storeCreditCreated || 0)), payableDelta: 0 };
    });

    const purchaseRows: Row[] = safePurchaseOrders.flatMap((po: PurchaseOrder) => {
      const base: Row = { id: `po-${po.id}`, date: po.orderDate || po.createdAt, type: 'purchase', description: `Purchase #${po.id.slice(-6)} — ${po.partyName}`,
        reference: po.billNumber || po.id, party: po.partyName, payment: 'credit', cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0,
        receivableDelta: 0, payableDelta: Math.max(0, Number(po.totalAmount || 0)) };
      const pays = asArray<any>(asPlainObject(po).paymentHistory).map((p) => ({ id: `pop-${po.id}-${p.id}`, date: p.paidAt, type: 'payment' as LedgerType, description: `Supplier Payment #${p.id.slice(-6)} — ${po.partyName}`,
        reference: po.id, party: po.partyName, payment: p.method === 'online' ? 'online' as PayType : 'cash' as PayType, cashIn: 0, cashOut: p.method === 'online' ? 0 : p.amount, bankIn: 0, bankOut: p.method === 'online' ? p.amount : 0,
        receivableDelta: 0, payableDelta: -Math.abs(p.amount) }));
      return [base, ...pays];
    });

    const expenseRows: Row[] = safeExpenses.map((e: Expense) => ({
      id: `exp-${e.id}`, date: e.createdAt, type: 'expense', description: `Expense — ${e.title}`,
      reference: e.id, party: e.category || '-', payment: 'cash', cashIn: 0, cashOut: Math.abs(e.amount || 0), bankIn: 0, bankOut: 0, receivableDelta: 0, payableDelta: 0,
    }));

    const adjRows: Row[] = safeCashAdjustments.map((a: CashAdjustment) => ({
      id: `adj-${a.id}`, date: a.createdAt, type: 'adjustment', description: a.type === 'cash_addition' ? `Manual Cash Added — ${a.note || ''}` : `Manual Cash Withdrawn — ${a.note || ''}`,
      reference: a.id, party: '-', payment: 'cash', cashIn: a.type === 'cash_addition' ? a.amount : 0, cashOut: a.type === 'cash_withdrawal' ? a.amount : 0,
      bankIn: 0, bankOut: 0, receivableDelta: 0, payableDelta: 0,
    }));

    const corrRows: Row[] = [
      ...safeDeleteCompensations.map((c) => ({ id: `dc-${c.id}`, date: c.createdAt, type: 'adjustment' as LedgerType, description: `Delete compensation — ${c.customerName || 'Customer'}`,
        reference: c.transactionId, party: c.customerName || '-', payment: 'cash' as PayType, cashIn: 0, cashOut: c.amount, bankIn: 0, bankOut: 0, receivableDelta: 0, payableDelta: 0 })),
      ...safeUpdatedTransactionEvents.map((u) => ({ id: `ute-${u.id}`, date: u.updatedAt, type: 'adjustment' as LedgerType, description: `Transaction edit correction — ${u.customerName || u.updatedTransactionId.slice(-6)}`,
        reference: u.originalTransactionId, party: u.customerName || '-', payment: 'na' as PayType, cashIn: Math.max(0, Number(u.cashbookDelta?.cashIn || 0)), cashOut: Math.max(0, Number(u.cashbookDelta?.cashOut || 0)),
        bankIn: Math.max(0, Number(u.cashbookDelta?.onlineIn || 0)), bankOut: Math.max(0, Number(u.cashbookDelta?.onlineOut || 0)), receivableDelta: Number(u.cashbookDelta?.currentDueEffect || 0), payableDelta: 0 })),
    ];

    const combinedRows = [...txRows, ...purchaseRows, ...expenseRows, ...adjRows, ...corrRows];
    return asArray<Row>(combinedRows).filter(r => !!r.date && (r.cashIn || r.cashOut || r.bankIn || r.bankOut || r.receivableDelta || r.payableDelta));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return asArray<Row>(rows).filter(r => {
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
    const safeFiltered = asArray<Row>(filtered);
    const cash = safeFiltered.reduce((s, r) => s + r.cashIn - r.cashOut, 0);
    const bank = safeFiltered.reduce((s, r) => s + r.bankIn - r.bankOut, 0);
    const canonicalSnapshot = asArray<any>(getCanonicalCustomerBalanceSnapshot(safeCustomers, safeTransactions));
    const receivable = canonicalSnapshot.reduce((s, c) => s + Math.max(0, (c.totalDue || 0) - (c.storeCredit || 0)), 0);
    const payable = asArray<PurchaseOrder>(safePurchaseOrders).reduce((s, p) => s + Math.max(0, Number(p.remainingAmount ?? Math.max(0, (p.totalAmount || 0) - (p.totalPaid || 0)))), 0);
    return { cash, bank, receivable, payable };
  }, [filtered, safeCustomers, safeTransactions, safePurchaseOrders]);

  useEffect(() => {
    setVisibleRowCount(35);
  }, [from, to, payFilter, typeFilter, search, sort]);

  const visibleRows = useMemo(() => asArray<Row>(filtered).slice(0, visibleRowCount), [filtered, visibleRowCount]);

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
          <tbody>{asArray<Row>(visibleRows).map(r=>{ runningCash += r.cashIn-r.cashOut; runningBank += r.bankIn-r.bankOut; return <tr key={r.id} className="border-b"><td>{new Date(r.date).toLocaleString()}</td><td>{r.type}</td><td>{r.description}</td><td>{r.payment}</td><td className="text-right text-emerald-700">{r.cashIn?fmt(r.cashIn):'-'}</td><td className="text-right text-red-600">{r.cashOut?fmt(r.cashOut):'-'}</td><td className="text-right text-blue-700">{r.bankIn?fmt(r.bankIn):'-'}</td><td className="text-right text-red-600">{r.bankOut?fmt(r.bankOut):'-'}</td>{full && <><td className="text-right text-orange-700">{r.receivableDelta?fmt(r.receivableDelta):'-'}</td><td className="text-right text-rose-700">{r.payableDelta?fmt(r.payableDelta):'-'}</td><td className="text-right">{fmt(runningCash)}</td><td className="text-right">{fmt(runningBank)}</td></>}</tr>})}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {Math.min(visibleRows.length, filtered.length)} of {filtered.length} entries</span>
        {filtered.length > visibleRowCount && (
          <button onClick={() => setVisibleRowCount((prev) => prev + 35)} className="border rounded px-3 py-1 text-foreground">Load More (35)</button>
        )}
      </div>
    </div>
  </div>;
}
