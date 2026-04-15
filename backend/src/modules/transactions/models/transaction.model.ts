import {
  DeletedTransactionDto,
  TransactionAuditEventDto,
  TransactionDto,
} from '../../../contracts/v1/transactions/transaction.types';

export type TransactionDocument = TransactionDto;
export type DeletedTransactionDocument = DeletedTransactionDto;
export type TransactionAuditEventDocument = TransactionAuditEventDto;

export const transactionSchemaDefinition = {
  id: 'string',
  storeId: 'string',
  type: 'string',
  transactionDate: 'string',
  lineItems: 'array<lineItemSnapshot>',
  settlement: 'settlementSnapshot',
  customer: 'customerSnapshot',
  totals: 'totalsSnapshot',
  metadata: 'metadataSnapshot',
  createdAt: 'string',
  updatedAt: 'string',
  version: 'number',
} as const;

export const deletedTransactionSchemaDefinition = {
  id: 'string',
  storeId: 'string',
  originalTransactionId: 'string',
  deletedAt: 'string',
  deletedBy: 'string|null',
  reason: 'string|null',
  snapshot: 'transactionSnapshot',
} as const;

export const transactionAuditEventSchemaDefinition = {
  id: 'string',
  storeId: 'string',
  transactionId: 'string',
  eventType: 'string',
  eventAt: 'string',
  actorId: 'string|null',
  summary: 'string|null',
} as const;
