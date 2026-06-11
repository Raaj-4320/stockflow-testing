import { Customer, Transaction, UpfrontOrder } from '../types';
import { buildUpfrontOrderLedgerEffects, getCanonicalReturnAllocation, getHistoricalAwareSaleSettlement, getSaleSettlementBreakdown } from './storage';
import { normalizeTransactionItems } from '../utils/transactionItems';

export type EffectiveTransactionType = 'sale' | 'payment' | 'return' | 'customer_credit' | 'customer_cash_out' | 'unknown';

export type CorrectCustomerLedgerWarning = {
  code: string;
  message: string;
  transactionId?: string;
};

export type CorrectCustomerLedgerRow = {
  id: string;
  date: string;
  effectiveType: EffectiveTransactionType;
  originalType: string;
  referenceType: string;
  ref: string;
  description: string;
  saleTotal: number;
  paidNow: number;
  creditDue: number;
  paymentReceived: number;
  returnAmount: number;
  storeCreditUsed: number;
  storeCreditCreated: number;
  receivableImpact: number;
  runningDue: number;
  runningStoreCredit: number;
  netReceivable: number;
  warnings: string[];
};

export type CorrectCustomerLedgerPreview = {
  customer: Customer;
  rows: CorrectCustomerLedgerRow[];
  summary: {
    storedCurrentDue: number;
    storedStoreCredit: number;
    storedNetReceivable: number;
    correctedCurrentDue: number;
    correctedStoreCredit: number;
    correctedNetReceivable: number;
    difference: number;
    warningCount: number;
    historicalPaymentsCorrected: number;
  };
  warnings: CorrectCustomerLedgerWarning[];
};

const roundMoney = (value: unknown): number => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const positiveMoney = (value: unknown): number => Math.max(0, roundMoney(value));

const normalizeKind = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

const getEventTime = (event: { date?: string; id?: string }): number => {
  const parsed = event.date ? new Date(event.date).getTime() : Number.NaN;
  if (Number.isFinite(parsed)) return parsed;
  const idNum = Number(String(event.id || '').replace(/\D/g, '').slice(0, 13));
  return Number.isFinite(idNum) ? idNum : 0;
};

const getLineProductName = (item: any): string => {
  const raw = item?.productName || item?.name || item?.itemName || item?.medicineName || item?.title || item?.sku || item?.barcode || '';
  return String(raw || '').trim() || 'Unknown Product';
};

const getProductSummary = (tx: Transaction): string => {
  const items = normalizeTransactionItems((tx as any)?.items);
  if (!items.length) return 'No product details';
  return Array.from(new Set(items.map((item: any) => getLineProductName(item)))).slice(0, 2).join(', ');
};

export const getEffectiveTransactionType = (tx: Transaction): EffectiveTransactionType => {
  const originalType = normalizeKind(tx.type);
  const referenceType = normalizeKind((tx as any).referenceTransactionType);

  if (originalType === 'historical reference') {
    if (referenceType === 'payment' || referenceType === 'credit received' || referenceType === 'receipt') return 'payment';
    if (referenceType === 'sale' || referenceType === 'sell') return 'sale';
    if (referenceType === 'return' || referenceType === 'sales return') return 'return';
    return 'unknown';
  }

  if (originalType === 'sale') return 'sale';
  if (originalType === 'payment') return 'payment';
  if (originalType === 'return') return 'return';
  if (originalType === 'customer credit') return 'customer_credit';
  if (originalType === 'customer cash out') return 'customer_cash_out';
  return 'unknown';
};

export const buildCorrectCustomerLedgerPreview = (
  customer: Customer,
  transactions: Transaction[],
  upfrontOrders: UpfrontOrder[] = []
): CorrectCustomerLedgerPreview => {
  const warnings: CorrectCustomerLedgerWarning[] = [];
  const rows: CorrectCustomerLedgerRow[] = [];
  const customerTx = transactions.filter((tx) => tx.customerId === customer.id);
  const upfrontEffects = buildUpfrontOrderLedgerEffects(upfrontOrders.filter((order) => order.customerId === customer.id), [customer])
    .filter((effect) => effect.type !== 'legacy_custom_order_info');
  const events = [
    ...customerTx.map((tx) => ({ kind: 'transaction' as const, id: tx.id, date: tx.date, priority: getEffectiveTransactionType(tx) === 'sale' ? 2 : getEffectiveTransactionType(tx) === 'return' ? 3 : 4, tx })),
    ...upfrontEffects.map((effect) => ({ kind: 'upfront' as const, id: effect.id, date: effect.date, priority: effect.type === 'custom_order_receivable' ? 0 : 1, effect })),
  ].sort((a, b) => getEventTime(a) - getEventTime(b) || a.priority - b.priority || String(a.id).localeCompare(String(b.id)));

  let runningDue = 0;
  let runningStoreCredit = 0;
  let historicalPaymentsCorrected = 0;
  const processed: Transaction[] = [];

  const pushWarning = (code: string, message: string, transactionId?: string) => {
    warnings.push({ code, message, transactionId });
    return message;
  };

  events.forEach((event) => {
    const rowWarnings: string[] = [];
    if (event.kind === 'upfront') {
      const effect = event.effect;
      const receivableIncrease = positiveMoney(effect.receivableIncrease);
      const paymentAmount = positiveMoney(effect.receivableDecrease);
      let impact = 0;
      let storeCreditCreated = 0;
      if (effect.type === 'custom_order_receivable') {
        impact = receivableIncrease;
        runningDue = roundMoney(runningDue + receivableIncrease);
      } else {
        const applied = Math.min(runningDue, paymentAmount);
        impact = -applied;
        storeCreditCreated = roundMoney(Math.max(0, paymentAmount - applied));
        runningDue = roundMoney(Math.max(0, runningDue - applied));
        runningStoreCredit = roundMoney(runningStoreCredit + storeCreditCreated);
      }
      rows.push({
        id: effect.id,
        date: effect.date,
        effectiveType: effect.type === 'custom_order_receivable' ? 'sale' : 'payment',
        originalType: 'upfront_order',
        referenceType: effect.type,
        ref: effect.orderId.slice(-6),
        description: effect.description || effect.productName || 'Custom order ledger effect',
        saleTotal: effect.type === 'custom_order_receivable' ? receivableIncrease : 0,
        paidNow: 0,
        creditDue: effect.type === 'custom_order_receivable' ? receivableIncrease : 0,
        paymentReceived: effect.type === 'custom_order_payment' ? paymentAmount : 0,
        returnAmount: 0,
        storeCreditUsed: 0,
        storeCreditCreated,
        receivableImpact: impact,
        runningDue: roundMoney(runningDue),
        runningStoreCredit: roundMoney(runningStoreCredit),
        netReceivable: roundMoney(Math.max(0, runningDue - runningStoreCredit)),
        warnings: rowWarnings,
      });
      return;
    }

    const tx = event.tx;
    const effectiveType = getEffectiveTransactionType(tx);
    const originalType = String(tx.type || '');
    const referenceType = String((tx as any).referenceTransactionType || '');
    const amount = positiveMoney(Math.abs(Number(tx.total || 0)));
    const ref = (tx as any).invoiceNo || (tx as any).receiptNo || (tx as any).creditNoteNo || tx.id.slice(-6);

    if (tx.type === 'historical_reference' && !referenceType) {
      rowWarnings.push(pushWarning('historical_reference_missing_reference_type', `Historical row ${tx.id.slice(-6)} is missing referenceTransactionType; it is not assumed to be a sale.`, tx.id));
    }

    if (tx.type === 'historical_reference' && effectiveType === 'payment') {
      historicalPaymentsCorrected += 1;
    }

    if (effectiveType === 'sale') {
      const settlement = tx.type === 'historical_reference' ? getHistoricalAwareSaleSettlement(tx) : getSaleSettlementBreakdown(tx);
      const saleTotal = amount;
      const paidNow = positiveMoney(settlement.cashPaid + settlement.onlinePaid);
      const creditDue = positiveMoney(settlement.creditDue);
      const requestedStoreCreditUsed = positiveMoney(tx.storeCreditUsed);
      const storeCreditUsed = Math.min(requestedStoreCreditUsed, runningStoreCredit, saleTotal);
      const storeCreditCreated = positiveMoney(tx.storeCreditCreated);
      if (requestedStoreCreditUsed > runningStoreCredit + 0.01) {
        rowWarnings.push(pushWarning('store_credit_used_more_than_available', `Store credit used ${requestedStoreCreditUsed} is more than available ${runningStoreCredit}.`, tx.id));
      }
      runningStoreCredit = roundMoney(Math.max(0, runningStoreCredit - storeCreditUsed) + storeCreditCreated);
      runningDue = roundMoney(runningDue + creditDue);
      rows.push({
        id: tx.id,
        date: tx.date,
        effectiveType,
        originalType,
        referenceType,
        ref,
        description: `${getProductSummary(tx)} • Sale impacts receivable by credit due only.`,
        saleTotal,
        paidNow,
        creditDue,
        paymentReceived: 0,
        returnAmount: 0,
        storeCreditUsed,
        storeCreditCreated,
        receivableImpact: creditDue,
        runningDue: roundMoney(runningDue),
        runningStoreCredit: roundMoney(runningStoreCredit),
        netReceivable: roundMoney(Math.max(0, runningDue - runningStoreCredit)),
        warnings: rowWarnings,
      });
      processed.push(tx);
      return;
    }

    if (effectiveType === 'payment') {
      const applied = Math.min(runningDue, amount);
      const storeCreditCreated = roundMoney(Math.max(0, amount - applied));
      const savedApplied = positiveMoney((tx as any).paymentAppliedToReceivable);
      if (amount > runningDue + 0.01) {
        rowWarnings.push(pushWarning('payment_received_more_than_running_due', `Payment ${amount} is more than running due ${runningDue}; excess becomes store credit.`, tx.id));
      }
      if (savedApplied > runningDue + 0.01) {
        rowWarnings.push(pushWarning('payment_applied_more_than_running_due', `Saved payment applied ${savedApplied} is more than running due ${runningDue}; preview caps it to available due.`, tx.id));
      }
      runningDue = roundMoney(Math.max(0, runningDue - applied));
      runningStoreCredit = roundMoney(runningStoreCredit + storeCreditCreated);
      rows.push({
        id: tx.id,
        date: tx.date,
        effectiveType,
        originalType,
        referenceType,
        ref,
        description: tx.type === 'historical_reference' ? 'Historical payment classified by referenceTransactionType.' : `${tx.paymentMethod || 'Cash'} payment; excess becomes store credit.`,
        saleTotal: 0,
        paidNow: 0,
        creditDue: 0,
        paymentReceived: amount,
        returnAmount: 0,
        storeCreditUsed: 0,
        storeCreditCreated,
        receivableImpact: -applied,
        runningDue: roundMoney(runningDue),
        runningStoreCredit: roundMoney(runningStoreCredit),
        netReceivable: roundMoney(Math.max(0, runningDue - runningStoreCredit)),
        warnings: rowWarnings,
      });
      processed.push(tx);
      return;
    }

    if (effectiveType === 'return') {
      const allocation = getCanonicalReturnAllocation(tx, processed, runningDue);
      const returnAmount = amount;
      const dueReduction = Math.min(runningDue, positiveMoney(allocation.dueReduction || returnAmount));
      const storeCreditCreated = positiveMoney(allocation.storeCreditIncrease);
      runningDue = roundMoney(Math.max(0, runningDue - dueReduction));
      runningStoreCredit = roundMoney(runningStoreCredit + storeCreditCreated);
      rows.push({
        id: tx.id,
        date: tx.date,
        effectiveType,
        originalType,
        referenceType,
        ref,
        description: `${getProductSummary(tx)} • Return reduces receivable by due reduction.`,
        saleTotal: 0,
        paidNow: 0,
        creditDue: 0,
        paymentReceived: 0,
        returnAmount,
        storeCreditUsed: 0,
        storeCreditCreated,
        receivableImpact: -dueReduction,
        runningDue: roundMoney(runningDue),
        runningStoreCredit: roundMoney(runningStoreCredit),
        netReceivable: roundMoney(Math.max(0, runningDue - runningStoreCredit)),
        warnings: rowWarnings,
      });
      processed.push(tx);
      return;
    }

    if (effectiveType === 'customer_credit' || effectiveType === 'customer_cash_out') {
      const requestedStoreCreditUsed = effectiveType === 'customer_cash_out' ? positiveMoney((tx as any).storeCreditUsed || amount) : 0;
      const storeCreditUsed = Math.min(requestedStoreCreditUsed, runningStoreCredit, amount);
      const receivableIncrease = effectiveType === 'customer_credit' ? amount : Math.max(0, amount - storeCreditUsed);
      if (requestedStoreCreditUsed > runningStoreCredit + 0.01) {
        rowWarnings.push(pushWarning('store_credit_used_more_than_available', `Store credit used ${requestedStoreCreditUsed} is more than available ${runningStoreCredit}.`, tx.id));
      }
      runningStoreCredit = roundMoney(Math.max(0, runningStoreCredit - storeCreditUsed));
      runningDue = roundMoney(runningDue + receivableIncrease);
      rows.push({
        id: tx.id,
        date: tx.date,
        effectiveType,
        originalType,
        referenceType,
        ref,
        description: effectiveType === 'customer_credit' ? 'Manual customer receivable increase.' : 'Cash given to customer; store credit used first.',
        saleTotal: 0,
        paidNow: 0,
        creditDue: effectiveType === 'customer_credit' ? amount : 0,
        paymentReceived: 0,
        returnAmount: 0,
        storeCreditUsed,
        storeCreditCreated: 0,
        receivableImpact: receivableIncrease,
        runningDue: roundMoney(runningDue),
        runningStoreCredit: roundMoney(runningStoreCredit),
        netReceivable: roundMoney(Math.max(0, runningDue - runningStoreCredit)),
        warnings: rowWarnings,
      });
      return;
    }

    rowWarnings.push(pushWarning('unknown_effective_transaction_type', `Transaction ${tx.id.slice(-6)} has unknown effective transaction type and is ignored in corrected totals.`, tx.id));
    rows.push({
      id: tx.id,
      date: tx.date,
      effectiveType,
      originalType,
      referenceType,
      ref,
      description: 'Unknown transaction type; no accounting impact in corrected preview.',
      saleTotal: 0,
      paidNow: 0,
      creditDue: 0,
      paymentReceived: 0,
      returnAmount: 0,
      storeCreditUsed: 0,
      storeCreditCreated: 0,
      receivableImpact: 0,
      runningDue: roundMoney(runningDue),
      runningStoreCredit: roundMoney(runningStoreCredit),
      netReceivable: roundMoney(Math.max(0, runningDue - runningStoreCredit)),
      warnings: rowWarnings,
    });
  });

  const storedCurrentDue = positiveMoney(customer.totalDue);
  const storedStoreCredit = positiveMoney(customer.storeCredit);
  const storedNetReceivable = roundMoney(Math.max(0, storedCurrentDue - storedStoreCredit));
  const correctedCurrentDue = roundMoney(Math.max(0, runningDue));
  const correctedStoreCredit = roundMoney(Math.max(0, runningStoreCredit));
  const correctedNetReceivable = roundMoney(Math.max(0, correctedCurrentDue - correctedStoreCredit));
  const difference = roundMoney(correctedNetReceivable - storedNetReceivable);

  if (Math.abs(storedCurrentDue - correctedCurrentDue) > 0.01) {
    warnings.push({
      code: 'stored_customer_due_differs_from_corrected_due',
      message: `Stored customer due ${storedCurrentDue} differs from corrected due ${correctedCurrentDue}.`,
    });
  }
  if (Math.abs(storedStoreCredit - correctedStoreCredit) > 0.01) {
    warnings.push({
      code: 'stored_customer_store_credit_differs_from_corrected_store_credit',
      message: `Stored store credit ${storedStoreCredit} differs from corrected store credit ${correctedStoreCredit}.`,
    });
  }

  return {
    customer,
    rows,
    summary: {
      storedCurrentDue,
      storedStoreCredit,
      storedNetReceivable,
      correctedCurrentDue,
      correctedStoreCredit,
      correctedNetReceivable,
      difference,
      warningCount: warnings.length,
      historicalPaymentsCorrected,
    },
    warnings,
  };
};
