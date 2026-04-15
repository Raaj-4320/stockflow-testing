export type FixtureRegistration = {
  name: string;
  group: string;
  path: string;
};

export const fixtureRegistry: FixtureRegistration[] = [
  {
    name: 'auth_token_required_v1',
    group: 'auth_tenancy',
    path: 'backend/tests/invariants/auth_tenancy/auth_token_required_v1.json',
  },
  {
    name: 'tenant_scope_resolution_v1',
    group: 'auth_tenancy',
    path: 'backend/tests/invariants/auth_tenancy/tenant_scope_resolution_v1.json',
  },
  {
    name: 'products_create_valid_v1',
    group: 'products',
    path: 'backend/tests/invariants/products/products_create_valid_v1.json',
  },
  {
    name: 'products_duplicate_barcode_same_store_v1',
    group: 'products',
    path: 'backend/tests/invariants/products/products_duplicate_barcode_same_store_v1.json',
  },
  {
    name: 'products_barcode_cross_store_v1',
    group: 'products',
    path: 'backend/tests/invariants/products/products_barcode_cross_store_v1.json',
  },
  {
    name: 'products_variant_color_normalization_v1',
    group: 'products',
    path: 'backend/tests/invariants/products/products_variant_color_normalization_v1.json',
  },
  {
    name: 'products_tenant_isolation_v1',
    group: 'products',
    path: 'backend/tests/invariants/products/products_tenant_isolation_v1.json',
  },
  {
    name: 'products_archive_behavior_v1',
    group: 'products',
    path: 'backend/tests/invariants/products/products_archive_behavior_v1.json',
  },
  {
    name: 'products_validation_rejection_v1',
    group: 'products',
    path: 'backend/tests/invariants/products/products_validation_rejection_v1.json',
  },
  {
    name: 'customers_create_valid_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_create_valid_v1.json',
  },
  {
    name: 'customers_duplicate_phone_same_store_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_duplicate_phone_same_store_v1.json',
  },
  {
    name: 'customers_duplicate_email_same_store_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_duplicate_email_same_store_v1.json',
  },
  {
    name: 'customers_identifier_cross_store_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_identifier_cross_store_v1.json',
  },
  {
    name: 'customers_tenant_isolation_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_tenant_isolation_v1.json',
  },
  {
    name: 'customers_archive_behavior_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_archive_behavior_v1.json',
  },
  {
    name: 'customers_validation_rejection_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_validation_rejection_v1.json',
  },
  {
    name: 'customers_version_conflict_v1',
    group: 'customers',
    path: 'backend/tests/invariants/customers/customers_version_conflict_v1.json',
  },
  {
    name: 'transactions_read_list_v1',
    group: 'transactions_read',
    path: 'backend/tests/invariants/transactions/transactions_read_list_v1.json',
  },
  {
    name: 'transactions_read_by_id_v1',
    group: 'transactions_read',
    path: 'backend/tests/invariants/transactions/transactions_read_by_id_v1.json',
  },
  {
    name: 'transactions_deleted_read_v1',
    group: 'transactions_read',
    path: 'backend/tests/invariants/transactions/transactions_deleted_read_v1.json',
  },
  {
    name: 'transactions_audit_events_read_v1',
    group: 'transactions_read',
    path: 'backend/tests/invariants/transactions/transactions_audit_events_read_v1.json',
  },
  {
    name: 'transactions_create_future_placeholder_v1',
    group: 'transactions_future',
    path: 'backend/tests/invariants/transactions/transactions_create_future_placeholder_v1.json',
  },
  {
    name: 'transactions_reconciliation_future_placeholder_v1',
    group: 'transactions_future',
    path: 'backend/tests/invariants/transactions/transactions_reconciliation_future_placeholder_v1.json',
  },

  {
    name: 'transactions_sale_create_basic_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_sale_create_basic_v1.json',
  },
  {
    name: 'transactions_sale_create_mixed_settlement_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_sale_create_mixed_settlement_v1.json',
  },
  {
    name: 'transactions_payment_create_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_payment_create_v1.json',
  },
  {
    name: 'transactions_return_create_refund_cash_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_return_create_refund_cash_v1.json',
  },
  {
    name: 'transactions_return_create_refund_online_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_return_create_refund_online_v1.json',
  },
  {
    name: 'transactions_return_create_reduce_due_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_return_create_reduce_due_v1.json',
  },
  {
    name: 'transactions_return_create_store_credit_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_return_create_store_credit_v1.json',
  },
  {
    name: 'transactions_invalid_settlement_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_invalid_settlement_v1.json',
  },
  {
    name: 'transactions_insufficient_stock_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_insufficient_stock_v1.json',
  },
  {
    name: 'transactions_version_conflict_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_version_conflict_v1.json',
  },
  {
    name: 'transactions_customer_effects_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_customer_effects_v1.json',
  },
  {
    name: 'transactions_stock_effects_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_stock_effects_v1.json',
  },
  {
    name: 'transactions_finance_effects_v1',
    group: 'transactions_create',
    path: 'backend/tests/invariants/transactions/transactions_finance_effects_v1.json',
  },
];
