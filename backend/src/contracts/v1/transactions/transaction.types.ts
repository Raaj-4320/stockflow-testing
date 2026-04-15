export type TransactionLineItemSnapshotDto = {
  productId: string;
  productName: string;
  sku?: string | null;
  variant?: string | null;
  color?: string | null;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
};

export type TransactionSettlementSnapshotDto = {
  cashPaid: number;
  onlinePaid: number;
  creditDue: number;
  storeCreditUsed: number;
  paymentMethod: string;
};

export type TransactionMetadataDto = {
  source: 'pos' | 'import' | 'adjustment' | 'unknown';
  note?: string | null;
  createdBy?: string | null;
};

export type TransactionCustomerSnapshotDto = {
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
};

export type TransactionDto = {
  id: string;
  storeId: string;
  type: 'sale' | 'return' | 'payment' | 'adjustment' | 'unknown';
  transactionDate: string;
  lineItems: TransactionLineItemSnapshotDto[];
  settlement: TransactionSettlementSnapshotDto;
  customer: TransactionCustomerSnapshotDto;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    grandTotal: number;
  };
  metadata: TransactionMetadataDto;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type DeletedTransactionDto = {
  id: string;
  storeId: string;
  originalTransactionId: string;
  deletedAt: string;
  deletedBy?: string | null;
  reason?: string | null;
  snapshot: TransactionDto;
};

export type TransactionAuditEventDto = {
  id: string;
  storeId: string;
  transactionId: string;
  eventType: 'created' | 'updated' | 'deleted' | 'read';
  eventAt: string;
  actorId?: string | null;
  summary?: string | null;
};
