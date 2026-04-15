# Transaction Contract Notes (Phase 3A)

## Read Contracts Locked
- `ListTransactionsQueryDto`
  - safe filters: date range, type, customerId, text query
  - pagination: page/pageSize
  - sort: transactionDate/createdAt/updatedAt + asc/desc
- `TransactionDto`
  - immutable snapshot-oriented shape
  - line item snapshot + settlement snapshot + customer snapshot + metadata snapshot
- `DeletedTransactionDto`
  - deleted record with original snapshot reference
- `TransactionAuditEventDto`
  - read shape for transaction event timeline
- Response wrappers:
  - `TransactionResponseDto`
  - `TransactionListResponseDto`
  - `DeletedTransactionListResponseDto`
  - `TransactionAuditEventListResponseDto`

## Contract Guardrails
- No mutation DTOs included in this phase.
- No computed settlement business logic in read contracts.
- No customer ledger mutation semantics embedded in contract defaults.
- Store-scoped access is mandatory for all read endpoints.
