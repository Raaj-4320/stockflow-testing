# Transaction Create Fixture Status (Phase 3C)

Date: 2026-04-14

## Fixture scenarios implemented for create-path assertions

Implemented fixture files:
- `transactions_sale_create_basic_v1.json`
- `transactions_sale_create_mixed_settlement_v1.json`
- `transactions_payment_create_v1.json`
- `transactions_return_create_refund_cash_v1.json`
- `transactions_return_create_refund_online_v1.json`
- `transactions_return_create_reduce_due_v1.json`
- `transactions_return_create_store_credit_v1.json`
- `transactions_invalid_settlement_v1.json`
- `transactions_insufficient_stock_v1.json`
- `transactions_version_conflict_v1.json`
- `transactions_customer_effects_v1.json`
- `transactions_stock_effects_v1.json`
- `transactions_finance_effects_v1.json`

## Coverage summary
- sale create basic + mixed settlement
- payment create
- return create (all return modes)
- invalid settlement rejection
- insufficient stock rejection
- source version conflict (return create)
- customer balance effects (due/store credit)
- stock effects (sale decrement / return increment)
- minimal finance-effect coverage via persisted settlement/totals assertions
- idempotency required + replay behavior assertions

## Test file
- `backend/tests/transactions/transactions-create-path.spec.ts`

## Notes
- Update/delete mutation fixtures remain intentionally deferred to later phases.
