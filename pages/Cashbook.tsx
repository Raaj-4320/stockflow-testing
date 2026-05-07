import React, { useEffect, useMemo, useState } from 'react';
import { loadData, getSaleSettlementBreakdown, getCanonicalCustomerBalanceSnapshot } from '../services/storage';
import { CashAdjustment, Expense, PurchaseOrder, Transaction } from '../types';

type LedgerType = 'sale' | 'payment' | 'purchase' | 'supplier_payment' | 'expense' | 'return' | 'adjustment' | 'credit';
type PayType = 'cash' | 'online' | 'credit' | 'mixed' | 'na';

type Row = {
  id: string; date: string; type: LedgerType; description: string; reference: string; party: string; payment: PayType;
  cashIn: number; cashOut: number; bankIn: number; bankOut: number;
  receivableIncrease: number; receivableDecrease: number; payableIncrease: number; payableDecrease: number;
  storeCreditIncrease: number; storeCreditDecrease: number;
};

const fmt = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asPlainObject = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const toNum = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

const getCashbookReference = (tx: any) => [tx?.invoiceNo, tx?.receiptNo, tx?.billNo, tx?.reference, tx?.orderId, tx?.id].find((v) => typeof v === 'string' && v.trim()) || String(tx?.id || '').slice(-6) || 'UNKNOWN';
const getCashbookCustomerName = (tx: any, customerMap: Map<string, string>) => customerMap.get(tx?.customerId) || tx?.customerName || tx?.customer?.name || tx?.customerPhone || 'Walk-in Customer';
const getCashbookPaymentMethod = (tx: any): PayType => {
  const m = String(tx?.paymentMethod || tx?.paymentDetails?.method || tx?.method || tx?.mode || '').toLowerCase();
  if (m.includes('cash')) return 'cash';
  if (m.includes('online') || m.includes('bank') || m.includes('upi') || m.includes('card')) return 'online';
  if (m.includes('credit') || m.includes('due') || m.includes('store')) return 'credit';
  return 'na';
};
const getCashbookMoney = (tx: any, candidates: string[]) => candidates.map((k) => toNum(tx?.[k])).find((v) => v > 0) || 0;

const getCashbookSaleBreakdown = (tx: Transaction, txAny: any) => {
  const s = getSaleSettlementBreakdown(tx);
  if (s.cashPaid + s.onlinePaid + s.creditDue > 0) return s;
  const method = getCashbookPaymentMethod(txAny);
  const total = getCashbookMoney(txAny, ['total', 'amount', 'grandTotal']) || Math.max(0, toNum(txAny?.subtotal) + toNum(txAny?.tax) - toNum(txAny?.discount));
  if (method === 'cash') return { cashPaid: total, onlinePaid: 0, creditDue: 0 };
  if (method === 'online') return { cashPaid: 0, onlinePaid: total, creditDue: 0 };
  if (method === 'credit') return { cashPaid: 0, onlinePaid: 0, creditDue: total };
  return { cashPaid: 0, onlinePaid: 0, creditDue: 0 };
};

const getCashbookReturnBreakdown = (txAny: any) => {
  const amount = getCashbookMoney(txAny, ['refundAmount', 'returnTotal', 'amount', 'total']);
  const mode = String(txAny?.returnHandlingMode || '').toLowerCase();
  const method = getCashbookPaymentMethod(txAny);
  const storeCreditCreated = Math.max(0, toNum(txAny?.storeCreditCreated));
  if (mode === 'reduce_due') return { cashOut: 0, bankOut: 0, receivableDecrease: amount, storeCreditIncrease: 0, payment: 'credit' as PayType };
  if (mode === 'store_credit') return { cashOut: 0, bankOut: 0, receivableDecrease: 0, storeCreditIncrease: Math.max(amount, storeCreditCreated), payment: 'credit' as PayType };
  if (method === 'cash' || mode === 'refund_cash') return { cashOut: amount, bankOut: 0, receivableDecrease: 0, storeCreditIncrease: storeCreditCreated, payment: 'cash' as PayType };
  if (method === 'online' || mode === 'refund_online') return { cashOut: 0, bankOut: amount, receivableDecrease: 0, storeCreditIncrease: storeCreditCreated, payment: 'online' as PayType };
  // credit/unknown returns should not hit cash/bank
  return { cashOut: 0, bankOut: 0, receivableDecrease: amount, storeCreditIncrease: storeCreditCreated, payment: method === 'credit' ? 'credit' as PayType : 'na' as PayType };
};


const detectCashbookTransactionType = (txAny: any): 'sale' | 'payment' | 'return' | 'unknown' => {
  const t = String(txAny?.type || txAny?.transactionType || '').toLowerCase();
  if (t === 'sale' || t === 'historical_reference') return 'sale';
  if (t === 'payment') return 'payment';
  if (t === 'return') return 'return';
  const hasRefundHint = toNum(txAny?.refundAmount || txAny?.returnTotal) > 0 || Array.isArray(txAny?.returnItems);
  if (hasRefundHint || String(txAny?.returnHandlingMode || '').toLowerCase().includes('refund')) return 'return';
  const method = getCashbookPaymentMethod(txAny);
  const hasItems = Array.isArray(txAny?.items) && txAny.items.length > 0;
  const hasTotal = getCashbookMoney(txAny, ['total', 'amount', 'grandTotal']) > 0;
  if (method !== 'na' && !hasItems && hasTotal) return 'payment';
  if (hasItems || hasTotal) return 'sale';
  return 'unknown';
};

const normalizeTransactionForCashbook = (tx: Transaction, customerMap: Map<string, string>): Row => {
  const txAny = tx as any;
  const reference = getCashbookReference(txAny);
  const party = getCashbookCustomerName(txAny, customerMap);
  const date = tx.date || txAny.createdAt || txAny.updatedAt || '';

  const normalizedType = detectCashbookTransactionType(txAny);

  if (normalizedType === 'sale') {
    const s = getCashbookSaleBreakdown(tx, txAny);
    const pay = getCashbookPaymentMethod(txAny);
    const payment: PayType = s.cashPaid > 0 && s.onlinePaid > 0 ? 'mixed' : (s.creditDue > 0 && s.cashPaid === 0 && s.onlinePaid === 0 ? 'credit' : (pay === 'na' ? (s.cashPaid > 0 ? 'cash' : s.onlinePaid > 0 ? 'online' : 'credit') : pay));
    return { id: `tx-${tx.id}`, date, type: s.creditDue > 0 ? 'credit' : 'sale', description: `Sale Invoice #${reference} — ${party}`, reference, party, payment,
      cashIn: s.cashPaid, cashOut: 0, bankIn: s.onlinePaid, bankOut: 0,
      receivableIncrease: s.creditDue, receivableDecrease: 0, payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: 0, storeCreditDecrease: Math.max(0, toNum(txAny?.storeCreditUsed)) };
  }
  if (normalizedType === 'payment') {
    const amount = getCashbookMoney(txAny, ['paidAmount', 'paymentAmount', 'amount', 'total']);
    const payment = getCashbookPaymentMethod(txAny);
    return { id: `tx-${tx.id}`, date, type: 'payment', description: `Payment Receipt #${reference} — ${party}`, reference, party, payment,
      cashIn: payment === 'cash' ? amount : 0, cashOut: 0, bankIn: payment === 'online' ? amount : 0, bankOut: 0,
      receivableIncrease: 0, receivableDecrease: amount, payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: Math.max(0, toNum(txAny?.storeCreditCreated)), storeCreditDecrease: 0 };
  }
  if (normalizedType === 'return') {
    const r = getCashbookReturnBreakdown(txAny);
    return { id: `tx-${tx.id}`, date, type: 'return', description: `Return/Refund #${reference} — ${party}`, reference, party, payment: r.payment,
    cashIn: 0, cashOut: r.cashOut, bankIn: 0, bankOut: r.bankOut,
    receivableIncrease: 0, receivableDecrease: r.receivableDecrease, payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: r.storeCreditIncrease, storeCreditDecrease: 0 };
  }
  return { id: `tx-${tx.id}`, date, type: 'adjustment', description: `Transaction #${reference} — ${party}`, reference, party, payment: 'na', cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0, receivableIncrease: 0, receivableDecrease: 0, payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: 0, storeCreditDecrease: 0 };
};

export default function Cashbook() {
  const data = useMemo(() => loadData(), []);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [payFilter, setPayFilter] = useState<'all' | 'cash' | 'online' | 'credit'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LedgerType>('all');
  const [search, setSearch] = useState(''); const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [full, setFull] = useState(false); const [visibleRowCount, setVisibleRowCount] = useState(100);

  const safeTransactions = asArray<Transaction>(data.transactions);
  const safePurchaseOrders = asArray<PurchaseOrder>(data.purchaseOrders);
  const safeExpenses = asArray<Expense>(data.expenses);
  const safeCashAdjustments = asArray<CashAdjustment>(data.cashAdjustments);
  const safeDeleteCompensations = asArray<any>(data.deleteCompensations);
  const safeUpdatedTransactionEvents = asArray<any>(data.updatedTransactionEvents);
  const safeCustomers = asArray<any>(data.customers);
  const customerMap = useMemo(() => new Map(safeCustomers.map((c) => [c.id, c.name || ''])), [safeCustomers]);

  const rows = useMemo(() => {
    const txRows = safeTransactions.map((tx) => normalizeTransactionForCashbook(tx, customerMap));
    const purchaseRows: Row[] = safePurchaseOrders.flatMap((po) => {
      const base: Row = { id: `po-${po.id}`, date: po.orderDate || po.createdAt, type: 'purchase', description: `Purchase #${po.id.slice(-6)} — ${po.partyName}`, reference: po.billNumber || po.id, party: po.partyName, payment: 'credit',
        cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0, receivableIncrease: 0, receivableDecrease: 0, payableIncrease: Math.max(0, Number(po.totalAmount || 0)), payableDecrease: 0, storeCreditIncrease: 0, storeCreditDecrease: 0 };
      const pays = asArray<any>(asPlainObject(po).paymentHistory).map((p) => ({ id: `pop-${po.id}-${p.id}`, date: p.paidAt, type: 'supplier_payment' as LedgerType, description: `Supplier Payment #${p.id.slice(-6)} — ${po.partyName}`, reference: po.id, party: po.partyName,
        payment: p.method === 'online' ? 'online' as PayType : 'cash' as PayType, cashIn: 0, cashOut: p.method === 'online' ? 0 : p.amount, bankIn: 0, bankOut: p.method === 'online' ? p.amount : 0,
        receivableIncrease: 0, receivableDecrease: 0, payableIncrease: 0, payableDecrease: Math.abs(p.amount), storeCreditIncrease: 0, storeCreditDecrease: 0 }));
      return [base, ...pays];
    });
    const expenseRows: Row[] = safeExpenses.map((e) => ({ id: `exp-${e.id}`, date: e.createdAt, type: 'expense', description: `Expense — ${e.title}`, reference: e.id, party: e.category || '-', payment: 'cash',
      cashIn: 0, cashOut: Math.abs(e.amount || 0), bankIn: 0, bankOut: 0, receivableIncrease: 0, receivableDecrease: 0, payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: 0, storeCreditDecrease: 0 }));
    const adjRows: Row[] = safeCashAdjustments.map((a) => ({ id: `adj-${a.id}`, date: a.createdAt, type: 'adjustment', description: a.type === 'cash_addition' ? `Manual Cash Added — ${a.note || ''}` : `Manual Cash Withdrawn — ${a.note || ''}`,
      reference: a.id, party: '-', payment: 'cash', cashIn: a.type === 'cash_addition' ? a.amount : 0, cashOut: a.type === 'cash_withdrawal' ? a.amount : 0, bankIn: 0, bankOut: 0,
      receivableIncrease: 0, receivableDecrease: 0, payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: 0, storeCreditDecrease: 0 }));
    const corrRows: Row[] = [
      ...safeDeleteCompensations.map((c) => ({ id: `dc-${c.id}`, date: c.createdAt, type: 'adjustment' as LedgerType, description: `Delete compensation — ${c.customerName || 'Customer'}`, reference: c.transactionId, party: c.customerName || '-', payment: 'cash' as PayType,
        cashIn: 0, cashOut: c.amount, bankIn: 0, bankOut: 0, receivableIncrease: 0, receivableDecrease: 0, payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: 0, storeCreditDecrease: 0 })),
      ...safeUpdatedTransactionEvents.map((u) => ({ id: `ute-${u.id}`, date: u.updatedAt, type: 'adjustment' as LedgerType, description: `Transaction edit correction — ${u.customerName || u.updatedTransactionId?.slice?.(-6) || ''}`, reference: u.originalTransactionId, party: u.customerName || '-', payment: 'na' as PayType,
        cashIn: Math.max(0, toNum(u.cashbookDelta?.cashIn)), cashOut: Math.max(0, toNum(u.cashbookDelta?.cashOut)), bankIn: Math.max(0, toNum(u.cashbookDelta?.onlineIn)), bankOut: Math.max(0, toNum(u.cashbookDelta?.onlineOut)),
        receivableIncrease: Math.max(0, toNum(u.cashbookDelta?.currentDueEffect)), receivableDecrease: Math.max(0, -toNum(u.cashbookDelta?.currentDueEffect)), payableIncrease: 0, payableDecrease: 0, storeCreditIncrease: Math.max(0, toNum(u.cashbookDelta?.currentStoreCreditEffect)), storeCreditDecrease: Math.max(0, -toNum(u.cashbookDelta?.currentStoreCreditEffect)) })),
    ];
    return [...txRows, ...purchaseRows, ...expenseRows, ...adjRows, ...corrRows].filter((r) => !!r.date && (r.cashIn || r.cashOut || r.bankIn || r.bankOut || r.receivableIncrease || r.receivableDecrease || r.payableIncrease || r.payableDecrease || r.storeCreditIncrease || r.storeCreditDecrease));
  }, [safeTransactions, customerMap, safePurchaseOrders, safeExpenses, safeCashAdjustments, safeDeleteCompensations, safeUpdatedTransactionEvents]);

  const filtered = useMemo(() => asArray<Row>(rows).filter((r) => {
    const t = new Date(r.date).getTime(); if (from && t < new Date(`${from}T00:00:00`).getTime()) return false; if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
    if (payFilter !== 'all' && r.payment !== payFilter && !(payFilter === 'online' && r.payment === 'mixed')) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    const q = search.trim().toLowerCase(); if (!q) return true; return `${r.description} ${r.reference} ${r.party}`.toLowerCase().includes(q);
  }).sort((a, b) => sort === 'newest' ? new Date(b.date).getTime() - new Date(a.date).getTime() : new Date(a.date).getTime() - new Date(b.date).getTime()), [rows, from, to, payFilter, typeFilter, search, sort]);

  const kpi = useMemo(() => {
    const allRows = asArray<Row>(rows); // all-time, not filtered
    const cash = allRows.reduce((s, r) => s + r.cashIn - r.cashOut, 0);
    const bank = allRows.reduce((s, r) => s + r.bankIn - r.bankOut, 0);
    const canonicalSnapshot = asArray<any>(getCanonicalCustomerBalanceSnapshot(safeCustomers, safeTransactions));
    const balances = asPlainObject(canonicalSnapshot.balances);
    const receivable = safeCustomers.reduce((sum, c) => sum + Math.max(0, toNum((balances[c.id] as any)?.totalDue || 0)), 0);
    const payable = safePurchaseOrders.filter((p) => Math.max(0, toNum(p.remainingAmount || 0)) > 0).reduce((sum, p) => sum + Math.max(0, toNum(p.remainingAmount || 0)), 0);
    return { cash, bank, receivable, payable };
  }, [rows, safeCustomers, safeTransactions, safePurchaseOrders]);

  useEffect(() => setVisibleRowCount(100), [from, to, payFilter, typeFilter, search, sort]);
  const visibleRows = useMemo(() => asArray<Row>(filtered).slice(0, visibleRowCount), [filtered, visibleRowCount]);
  let runningCash = 0; let runningBank = 0;

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">Cashbook</h1><p className="text-sm text-muted-foreground">Track all cash and bank flows across your business.</p></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
      <div className="rounded border p-3 bg-emerald-50"><div>Net Cash Movement</div><div className="text-xl font-bold text-emerald-700">{fmt(kpi.cash)}</div></div>
      <div className="rounded border p-3 bg-blue-50"><div>Net Bank Movement</div><div className="text-xl font-bold text-blue-700">{fmt(kpi.bank)}</div></div>
      <div className="rounded border p-3 bg-orange-50"><div>Customer/Party Receivable</div><div className="text-xl font-bold text-orange-700">{fmt(kpi.receivable)}</div></div>
      <div className="rounded border p-3 bg-rose-50"><div>Customer/Party Payable</div><div className="text-xl font-bold text-rose-700">{fmt(kpi.payable)}</div></div>
    </div>
    <div className="rounded border p-3 space-y-3">
      <div className="grid md:grid-cols-6 gap-2">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-2 h-9" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded px-2 h-9" />
        <select value={payFilter} onChange={e => setPayFilter(e.target.value as any)} className="border rounded px-2 h-9"><option value="all">All Payment</option><option value="cash">Cash</option><option value="online">Bank/Online</option><option value="credit">Credit</option></select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="border rounded px-2 h-9"><option value="all">All Type</option><option value="sale">Sale</option><option value="payment">Payment</option><option value="purchase">Purchase</option><option value="supplier_payment">Supplier Payment</option><option value="expense">Expense</option><option value="return">Return</option><option value="adjustment">Adjustment</option><option value="credit">Credit</option></select>
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="border rounded px-2 h-9"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
        <button onClick={() => setFull(v => !v)} className="border rounded px-2 h-9">{full ? 'Compact columns' : 'Show full accountant columns'}</button>
      </div>
      <input placeholder="Search description/customer/party/reference" value={search} onChange={e => setSearch(e.target.value)} className="border rounded px-2 h-9 w-full" />
      <div className="overflow-auto"><table className="min-w-[1400px] w-full text-xs"><thead><tr className="text-left border-b"><th>Date</th><th>Type</th><th>Description</th><th>Payment</th><th className="text-right">Cash In</th><th className="text-right">Cash Out</th><th className="text-right">Bank In</th><th className="text-right">Bank Out</th><th className="text-right">Recv +</th><th className="text-right">Recv -</th><th className="text-right">Pay +</th><th className="text-right">Pay -</th><th className="text-right">SC +</th><th className="text-right">SC -</th><th className="text-right">Cash Bal</th><th className="text-right">Bank Bal</th></tr></thead><tbody>{visibleRows.map((r) => { runningCash += r.cashIn - r.cashOut; runningBank += r.bankIn - r.bankOut; return <tr key={r.id} className="border-b"><td>{new Date(r.date).toLocaleString()}</td><td>{r.type}</td><td>{r.description}</td><td>{r.payment}</td><td className="text-right text-emerald-700">{r.cashIn ? fmt(r.cashIn) : '-'}</td><td className="text-right text-red-600">{r.cashOut ? fmt(r.cashOut) : '-'}</td><td className="text-right text-blue-700">{r.bankIn ? fmt(r.bankIn) : '-'}</td><td className="text-right text-red-600">{r.bankOut ? fmt(r.bankOut) : '-'}</td><td className="text-right">{r.receivableIncrease ? fmt(r.receivableIncrease) : '-'}</td><td className="text-right">{r.receivableDecrease ? fmt(r.receivableDecrease) : '-'}</td><td className="text-right">{r.payableIncrease ? fmt(r.payableIncrease) : '-'}</td><td className="text-right">{r.payableDecrease ? fmt(r.payableDecrease) : '-'}</td><td className="text-right">{r.storeCreditIncrease ? fmt(r.storeCreditIncrease) : '-'}</td><td className="text-right">{r.storeCreditDecrease ? fmt(r.storeCreditDecrease) : '-'}</td><td className="text-right">{fmt(runningCash)}</td><td className="text-right">{fmt(runningBank)}</td></tr>; })}</tbody></table></div>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Showing {Math.min(visibleRows.length, filtered.length)} of {filtered.length} entries</span>{filtered.length > visibleRowCount && <button onClick={() => setVisibleRowCount((p) => p + 100)} className="border rounded px-3 py-1 text-foreground">Load More (100)</button>}</div>
    </div>
  </div>;
}
