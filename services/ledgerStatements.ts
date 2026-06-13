import { Customer, PartyCreditLedgerEntry, PurchaseOrder, PurchaseParty, SupplierPaymentLedgerEntry, Transaction, UpfrontOrder } from '../types';
import { buildCorrectCustomerLedgerPreview } from './customerLedger';
import { buildPurchasePartyLedger } from './purchaseLedger';
import type { LedgerStatementColumn, LedgerStatementRow, LedgerStatementSummaryCard } from './pdf';

const money = (value: unknown) => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedMoney = (value: unknown) => {
  const n = Number(value || 0);
  if (Math.abs(n) < 0.005) return 'INR 0.00';
  return `${n > 0 ? '+' : '-'}${money(Math.abs(n))}`;
};
const fmtDate = (value: string) => {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB') : String(value || '');
};
const rowTypeLabel = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export type BuiltLedgerStatement = {
  statementTitle: string;
  entityLabel: string;
  entityName: string;
  entityMeta: string[];
  summaryCards: LedgerStatementSummaryCard[];
  columns: LedgerStatementColumn[];
  rows: LedgerStatementRow[];
};

export const buildCustomerStatementRowsFromCanonicalReplay = (
  customer: Customer,
  transactions: Transaction[],
  upfrontOrders: UpfrontOrder[] = []
): BuiltLedgerStatement => {
  const ledger = buildCorrectCustomerLedgerPreview(customer, transactions, upfrontOrders);
  const columns: LedgerStatementColumn[] = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Ref', key: 'ref', width: 14 },
    { header: 'Description', key: 'description', width: 26 },
    { header: 'Sale Total', key: 'saleTotal', align: 'right', width: 14 },
    { header: 'Paid / Payment', key: 'paidPayment', align: 'right', width: 17 },
    { header: 'Credit Due', key: 'creditDue', align: 'right', width: 14 },
    { header: 'SC Created', key: 'storeCreditCreated', align: 'right', width: 15 },
    { header: 'SC Used', key: 'storeCreditUsed', align: 'right', width: 13 },
    { header: 'Impact', key: 'impact', align: 'right', width: 15 },
    { header: 'Run Due', key: 'runningDue', align: 'right', width: 15 },
    { header: 'Run SC', key: 'runningStoreCredit', align: 'right', width: 14 },
    { header: 'Net', key: 'netReceivable', align: 'right', width: 14 },
  ];
  const rows = ledger.rows.map((row) => ({
    date: fmtDate(row.date),
    type: rowTypeLabel(row.effectiveType),
    ref: row.ref || row.id.slice(-6),
    description: [row.description, row.warnings.length ? `Review: ${row.warnings.join(' | ')}` : ''].filter(Boolean).join(' • '),
    saleTotal: row.saleTotal ? money(row.saleTotal) : '—',
    paidPayment: row.paymentReceived ? money(row.paymentReceived) : (row.paidNow ? money(row.paidNow) : '—'),
    creditDue: row.creditDue ? money(row.creditDue) : '—',
    storeCreditCreated: row.storeCreditCreated ? money(row.storeCreditCreated) : '—',
    storeCreditUsed: row.storeCreditUsed ? money(row.storeCreditUsed) : '—',
    impact: signedMoney(row.receivableImpact),
    runningDue: money(row.runningDue),
    runningStoreCredit: money(row.runningStoreCredit),
    netReceivable: money(row.netReceivable),
  }));
  return {
    statementTitle: 'Customer Ledger Statement',
    entityLabel: 'CUSTOMER',
    entityName: customer.name,
    entityMeta: [customer.phone ? `Phone: ${customer.phone}` : '', `Customer ID: ${customer.id}`].filter(Boolean),
    summaryCards: [
      { label: 'Opening Balance', value: money(0), tone: 'neutral' },
      { label: 'Sales / Credit Due', value: money(ledger.rows.reduce((s, row) => s + row.creditDue, 0)), tone: 'due' },
      { label: 'Payments / Credits', value: money(ledger.rows.reduce((s, row) => s + Math.max(0, -row.receivableImpact), 0)), tone: 'credit' },
      { label: 'Store Credit Created', value: money(ledger.rows.reduce((s, row) => s + row.storeCreditCreated, 0)), tone: 'credit' },
      { label: 'Store Credit Used', value: money(ledger.rows.reduce((s, row) => s + row.storeCreditUsed, 0)), tone: 'due' },
      { label: 'Current Due', value: money(ledger.summary.correctedCurrentDue), tone: 'due' },
      { label: 'Store Credit', value: ledger.summary.correctedStoreCredit > 0 ? `${money(ledger.summary.correctedStoreCredit)} advance` : money(0), tone: 'credit' },
      { label: 'Net Receivable', value: money(ledger.summary.correctedNetReceivable), tone: 'dark' },
    ],
    columns,
    rows,
  };
};

export const buildSupplierStatementRowsFromCanonicalLedger = (
  party: PurchaseParty,
  purchaseOrders: PurchaseOrder[],
  supplierPayments: SupplierPaymentLedgerEntry[],
  partyCreditLedger: PartyCreditLedgerEntry[]
): BuiltLedgerStatement => {
  const ledger = buildPurchasePartyLedger({ partyId: party.id, purchaseOrders, supplierPayments, partyCreditLedger });
  const columns: LedgerStatementColumn[] = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Ref', key: 'ref', width: 15 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Purchase +', key: 'purchase', align: 'right', width: 16 },
    { header: 'Payment -', key: 'payment', align: 'right', width: 16 },
    { header: 'Credit Applied', key: 'creditApplied', align: 'right', width: 16 },
    { header: 'Credit Created', key: 'creditCreated', align: 'right', width: 16 },
    { header: 'Run Payable', key: 'runningPayable', align: 'right', width: 17 },
    { header: 'Run Credit', key: 'runningCredit', align: 'right', width: 16 },
    { header: 'Net Payable', key: 'netPayable', align: 'right', width: 16 },
  ];
  const rows = ledger.rows.map((row) => ({
    date: fmtDate(row.date),
    type: row.type === 'purchase' ? 'Purchase' : row.type === 'supplier_payment' || row.type === 'legacy_payment' ? 'Payment' : row.type === 'edit_credit' ? 'Credit' : rowTypeLabel(row.type),
    ref: row.reference || row.id.slice(-6),
    description: [row.description, row.warnings?.length ? `Review: ${row.warnings.map((warning) => warning.message).join(' | ')}` : ''].filter(Boolean).join(' • '),
    purchase: row.purchaseAmount ? money(row.purchaseAmount) : '—',
    payment: row.paymentAmount ? money(row.paymentAmount) : '—',
    creditApplied: row.creditApplied ? money(row.creditApplied) : '—',
    creditCreated: row.creditCreated ? money(row.creditCreated) : '—',
    runningPayable: money(row.runningPayable),
    runningCredit: money(row.runningCredit),
    netPayable: money(row.netPayable),
  }));
  return {
    statementTitle: 'Supplier Ledger Statement',
    entityLabel: 'SUPPLIER',
    entityName: party.name,
    entityMeta: [party.phone ? `Phone: ${party.phone}` : '', party.gst ? `GST: ${party.gst}` : '', `Party ID: ${party.id}`].filter(Boolean),
    summaryCards: [
      { label: 'Opening Balance', value: money(0), tone: 'neutral' },
      { label: 'Total Purchases', value: money(ledger.summary.totalPurchase), tone: 'due' },
      { label: 'Total Payments', value: money(ledger.summary.totalPayments), tone: 'credit' },
      { label: 'Credit Created', value: money(ledger.summary.creditCreated), tone: 'credit' },
      { label: 'Credit Applied', value: money(ledger.summary.creditApplied), tone: 'due' },
      { label: 'Current Payable', value: money(ledger.summary.currentPayable), tone: 'due' },
      { label: 'Current Credit', value: ledger.summary.currentCredit > 0 ? `${money(ledger.summary.currentCredit)} advance` : money(0), tone: 'credit' },
      { label: 'Net Payable', value: money(ledger.summary.netPayable), tone: 'dark' },
    ],
    columns,
    rows,
  };
};
