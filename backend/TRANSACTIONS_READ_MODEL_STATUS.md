# Transactions Read-Model Status (Phase 3A)

## Implemented now (read-only)
- Transaction read contracts under `src/contracts/v1/transactions`:
  - list query DTO
  - transaction response/list response DTOs
  - settlement/line-item/customer/metadata snapshot types
  - deleted-transaction and audit-event read shapes
- Transaction read-model repository/service/controller layering:
  - `GET /transactions`
  - `GET /transactions/:id`
  - `GET /transactions/deleted`
  - `GET /transactions/:id/audit-events`
- Store-scoped filtering and lookup enforced in repository read paths.
- Pagination and safe read filters supported on list endpoint.

## Important scope limit
This phase is read-only scaffolding and contract planning.
No mutation logic exists in this implementation.

## Read model notes
- Transaction snapshots are treated as immutable read structures.
- Settlement and line item snapshots are exposed as persisted fields, not computed here.
- Deleted transactions and audit events are represented as read-model collections.

## Deferred
- create/update/delete transaction paths
- settlement and return allocation computation
- stock/customer/finance side effects
- reconciliation and delete compensation logic
