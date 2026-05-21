import { PartyCreditLedgerEntry, PurchaseOrder, SupplierPaymentLedgerEntry } from '../types';

export type PurchasePartyLedgerRow = {
  id: string;
  date: string;
  type: 'purchase' | 'supplier_payment' | 'credit_used' | 'reversal' | 'legacy_payment';
  reference: string;
  description: string;
  payableIncrease: number;
  actualPayment: number;
  payableApplied: number;
  creditCreated: number;
  creditUsed: number;
  runningPayable: number;
  runningCredit: number;
  netPayable: number;
  sourceId?: string;
  sourceType?: string;
};

export const buildPurchasePartyLedger = ({
  partyId,
  purchaseOrders,
  supplierPayments,
  partyCreditLedger,
}: {
  partyId: string;
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPaymentLedgerEntry[];
  partyCreditLedger: PartyCreditLedgerEntry[];
}) => {
  const parseTimestampFromText = (value?: string) => {
    const text = String(value || '');
    const match = text.match(/(?:^|[^0-9])(1[0-9]{12})(?:[^0-9]|$)/);
    if (!match) return Number.NaN;
    const ts = Number(match[1]);
    return Number.isFinite(ts) ? ts : Number.NaN;
  };
  const parseTimestampFromDate = (value?: string) => {
    const ts = new Date(value || '').getTime();
    return Number.isFinite(ts) ? ts : Number.NaN;
  };
  const resolveEventTimeMs = (...candidates: Array<string | undefined>) => {
    for (const candidate of candidates) {
      const fromDate = parseTimestampFromDate(candidate);
      if (Number.isFinite(fromDate)) return fromDate;
      const fromId = parseTimestampFromText(candidate);
      if (Number.isFinite(fromId)) return fromId;
    }
    return 0;
  };

  const orders = (purchaseOrders || []).filter((o) => o.partyId === partyId && o.status !== 'cancelled');
  const directPayments = (supplierPayments || []).filter((p) => p.partyId === partyId && !p.deletedAt);
  const paymentIds = new Set(directPayments.map((p) => p.id));
  const rows: PurchasePartyLedgerRow[] = [];

  orders.forEach((order) => {
    const orderTotal = Math.max(0, Number(order.totalAmount || 0));
    const partyCreditUsed = Math.max(0, Number((order.paymentHistory || []).reduce((sum, ph: any) => {
      return String(ph.method || '').toLowerCase() === 'party_credit' ? sum + Math.max(0, Number(ph.amount || 0)) : sum;
    }, 0).toFixed(2)));
    rows.push({
      id: `po-${order.id}`,
      date: order.orderDate || order.createdAt,
      type: 'purchase',
      reference: order.billNumber || order.id,
      description: `Purchase ${order.billNumber || order.id}${partyCreditUsed > 0 ? ` • Credit used ₹${partyCreditUsed.toFixed(2)}` : ''}`,
      payableIncrease: orderTotal,
      actualPayment: 0,
      payableApplied: 0,
      creditCreated: 0,
      creditUsed: 0,
      runningPayable: 0,
      runningCredit: 0,
      netPayable: 0,
      sourceId: order.id,
      sourceType: `purchaseOrders|eventTimeMs:${resolveEventTimeMs(order.orderDate, order.createdAt, order.updatedAt, order.id)}`,
    });
    if (partyCreditUsed > 0) {
      const partyCreditEntries = (order.paymentHistory || []).filter((ph: any) => String(ph.method || '').toLowerCase() === 'party_credit');
      const creditDate = partyCreditEntries[partyCreditEntries.length - 1]?.paidAt
        || partyCreditEntries[partyCreditEntries.length - 1]?.date
        || partyCreditEntries[partyCreditEntries.length - 1]?.createdAt
        || partyCreditEntries[partyCreditEntries.length - 1]?.updatedAt
        || order.updatedAt || order.orderDate || order.createdAt;
      const creditId = partyCreditEntries[partyCreditEntries.length - 1]?.id || order.id;
      rows.push({
        id: `credit-used-${order.id}`,
        date: creditDate,
        type: 'credit_used',
        reference: order.billNumber || order.id,
        description: `Credit used on purchase ${order.billNumber || order.id}`,
        payableIncrease: 0,
        actualPayment: 0,
        payableApplied: 0,
        creditCreated: 0,
        creditUsed: partyCreditUsed,
        runningPayable: 0,
        runningCredit: 0,
        netPayable: 0,
        sourceId: order.id,
        sourceType: `purchaseOrders.paymentHistory|eventTimeMs:${resolveEventTimeMs(creditDate, creditId, order.updatedAt, order.id)}`,
      });
    }

    (order.paymentHistory || []).forEach((ph: any) => {
      if (String(ph.method || '').toLowerCase() === 'party_credit') return;
      if (ph.supplierPaymentId && paymentIds.has(ph.supplierPaymentId)) {
        if (import.meta.env.DEV) console.warn('[purchaseLedger] suppressed duplicate supplier payment history row', ph.supplierPaymentId);
        return;
      }
      const amount = Math.max(0, Number(ph.amount || 0));
      if (amount <= 0) return;
      rows.push({
        id: `legacy-${ph.id || `${order.id}-${ph.paidAt}`}`,
        date: ph.paidAt || order.updatedAt || order.createdAt,
        type: 'legacy_payment',
        reference: order.billNumber || order.id,
        description: `Legacy order payment ${ph.note || ''}`.trim(),
        payableIncrease: 0,
        actualPayment: amount,
        payableApplied: amount,
        creditCreated: 0,
        creditUsed: 0,
        runningPayable: 0,
        runningCredit: 0,
        netPayable: 0,
        sourceId: ph.id,
        sourceType: `purchaseOrders.paymentHistory|eventTimeMs:${resolveEventTimeMs(ph.paidAt, ph.date, ph.createdAt, ph.updatedAt, ph.id, order.updatedAt, order.id)}`,
      });
    });
  });

  directPayments.forEach((payment) => {
    const actual = Math.max(0, Number(payment.amount || 0));
    const payableApplied = Math.max(0, Number((payment.paymentAppliedToPayable ?? payment.payableApplied ?? 0) || 0));
    const cappedApplied = Math.min(actual, payableApplied);
    const creditCreated = Math.max(0, Number(payment.partyCreditCreated || Math.max(0, actual - cappedApplied)));
    rows.push({
      id: `sp-${payment.id}`,
      date: payment.paidAt || payment.createdAt,
      type: 'supplier_payment',
      reference: payment.voucherNo || payment.id,
      description: `Supplier payment ₹${actual.toFixed(2)} • Payable applied ₹${cappedApplied.toFixed(2)} • Credit created ₹${creditCreated.toFixed(2)}`,
      payableIncrease: 0,
      actualPayment: actual,
      payableApplied: cappedApplied,
      creditCreated,
      creditUsed: 0,
      runningPayable: 0,
      runningCredit: 0,
      netPayable: 0,
      sourceId: payment.id,
      sourceType: `supplierPayments|eventTimeMs:${resolveEventTimeMs(payment.paidAt, payment.createdAt, payment.updatedAt, payment.id, payment.voucherNo)}`,
    });
  });

  const typeOrder: Record<PurchasePartyLedgerRow['type'], number> = {
    purchase: 1,
    supplier_payment: 2,
    legacy_payment: 2,
    credit_used: 3,
    reversal: 4,
  };
  rows.sort((a, b) => {
    const at = resolveEventTimeMs(
      a.date,
      a.sourceType,
      a.sourceId,
      a.id,
    );
    const bt = resolveEventTimeMs(
      b.date,
      b.sourceType,
      b.sourceId,
      b.id,
    );
    if (at !== bt) return at - bt;
    const ao = typeOrder[a.type] || 99;
    const bo = typeOrder[b.type] || 99;
    if (ao !== bo) return ao - bo;
    return String(a.id).localeCompare(String(b.id));
  });

  let runningPayable = 0;
  let runningCredit = 0;
  const finalized = rows.map((row) => {
    runningPayable = Math.max(0, Number((runningPayable + row.payableIncrease - row.payableApplied - row.creditUsed).toFixed(2)));
    runningCredit = Math.max(0, Number((runningCredit + row.creditCreated - row.creditUsed).toFixed(2)));
    const netPayable = Math.max(0, Number((runningPayable - runningCredit).toFixed(2)));
    return { ...row, runningPayable, runningCredit, netPayable };
  });

  const totalPurchase = finalized.reduce((s, r) => s + r.payableIncrease, 0);
  const actualPayments = finalized.reduce((s, r) => s + r.actualPayment, 0);
  const payableApplied = finalized.reduce((s, r) => s + r.payableApplied, 0);
  const partyCreditCreated = finalized.reduce((s, r) => s + r.creditCreated, 0);
  const partyCreditUsed = finalized.reduce((s, r) => s + r.creditUsed, 0);
  const ourCredit = Math.max(0, Number((partyCreditLedger || [])
    .filter((entry) => entry.partyId === partyId)
    .reduce((s, e) => s + Math.max(0, Number(e.remainingAmount || 0)), 0).toFixed(2)));

  const remainingPayable = Number((finalized[finalized.length - 1]?.runningPayable || 0).toFixed(2));
  const derivedOurCredit = Number((finalized[finalized.length - 1]?.runningCredit || 0).toFixed(2));
  const netPayable = Number((finalized[finalized.length - 1]?.netPayable || 0).toFixed(2));

  if (import.meta.env.DEV && partyCreditUsed > partyCreditCreated + 0.01) {
    console.warn('[purchaseLedger] credit used exceeds available credit', {
      partyId,
      partyCreditUsed: Number(partyCreditUsed.toFixed(2)),
      partyCreditCreated: Number(partyCreditCreated.toFixed(2)),
    });
  }

  return {
    rows: finalized,
    summary: {
      totalPurchase: Number(totalPurchase.toFixed(2)),
      actualPayments: Number(actualPayments.toFixed(2)),
      payableApplied: Number(payableApplied.toFixed(2)),
      partyCreditCreated: Number(partyCreditCreated.toFixed(2)),
      partyCreditUsed: Number(partyCreditUsed.toFixed(2)),
      ourCredit: derivedOurCredit,
      remainingPayable,
      netPayable,
    },
  };
};
