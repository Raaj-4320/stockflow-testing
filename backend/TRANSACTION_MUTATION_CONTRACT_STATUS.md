# Transaction Mutation Contract Status (Phase 3B)

Date: 2026-04-14

## Scope of this document
This file locks the contract-design outputs for transaction mutations in Phase 3B.

## Contract artifacts now complete

### 1) Shared mutation payload contracts
- `backend/src/contracts/v1/transactions/mutation-common.dto.ts`
  - `TransactionMutationLineItemDto`
  - `TransactionSettlementPayloadDto`
  - `ReturnHandlingPayloadDto`
  - `DeleteCompensationPayloadDto`
  - `TransactionMutationPreviewRequestDto`
  - `TransactionMutationPreviewResponseDto`
  - `TransactionMutationAcceptedResponseDto`

### 2) Create mutation request contracts
- `CreateSaleTransactionDto`
- `CreatePaymentTransactionDto`
- `CreateReturnTransactionDto`

### 3) Update/delete mutation request contracts
- `UpdateTransactionRequestDto`
- `DeleteTransactionRequestDto`

### 4) Transaction mutation error code set (expanded + locked)
Defined in `backend/src/contracts/v1/common/error-codes.ts`:
- `TRANSACTION_MUTATION_INVALID_OPERATION`
- `TRANSACTION_MUTATION_INVALID_REQUEST`
- `TRANSACTION_MUTATION_INVALID_SETTLEMENT`
- `TRANSACTION_MUTATION_INVALID_RETURN_MODE`
- `TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REQUIRED`
- `TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REUSED_DIFFERENT_PAYLOAD`
- `TRANSACTION_MUTATION_IDEMPOTENCY_REPLAY`
- `TRANSACTION_MUTATION_PREVIEW_REQUIRED`
- `TRANSACTION_MUTATION_PREVIEW_EXPIRED`
- `TRANSACTION_MUTATION_VERSION_CONFLICT`
- `TRANSACTION_MUTATION_INSUFFICIENT_STOCK`
- `TRANSACTION_MUTATION_COMPENSATION_REQUIRED`
- `TRANSACTION_MUTATION_COMPENSATION_INVALID`
- `TRANSACTION_MUTATION_BLOCKED`

## Explicitly deferred (must remain unimplemented in 3B)
- Transaction create execution path
- Transaction update execution path
- Transaction delete execution path
- Settlement engine
- Return allocation engine
- Stock mutation effects
- Customer due/store-credit ledger mutations
- Finance/cashbook mutations
- Delete compensation executor

## Approval status
- Contract design: **Approved for Phase 3B completion**
- Ready for Phase 3C planning: **Yes (planning only, not implementation in this phase)**
