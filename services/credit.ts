import { CreditLedgerEntry, Customer } from '../types';

export const resolveAvailableStoreCredit = (
  customer: Customer | null,
  creditLedger: CreditLedgerEntry[]
): number => {
  if (!customer) return 0;

  const customerCredit = customer.storeCreditBalance || 0;
  const ledgerEntries = creditLedger.filter(entry => entry.customerId === customer.id);
  if (!ledgerEntries.length) return customerCredit;

  const latestBalance = ledgerEntries[0]?.balanceAfter;
  return typeof latestBalance === 'number' ? Math.max(customerCredit, latestBalance) : customerCredit;
};
