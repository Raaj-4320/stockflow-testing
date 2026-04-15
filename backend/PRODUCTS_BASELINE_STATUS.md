# Products Baseline Status (Phase 2D / 2D.1 / 2E.1)

## Implemented now
- Product module layering: controller -> service -> repository.
- Store-scoped CRUD baseline:
  - create
  - list
  - get by id
  - update
  - archive (soft delete path)
- Product DTO contracts and query DTOs under `src/contracts/v1/products`.
- Product baseline model definition (`productSchemaDefinition`) and document type.
- Product normalizer helper for variant/color/stock-row dedupe and trimming.
- Barcode uniqueness enforcement within store scope.
- Optimistic version check support via `expectedVersion` in update DTO.

## Executable evidence status
- Fixture-backed executable assertions are implemented in `tests/products/products-baseline.spec.ts`.
- Fixtures validated by baseline preflight script.
- Full Jest execution remains blocked in this environment due missing installable dependencies.

## Invariants covered by suite definitions
- Tenant-scoped identity and read/write separation.
- Duplicate barcode conflict in same store.
- Cross-store barcode allowance (by scope design).
- Basic stockByVariantColor normalization safety.
- Archive behavior for reversible baseline lifecycle.
- DTO validation + unknown-field rejection via global pipeline.
- Optimistic version conflict handling.

## Deferred intentionally
- Any transaction-driven stock mutation behavior.
- Procurement or purchase-receive stock semantics.
- Customer/finance/report coupling.
- Import/export flow behavior.

## Safety note
This is a low-risk baseline product domain only and must not be treated as full inventory engine behavior.
