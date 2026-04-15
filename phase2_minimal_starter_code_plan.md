# Phase 2A — Optional Minimal Starter Code Plan

## Safe to Scaffold Immediately
1. NestJS app bootstrap (`main.ts`, `app.module.ts`).
2. Config module with env schema validation.
3. Structured logger module/service.
4. Request ID middleware and response propagation.
5. Global validation pipe (unknown-field rejection enabled).
6. Global exception filter with locked error envelope.
7. Health module/controller (`/health/live`, `/health/ready`).
8. Auth guard skeleton (no full provider migration).
9. Tenant guard skeleton + request tenant context contract.
10. Idempotency middleware skeleton (header parse + adapter interface).
11. Mongo connection module skeleton + schema registry shell.
12. Empty domain module stubs (products/customers/transactions/finance/procurement/reports/uploads).
13. Test harness bootstrap and invariant fixture directory scaffolding.

## Unsafe to Implement in Phase 2A (Must Wait)
1. Full transaction settlement/reconciliation logic.
2. Transaction update/delete compensation behavior.
3. Shift close cashbook formulas.
4. Procurement conversion and receipt stock/cost logic.
5. Full import mutation pipelines.
6. Export generation rewrites with schema behavior changes.
7. Firestore->Mongo production cutover.
8. Frontend endpoint rewiring/cutover.

## Minimal Starter Code Acceptance Criteria
- App starts with validated config.
- Request ID, logger, validation, exception filter are globally active.
- Auth/tenant guards and health endpoint are wired.
- Mongo module connects and reports readiness.
- No high-risk business behavior is implemented yet.
