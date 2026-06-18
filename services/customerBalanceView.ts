import { Customer, Transaction, UpfrontOrder } from '../types';
import { buildCorrectCustomerLedgerPreview } from './customerLedger';

export type CanonicalBalanceStatus = 'ok' | 'error';

export type CanonicalCustomerBalanceResult = {
  customerId: string;
  status: CanonicalBalanceStatus;
  currentDue: number;
  storeCredit: number;
  netReceivable: number;
  errorMessage?: string;
  usedFallback: boolean;
  snapshotDue: number;
  snapshotStoreCredit: number;
};

const toSafe = (value: unknown) => Math.max(0, Number(value || 0));
const emptyError = (customerId = '', errorMessage = 'Ledger calculation unavailable'): CanonicalCustomerBalanceResult => ({
  customerId,
  status: 'error',
  currentDue: 0,
  storeCredit: 0,
  netReceivable: 0,
  errorMessage,
  usedFallback: false,
  snapshotDue: 0,
  snapshotStoreCredit: 0,
});

export const getCanonicalCustomerBalanceResult = (
  customer: Customer | null | undefined,
  transactions: Transaction[],
  upfrontOrders: UpfrontOrder[] = [],
): CanonicalCustomerBalanceResult => {
  if (!customer?.id) return emptyError('', 'Customer not available for ledger calculation.');
  const snapshotDue = toSafe(customer.totalDue);
  const snapshotStoreCredit = toSafe(customer.storeCredit);
  try {
    const preview = buildCorrectCustomerLedgerPreview(customer, transactions, upfrontOrders);
    const currentDue = toSafe(preview.summary.correctedCurrentDue);
    const storeCredit = toSafe(preview.summary.correctedStoreCredit);
    const netReceivable = toSafe(preview.summary.correctedNetReceivable);
    return {
      customerId: customer.id,
      status: 'ok',
      currentDue,
      storeCredit,
      netReceivable,
      usedFallback: false,
      snapshotDue,
      snapshotStoreCredit,
    };
  } catch (error) {
    return {
      customerId: customer.id,
      status: 'error',
      currentDue: 0,
      storeCredit: 0,
      netReceivable: 0,
      errorMessage: error instanceof Error ? error.message : 'Ledger calculation unavailable.',
      usedFallback: false,
      snapshotDue,
      snapshotStoreCredit,
    };
  }
};

export const assertCanonicalBalanceErrorDoesNotTrustSnapshot = (): boolean => {
  const result = emptyError('sample-customer', 'Forced ledger failure');
  return result.status === 'error' && result.currentDue === 0 && result.usedFallback === false;
};

// Backward-compatible aliases for older callers. These return only canonical values;
// on replay errors they intentionally return 0 instead of snapshot balances.
export type CustomerBalanceView = CanonicalCustomerBalanceResult;
export const getCanonicalCustomerBalanceView = (
  customer: Customer | null | undefined,
  _customers: Customer[],
  transactions: Transaction[],
  upfrontOrders: UpfrontOrder[] = [],
): CustomerBalanceView => getCanonicalCustomerBalanceResult(customer, transactions, upfrontOrders);

export const getCanonicalCustomerDue = (
  customer: Customer | null | undefined,
  customers: Customer[],
  transactions: Transaction[],
  upfrontOrders: UpfrontOrder[] = [],
) => getCanonicalCustomerBalanceView(customer, customers, transactions, upfrontOrders).currentDue;

export const getCanonicalCustomerStoreCredit = (
  customer: Customer | null | undefined,
  customers: Customer[],
  transactions: Transaction[],
  upfrontOrders: UpfrontOrder[] = [],
) => getCanonicalCustomerBalanceView(customer, customers, transactions, upfrontOrders).storeCredit;
