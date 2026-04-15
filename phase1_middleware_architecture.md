# Phase 1 — Middleware-Driven Protection Architecture

## Pipeline Order (Target)
1. Request ID/correlation middleware
2. Security headers + CORS
3. Request logging (start)
4. Authentication guard
5. Tenant scope guard
6. Permission/role guard
7. Rate limiting
8. Idempotency middleware (selected mutations)
9. DTO validation pipeline
10. Domain handler execution
11. Audit interceptor
12. Error filter (standard envelope)
13. Request logging (end)

## Mandatory Middleware Capabilities
- **Auth:** verify identity/token/session.
- **Tenant:** enforce store isolation on every protected route.
- **Validation:** reject malformed/unknown payloads.
- **Idempotency:** deduplicate mutation retries.
- **Audit:** persist immutable operation traces.
- **Error normalization:** consistent client-consumable errors.

## Endpoints Requiring Idempotency Keys
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`
- `POST /finance/shifts/:id/close`
- `POST /procurement/purchases/:id/receive`
- import submit endpoints

## Middleware Risks if Omitted
- Missing tenant guard -> cross-store leaks.
- Missing idempotency -> duplicate financial writes.
- Missing DTO validation -> contract drift and corrupt state.
- Missing audit trail -> no forensic reconstruction for destructive ops.

## Design Constraint
Middleware decisions are **blocking controls**, not best-effort logging. Requests failing auth/scope/validation/idempotency never enter domain mutation logic.
