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
      sourceType: 'purchaseOrders',
    });
    if (partyCreditUsed > 0) {
      rows.push({
        id: `credit-used-${order.id}`,
        date: order.updatedAt || order.orderDate || order.createdAt,
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
        sourceType: 'purchaseOrders.paymentHistory',
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
        sourceType: 'purchaseOrders.paymentHistory',
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
      sourceType: 'supplierPayments',
    });
  });

  rows.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  let runningPayable = 0;
  let runningCredit = 0;
  const finalized = rows.map((row) => {
    runningPayable = Math.max(0, Number((runningPayable + row.payableIncrease - row.payableApplied).toFixed(2)));
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

  const remainingPayable = Math.max(0, Number((totalPurchase - payableApplied).toFixed(2)));
  const netPayable = Math.max(0, Number((remainingPayable - ourCredit).toFixed(2)));

  return {
    rows: finalized,
    summary: {
      totalPurchase: Number(totalPurchase.toFixed(2)),
      actualPayments: Number(actualPayments.toFixed(2)),
      payableApplied: Number(payableApplied.toFixed(2)),
      partyCreditCreated: Number(partyCreditCreated.toFixed(2)),
      partyCreditUsed: Number(partyCreditUsed.toFixed(2)),
      ourCredit,
      remainingPayable,
      netPayable,
    },
  };
};
