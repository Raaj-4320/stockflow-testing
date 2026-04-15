# Transaction Fixture Matrix (Phase 3B)

Date: 2026-04-14

## Goal
Lock the fixture matrix that Phase 3C mutation-path implementation must satisfy.

## Legend
- Preview: expected impact-only result (no writes)
- Apply: expected accepted/result envelope (execution behavior to be implemented in Phase 3C)
- Status: Contract Locked = shape and expected outcomes approved for implementation

## Matrix

| Scenario | Operation | Focus Area | Required Assertions (contract level) | Status |
|---|---|---|---|---|
| sale create basic | create_sale | standard sale path | valid request shape, settlement shape valid, preview impact shape present | Contract Locked |
| sale create mixed settlement | create_sale | mixed cash/online/due/store-credit mix | settlement fields accepted in contract; invalid mixes reject with settlement error code | Contract Locked |
| payment create | create_payment | customer payment intake | amount > 0, customerId required, settlement contract valid | Contract Locked |
| return create per return mode | create_return | return handling mode matrix | each mode (`refund_cash`, `refund_online`, `reduce_due`, `store_credit`) accepted by DTO contract | Contract Locked |
| update preview | update_transaction | reconciliation planning | requires transactionId + expectedVersion + patch shape; preview response envelope shape | Contract Locked |
| delete preview | delete_transaction | deletion planning | requires transactionId + expectedVersion + compensation payload shape | Contract Locked |
| delete compensation preview | delete_transaction | compensation mode validation | compensation mode accepted set: none/cash_refund/online_refund/store_credit | Contract Locked |
| invalid settlement | create_sale/create_payment/create_return | validation rejection | return `TRANSACTION_MUTATION_INVALID_SETTLEMENT` for invalid settlement combinations | Contract Locked |
| insufficient stock | create_sale/update_transaction | stock guardrail | return `TRANSACTION_MUTATION_INSUFFICIENT_STOCK` when preview/apply detects shortage | Contract Locked |
| version conflict | update_transaction/delete_transaction | optimistic concurrency | return `TRANSACTION_MUTATION_VERSION_CONFLICT` on stale expectedVersion | Contract Locked |
| customer due/store-credit effect cases | create_sale/create_payment/create_return/update/delete | customer ledger impact contract | preview includes `customerEffects.dueDelta` and `customerEffects.storeCreditDelta` | Contract Locked |
| stock effect cases | create_sale/create_return/update/delete | stock impact contract | preview includes stock effects list (`productId`, variant/color, delta) | Contract Locked |
| finance effect cases | create_sale/create_payment/create_return/update/delete | finance impact contract | preview includes cash/online in/out deltas | Contract Locked |

## Fixture IDs (to be used in tests)
Recommended IDs:
- `transactions_sale_create_basic_v1`
- `transactions_sale_create_mixed_settlement_v1`
- `transactions_payment_create_v1`
- `transactions_return_create_refund_cash_v1`
- `transactions_return_create_refund_online_v1`
- `transactions_return_create_reduce_due_v1`
- `transactions_return_create_store_credit_v1`
- `transactions_update_preview_v1`
- `transactions_delete_preview_v1`
- `transactions_delete_compensation_preview_v1`
- `transactions_invalid_settlement_v1`
- `transactions_insufficient_stock_v1`
- `transactions_version_conflict_v1`
- `transactions_customer_effects_v1`
- `transactions_stock_effects_v1`
- `transactions_finance_effects_v1`

## Phase boundaries
This fixture matrix approves expected contract outcomes only. It does not authorize mutation execution logic in Phase 3B.
