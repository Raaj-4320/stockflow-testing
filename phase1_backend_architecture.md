# Phase 1 — Backend Architecture (Separate API)

## Recommended Framework
**NestJS** is recommended.

### Why NestJS
- Strong module boundaries to decompose `services/storage.ts` responsibilities.
- First-class guards/pipes/interceptors for middleware-driven protection.
- Clean DTO validation and consistent API contracts.
- Better structure for high-risk transaction/finance/procurement invariants.

## Target Project Shape

```text
src/
  main.ts
  app.module.ts

  common/
    middleware/
    guards/
    interceptors/
    filters/
    dto/
    errors/

  modules/
    auth/
    tenancy/
    products/
    customers/
    transactions/
    finance/
    procurement/
    reports/
    uploads/
    audit/
    health/

  infrastructure/
    mongodb/
      schemas/
      repositories/
    queue/
    storage/
```

## Domain Ownership
- **products:** catalog, categories, variants/colors, stock buckets
- **customers:** customer profiles, due/store-credit, upfront orders
- **transactions:** sales/returns/payments/update/delete reconciliation
- **finance:** shifts, expenses, cashbook calculations
- **procurement:** inquiry->confirmed->purchase->receipt lifecycle
- **reports:** export payloads + jobs
- **auth/tenancy:** identity, verification, store scope
- **audit:** immutable operational audit events

## API Contract Model
- DTO classes for all requests/responses.
- Validation pipeline with reject-on-extra-fields behavior.
- Stable error format with machine-readable codes.

## Security and Isolation
- Auth guard -> tenant guard -> permission guard chain.
- All repository operations require `storeId` scope.
- Verification state enforced server-side (not UI-only).

## Observability
- Structured logs with request IDs.
- Audit records for critical mutations (transaction, shift close, receive, delete).
- Health/readiness/version endpoints.

## Backend Guardrails
- Idempotency required for high-impact mutations.
- No cross-domain repository access; only service interface calls.
- Critical invariants covered by parity fixtures before domain cutover.
