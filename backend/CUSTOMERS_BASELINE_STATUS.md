# Customers Baseline Status (Phase 2E / 2E.1)

## Implemented now
- Customer module layering: controller -> service -> repository.
- Store-scoped CRUD baseline:
  - create
  - list
  - get by id
  - update
  - archive (soft deactivate path)
- Customer DTO contracts and query DTOs under `src/contracts/v1/customers`.
- Customer baseline model definition (`customerSchemaDefinition`) and document type.
- Customer normalizer helper for phone/email/name/notes normalization.
- Uniqueness enforcement within store scope:
  - phone
  - email (when provided)
- Optimistic version check support via `expectedVersion` in update DTO.

## Executable evidence status
- Fixture-backed executable assertions are implemented in `tests/customers/customers-baseline.spec.ts`.
- Fixtures validated by baseline preflight script.
- Full Jest execution remains blocked in this environment due missing installable dependencies.

## Baseline invariants covered by suite definitions
- Tenant-scoped identity and read/write separation.
- Duplicate phone/email conflict in same store.
- Cross-store duplicate allowance (by store scope design).
- Archive behavior for safe lifecycle control.
- DTO validation + unknown-field rejection via global pipeline.
- Optimistic version conflict handling.
- Normalization baseline behavior.

## Explicitly deferred (non-ledger-first)
- `totalDue` / `storeCredit` active behavior.
- Payment posting or collection.
- Upfront-order logic.
- Any transaction/finance/procurement coupling.

## Safety note
This phase intentionally keeps customers as identity/profile domain only.
