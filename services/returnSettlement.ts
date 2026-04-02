import { Transaction } from '../types';

export type ReturnSettlementMode = 'cash_refund' | 'online_refund' | 'due_adjustment';

export const getReturnSettlementMode = (tx: Pick<Transaction, 'type' | 'paymentMethod' | 'returnSettlementMode'>): ReturnSettlementMode | undefined => {
  if (tx.type !== 'return') return undefined;
  if (tx.returnSettlementMode === 'cash_refund' || tx.returnSettlementMode === 'online_refund' || tx.returnSettlementMode === 'due_adjustment') {
    return tx.returnSettlementMode;
  }

  // Backward compatibility for legacy return rows that only had paymentMethod.
  if (tx.paymentMethod === 'Credit') return 'due_adjustment';
  if (tx.paymentMethod === 'Online') return 'online_refund';
  return 'cash_refund';
};

export const isDueAdjustmentReturn = (tx: Pick<Transaction, 'type' | 'paymentMethod' | 'returnSettlementMode'>): boolean =>
  getReturnSettlementMode(tx) === 'due_adjustment';

export const isCashRefundReturn = (tx: Pick<Transaction, 'type' | 'paymentMethod' | 'returnSettlementMode'>): boolean =>
  getReturnSettlementMode(tx) === 'cash_refund';

export type PaymentDirection = 'collection' | 'refund';

export const getPaymentDirection = (tx: Pick<Transaction, 'type' | 'paymentDirection'>): PaymentDirection => {
  if (tx.type !== 'payment') return 'collection';
  return tx.paymentDirection === 'refund' ? 'refund' : 'collection';
};

export const isPaymentRefund = (tx: Pick<Transaction, 'type' | 'paymentDirection'>): boolean =>
  tx.type === 'payment' && getPaymentDirection(tx) === 'refund';
