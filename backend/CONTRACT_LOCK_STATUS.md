# Contract Lock Status (Phase 2C)

## Locked in this phase
- Auth/tenant DTO contracts under `src/contracts/v1`:
  - login request/response
  - auth context
  - tenant context
- Products baseline DTO contracts under `src/contracts/v1/products`:
  - create/update payloads
  - list query
  - product response/types
- Standard auth/tenant error code enum.
- Standard error envelope shape consumed by global exception filter.
- Unknown-field rejection remains enforced through global validation pipe.

## Contract enforcement notes
- Auth guard and tenant guard now throw structured errors with locked codes.
- `X-Request-Id` is propagated and returned in error envelope.
- Contract versions remain under `/api/v1` prefix.

## Deferred
- OpenAPI generation and package-published client contracts.
- Extended enum compatibility rules for downstream high-risk domains.
