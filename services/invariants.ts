import { AppState, Customer, Product, PurchaseOrder, Transaction } from '../types';
import { normalizeTransactionItems } from '../utils/transactionItems';

export type InvariantDomain = 'customer_ledger' | 'supplier_ledger' | 'inventory' | 'finance' | 'transaction' | 'system';
export type InvariantSeverity = 'warning' | 'error' | 'critical';

export type InvariantViolation = {
  domain: InvariantDomain;
  severity: InvariantSeverity;
  code: string;
  message: string;
  entityId?: string;
  context?: Record<string, unknown>;
};

export type InvariantContext = {
  operation?: string;
  source?: string;
  productionAuditKey?: string;
};

export type InvariantEnforcementResult = {
  ok: boolean;
  blocked: boolean;
  requiresOverride: boolean;
  violations: InvariantViolation[];
};

export type InvariantReport = InvariantEnforcementResult;

export type InvariantOverride = {
  reason: string;
  approvedBy?: string;
};

const AUDIT_STORAGE_KEY = 'stockflow_invariant_audit_log_v1';
const MAX_LOCAL_AUDIT_EVENTS = 200;

const isDev = () => Boolean((import.meta as any)?.env?.DEV);
const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
};
const nonNegative = (value: unknown): boolean => Number.isFinite(safeNumber(value)) && safeNumber(value) >= 0;
const validDate = (value: unknown): boolean => {
  if (!value) return false;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms);
};

const appendProductionAuditLog = (violations: InvariantViolation[], context: InvariantContext & { override?: InvariantOverride; blocked?: boolean; requiresOverride?: boolean }) => {
  if (typeof window === 'undefined' || violations.length === 0) return;
  const key = context.productionAuditKey || AUDIT_STORAGE_KEY;
  try {
    const existing = JSON.parse(window.localStorage.getItem(key) || '[]');
    const rows = Array.isArray(existing) ? existing : [];
    rows.push({ at: new Date().toISOString(), operation: context.operation || 'unknown', source: context.source || 'invariant_framework', blocked: context.blocked || false, requiresOverride: context.requiresOverride || false, override: context.override || null, violations });
    window.localStorage.setItem(key, JSON.stringify(rows.slice(-MAX_LOCAL_AUDIT_EVENTS)));
    window.dispatchEvent(new CustomEvent('stockflow-invariant-violation', { detail: { operation: context.operation, violations } }));
  } catch {
    // Last-resort audit path: do not throw while already handling invariant failures.
    console.error('[StockFlow invariant audit failed]', { operation: context.operation, violations });
  }
};

const NON_OVERRIDABLE_CODES = new Set(['duplicate_id', 'missing_id']);

const validateOverride = (override?: InvariantOverride): boolean => Boolean(String(override?.reason || '').trim());

export const handleInvariantViolations = (
  violations: InvariantViolation[],
  context: InvariantContext & { override?: InvariantOverride } = {}
): InvariantEnforcementResult => {
  const hasCritical = violations.some((violation) => violation.severity === 'critical');
  const hasNonOverridable = violations.some((violation) => NON_OVERRIDABLE_CODES.has(violation.code));
  const hasOverrideRequired = violations.some((violation) => violation.severity === 'error');
  const overrideAccepted = validateOverride(context.override);
  const blocked = hasNonOverridable || hasCritical || (hasOverrideRequired && !overrideAccepted);
  const requiresOverride = hasOverrideRequired && !hasCritical && !hasNonOverridable;
  const result = { ok: violations.length === 0 || (!blocked && overrideAccepted), blocked, requiresOverride, violations };

  if (violations.length > 0) {
    const payload = { operation: context.operation, source: context.source, blocked, requiresOverride, override: context.override, violations };
    if (isDev()) {
      console.warn('[StockFlow invariant violation]', payload);
    } else {
      appendProductionAuditLog(violations, { ...context, blocked, requiresOverride });
    }
  }
  return result;
};

export const validateNoDuplicateIds = <T extends { id?: string }>(domain: InvariantDomain, collectionName: string, rows: T[] = []): InvariantViolation[] => {
  const seen = new Set<string>();
  const violations: InvariantViolation[] = [];
  rows.forEach((row, index) => {
    const id = String(row?.id || '').trim();
    if (!id) {
      violations.push({ domain, severity: 'critical', code: 'missing_id', message: `${collectionName}[${index}] is missing id.`, context: { collectionName, index } });
      return;
    }
    if (seen.has(id)) {
      violations.push({ domain, severity: 'critical', code: 'duplicate_id', message: `${collectionName} contains duplicate id ${id}.`, entityId: id, context: { collectionName } });
      return;
    }
    seen.add(id);
  });
  return violations;
};

export const validateCustomerLedgerInvariant = (customer: Pick<Customer, 'id' | 'totalDue' | 'storeCredit'>): InvariantViolation[] => {
  const currentDue = safeNumber(customer.totalDue);
  const storeCredit = safeNumber(customer.storeCredit);
  const violations: InvariantViolation[] = [];
  if (!Number.isFinite(currentDue) || currentDue < 0) violations.push({ domain: 'customer_ledger', severity: 'critical', code: 'customer_due_invalid', message: 'Customer currentDue/totalDue must be a non-negative number.', entityId: customer.id, context: { currentDue } });
  if (!Number.isFinite(storeCredit) || storeCredit < 0) violations.push({ domain: 'customer_ledger', severity: 'critical', code: 'customer_store_credit_invalid', message: 'Customer storeCredit must be a non-negative number.', entityId: customer.id, context: { storeCredit } });
  if (currentDue > 0.005 && storeCredit > 0.005) violations.push({ domain: 'customer_ledger', severity: 'error', code: 'customer_due_and_credit_simultaneous', message: 'Customer should not have both current due and store credit simultaneously.', entityId: customer.id, context: { currentDue, storeCredit } });
  return violations;
};

export const validateSupplierLedgerInvariant = (summary: { partyId?: string; currentPayable?: unknown; currentCredit?: unknown }): InvariantViolation[] => {
  const currentPayable = safeNumber(summary.currentPayable || 0);
  const currentCredit = safeNumber(summary.currentCredit || 0);
  const violations: InvariantViolation[] = [];
  if (!Number.isFinite(currentPayable) || currentPayable < 0) violations.push({ domain: 'supplier_ledger', severity: 'critical', code: 'supplier_payable_invalid', message: 'Supplier currentPayable must be a non-negative number.', entityId: summary.partyId, context: { currentPayable } });
  if (!Number.isFinite(currentCredit) || currentCredit < 0) violations.push({ domain: 'supplier_ledger', severity: 'critical', code: 'supplier_credit_invalid', message: 'Supplier currentCredit must be a non-negative number.', entityId: summary.partyId, context: { currentCredit } });
  return violations;
};

export const validateInventoryInvariant = (product: Pick<Product, 'id' | 'stock' | 'stockByVariantColor'>): InvariantViolation[] => {
  const stock = safeNumber(product.stock);
  const violations: InvariantViolation[] = [];
  if (!Number.isFinite(stock)) violations.push({ domain: 'inventory', severity: 'critical', code: 'stock_nan_or_undefined', message: 'Product stock cannot be NaN or undefined.', entityId: product.id, context: { stock: product.stock } });
  if (Number.isFinite(stock) && stock < 0) violations.push({ domain: 'inventory', severity: 'critical', code: 'stock_negative', message: 'Product stock cannot be negative.', entityId: product.id, context: { stock } });
  const rows = Array.isArray(product.stockByVariantColor) ? product.stockByVariantColor : [];
  let variantTotal = 0;
  rows.forEach((row: any, index: number) => {
    const rowStock = safeNumber(row?.stock);
    if (!Number.isFinite(rowStock) || rowStock < 0) violations.push({ domain: 'inventory', severity: 'critical', code: 'variant_stock_invalid', message: 'Variant stock must be a non-negative number.', entityId: product.id, context: { index, rowStock: row?.stock } });
    else variantTotal += rowStock;
  });
  if (rows.length > 0 && Number.isFinite(stock) && Math.abs(variantTotal - stock) > 0.01) {
    violations.push({ domain: 'inventory', severity: 'error', code: 'variant_stock_total_mismatch', message: 'Variant stock totals must reconcile with product stock.', entityId: product.id, context: { productStock: stock, variantTotal } });
  }
  return violations;
};

export const validateTransactionInvariant = (transaction: Transaction): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];
  const total = Math.abs(safeNumber((transaction as any).total));
  if (!transaction.id) violations.push({ domain: 'transaction', severity: 'critical', code: 'transaction_missing_id', message: 'Transaction id is required.' });
  if (!validDate(transaction.date)) violations.push({ domain: 'transaction', severity: 'critical', code: 'transaction_invalid_date', message: 'Transaction date is invalid.', entityId: transaction.id, context: { date: transaction.date } });
  if (!Number.isFinite(total)) violations.push({ domain: 'transaction', severity: 'critical', code: 'transaction_total_invalid', message: 'Transaction total must be numeric.', entityId: transaction.id, context: { total: (transaction as any).total } });
  const items = normalizeTransactionItems((transaction as any).items);
  const lineTotal = items.reduce((sum: number, item: any) => {
    const qty = safeNumber(item.quantity);
    const price = safeNumber(item.sellPrice ?? item.price ?? item.unitPrice ?? 0);
    if (!Number.isFinite(qty) || qty < 0) violations.push({ domain: 'transaction', severity: 'critical', code: 'negative_or_invalid_quantity', message: 'Transaction line quantity must be non-negative.', entityId: transaction.id, context: { itemId: item.productId || item.id, quantity: item.quantity } });
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);
  const discount = safeNumber((transaction as any).discount || 0);
  const expectedTotal = Math.max(0, lineTotal - (Number.isFinite(discount) ? discount : 0));
  if (items.length > 0 && Number.isFinite(total) && Math.abs(expectedTotal - total) > Math.max(1, total * 0.05)) {
    violations.push({ domain: 'transaction', severity: 'error', code: 'transaction_total_line_mismatch', message: 'Transaction total should reconcile with line totals.', entityId: transaction.id, context: { total, expectedTotal } });
  }
  const paid = safeNumber((transaction as any).cashPaid || 0) + safeNumber((transaction as any).onlinePaid || 0) + safeNumber((transaction as any).paidAmount || 0);
  if (transaction.type === 'sale' && Number.isFinite(paid) && Number.isFinite(total) && paid - total > 0.01 && !((transaction as any).storeCreditCreated > 0)) {
    violations.push({ domain: 'transaction', severity: 'warning', code: 'sale_payments_exceed_total', message: 'Payments exceed sale total without explicit store credit handling.', entityId: transaction.id, context: { paid, total } });
  }
  if (transaction.type === 'return' && Number.isFinite(total) && total <= 0) {
    violations.push({ domain: 'transaction', severity: 'critical', code: 'return_total_invalid', message: 'Return amount must be greater than zero.', entityId: transaction.id, context: { total } });
  }
  return violations;
};

export const validateFinanceInvariant = (summary: { cashIn?: unknown; cashOut?: unknown; openingCash?: unknown; closingCash?: unknown }): InvariantViolation[] => {
  const cashIn = safeNumber(summary.cashIn || 0);
  const cashOut = safeNumber(summary.cashOut || 0);
  const openingCash = safeNumber(summary.openingCash || 0);
  const closingCash = safeNumber(summary.closingCash || 0);
  if (![cashIn, cashOut, openingCash, closingCash].every(Number.isFinite)) {
    return [{ domain: 'finance', severity: 'critical', code: 'cashbook_amount_invalid', message: 'Cashbook amounts must be numeric.', context: summary as Record<string, unknown> }];
  }
  const expectedClosing = openingCash + cashIn - cashOut;
  if (Math.abs(expectedClosing - closingCash) > 0.01) {
    return [{ domain: 'finance', severity: 'error', code: 'cashbook_not_balanced', message: 'Cashbook closing cash must reconcile with opening + inflows - outflows.', context: { ...summary, expectedClosing } }];
  }
  return [];
};

export const validateAppStateInvariants = (state: Partial<AppState>): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];
  const products = Array.isArray(state.products) ? state.products : [];
  const customers = Array.isArray(state.customers) ? state.customers : [];
  const transactions = Array.isArray(state.transactions) ? state.transactions : [];
  const purchaseOrders = Array.isArray(state.purchaseOrders) ? state.purchaseOrders : [];

  violations.push(...validateNoDuplicateIds('inventory', 'products', products));
  violations.push(...validateNoDuplicateIds('customer_ledger', 'customers', customers));
  violations.push(...validateNoDuplicateIds('transaction', 'transactions', transactions));
  violations.push(...validateNoDuplicateIds('supplier_ledger', 'purchaseOrders', purchaseOrders));

  customers.forEach(customer => violations.push(...validateCustomerLedgerInvariant(customer)));
  products.forEach(product => violations.push(...validateInventoryInvariant(product)));
  transactions.forEach(transaction => violations.push(...validateTransactionInvariant(transaction)));
  purchaseOrders.forEach((order: PurchaseOrder) => {
    if (!nonNegative((order as any).totalAmount)) violations.push({ domain: 'supplier_ledger', severity: 'critical', code: 'purchase_total_invalid', message: 'Purchase order totalAmount must be non-negative.', entityId: order.id, context: { totalAmount: (order as any).totalAmount } });
    if (!nonNegative((order as any).remainingAmount)) violations.push({ domain: 'supplier_ledger', severity: 'critical', code: 'purchase_remaining_invalid', message: 'Purchase order remainingAmount must be non-negative.', entityId: order.id, context: { remainingAmount: (order as any).remainingAmount } });
  });

  return violations;
};

export const enforceAppStateInvariants = (state: Partial<AppState>, context: InvariantContext & { override?: InvariantOverride } = {}): InvariantEnforcementResult => {
  const violations = validateAppStateInvariants(state);
  return handleInvariantViolations(violations, { source: 'app_state', ...context });
};

export const assertInvariantCriticalSamplesBlock = (): boolean => {
  const duplicateTx: Transaction = { id: 'dup', date: new Date().toISOString(), type: 'sale', items: [], total: 1 } as Transaction;
  const duplicateReport = handleInvariantViolations(validateAppStateInvariants({ transactions: [duplicateTx, duplicateTx] }), { operation: 'sample_duplicate' });
  const nanStockReport = handleInvariantViolations(validateAppStateInvariants({ products: [{ id: 'p1', stock: Number.NaN } as Product] }), { operation: 'sample_nan_stock' });
  const invalidDateReport = handleInvariantViolations(validateAppStateInvariants({ transactions: [{ id: 'tx-date', date: 'not-a-date', type: 'sale', items: [], total: 1 } as Transaction] }), { operation: 'sample_invalid_date' });
  const warningOnlyReport = handleInvariantViolations([{ domain: 'transaction', severity: 'warning', code: 'sample_warning', message: 'sample warning' }], { operation: 'sample_warning' });
  return duplicateReport.blocked && nanStockReport.blocked && invalidDateReport.blocked && !warningOnlyReport.blocked;
};
