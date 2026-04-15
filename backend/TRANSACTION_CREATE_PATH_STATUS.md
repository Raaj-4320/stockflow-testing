# Transaction Create-Path Status (Phase 3C)

Date: 2026-04-14

## Implemented in this phase

### Create mutation handlers now implemented
- `create_sale`
- `create_payment`
- `create_return`

### Real behavior now implemented
- store-scoped transaction persistence for create path
- idempotency-required create mutations (`X-Idempotency-Key`)
- idempotency replay protection for same key + same payload
- idempotency conflict rejection for same key + different payload
- sale create stock decrement
- return create stock increment
- sale/payment/return customer due/store-credit mutation paths (narrow create flow only)
- source-transaction version conflict check for return create when `expectedSourceVersion` is provided

### Explicitly not implemented in this phase
- update transaction execution
- delete transaction execution
- delete compensation executor
- generic reconciliation engine
- finance cashbook formulas/external finance posting
- procurement coupling
- Firestore migration/cutover
- frontend rewiring

## Contract/guardrail alignment
- Uses Phase 3B mutation DTOs and locked mutation error codes.
- Keeps create flows explicit (`createSale`, `createPayment`, `createReturn`) rather than a generic mutation router.
- Keeps write behavior store-scoped and fixture-driven.
