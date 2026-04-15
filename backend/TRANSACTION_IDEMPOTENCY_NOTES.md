# Transaction Mutation Idempotency Notes (Phase 3B)

Date: 2026-04-14

## Purpose
Define idempotency requirements for transaction mutation endpoints before write logic is implemented.

## Applies to endpoints
- create sale transaction
- create payment transaction
- create return transaction
- update transaction
- delete transaction

## Required headers and keys
1. `X-Idempotency-Key` is required for every mutation request.
2. Key must be unique per store scope and mutation intent.
3. Key must be replay-safe for network retries.

If missing, return:
- `TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REQUIRED`

## Canonical request identity
Idempotency uniqueness is based on:
- tenant/store context
- mutation operation
- request path
- canonicalized request payload hash

If same key is reused with a different canonical payload, return:
- `TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REUSED_DIFFERENT_PAYLOAD`

## Replay behavior
If the same key + same canonical payload is received again:
- server must not create duplicate mutation side effects
- response should return accepted/applied/replayed contract status consistently
- response envelope should preserve original mutation identity fields

Replay signaling code:
- `TRANSACTION_MUTATION_IDEMPOTENCY_REPLAY`

## Preview + apply contract coupling
Where preview-first flow is enforced:
- apply may require a valid preview token/reference
- expired preview should fail with `TRANSACTION_MUTATION_PREVIEW_EXPIRED`
- missing required preview should fail with `TRANSACTION_MUTATION_PREVIEW_REQUIRED`

## Minimum retention guidance
- retain idempotency records long enough to cover realistic client retry windows
- implementation target for 3C: configurable retention window per environment

## Out of scope in Phase 3B
This document is contract-level only. It does not implement storage, locking, or replay execution logic.
