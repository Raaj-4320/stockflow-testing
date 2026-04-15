# Phase 2A — Backend Foundation Execution Plan

## 1) Scope: What Phase 2A Covers
Phase 2A is a **foundation-first implementation planning/scaffolding phase** to prepare a safe backend migration path.

### In-scope
1. Backend project structure and bootstrap sequence.
2. NestJS module scaffolding strategy.
3. Auth + tenancy foundation design.
4. Middleware/guard/filter/interceptor skeleton design.
5. DTO/error contract locking strategy.
6. MongoDB persistence foundation strategy (not full domain models).
7. Invariant fixture strategy and run cadence.
8. Safety gate matrix and Phase 2B readiness criteria.

## 2) Explicitly Out of Scope (Do NOT Do in Phase 2A)
1. Full domain migration from client/runtime to backend.
2. Frontend page rewrites or cutover.
3. Firestore decommission or hard switch to MongoDB.
4. High-risk business logic rewrites (transaction reconciliation, finance close, procurement receipt math).
5. Removal of existing runtime files or production pathways.

## 3) Source-of-Truth Inputs (Must Stay Authoritative)
- Phase 0 do-not-break invariants and critical flow matrix.
- Phase 0 business rules and risk register.
- Phase 1 architecture decisions, module boundaries, contract and middleware blueprints.

## 4) Non-Negotiable Guardrails
1. Preserve stock bucket identity behavior.
2. Preserve settlement + due/store-credit + return mode behavior.
3. Preserve transaction update/delete reconciliation behavior.
4. Preserve shift/cashbook behavior.
5. Preserve procurement lineage and receive-side effects.
6. Preserve import/export compatibility and media persistence expectations.
7. Preserve verified-user + tenant isolation + store bootstrap behavior.

## 5) Phase 2A Implementation Order (Strict)
1. Repo/backend folder scaffold + package/config baseline.
2. Cross-cutting bootstrap (logger, request ID, validation, exception filter, health).
3. Auth + tenancy skeleton (guards, tenant context, verified policy hooks).
4. DTO/error contract lock + versioning policy lock.
5. MongoDB foundation scaffold (connection, registry, index policy, base repository patterns).
6. Invariant fixture scaffolding and CI gate wiring plan.
7. Domain start-order lock and Phase 2B readiness signoff.

## 6) Dependency Order
| Step | Depends on | Blocks |
|---|---|---|
| App bootstrap | package/env config | all modules |
| Request ID + logger | app bootstrap | audit correlation, incident triage |
| Validation + exception filter | app bootstrap | contract locking enforcement |
| Auth guard scaffold | config + logger | tenant guard, protected routes |
| Tenant context scaffold | auth scaffold | all domain repository calls |
| Contract lock | validation + exception baseline | domain implementation |
| Mongo foundation | config + tenancy model decision | repositories and modules |
| Fixture strategy | contracts + invariant mapping | high-risk domain implementation |

## 7) Expected Outputs From Phase 2A
- Locked Phase 2 design docs (this bundle).
- Backend bootstrap checklist with status classifications.
- Contract lock policy (DTO ownership, error envelopes, compatibility rules).
- Invariant fixture blueprint with domain dependencies and run timing.
- Safety gate matrix with evidence requirements.
- Domain start order and explicit “not yet” boundaries.

## 8) Readiness Criteria for Phase 2B
Phase 2B may start only when all are true:
1. Auth/tenant skeletons and request context contract are defined and testable.
2. Global validation + unknown-field rejection + error envelope are locked.
3. Correlation/request ID contract and idempotency header contract are locked.
4. Mongo foundation design is approved (connection, index lifecycle, env strategy).
5. Invariant fixture sets are defined with expected outputs and owners.
6. Safety gates are accepted by backend + migration owners.

## 9) Known Uncertainties and Safe Defaults
- **Uncertainty:** final auth token provider transition timeline.
  - **Safe default:** transitional token adapter boundary; no provider hard cutover in 2A.
- **Uncertainty:** report generation execution location (sync vs async jobs).
  - **Safe default:** design async-capable contract and keep runtime behavior unchanged.
- **Uncertainty:** cross-environment Mongo transaction guarantees.
  - **Safe default:** avoid multi-document transaction dependency in early modules; use idempotent writes and explicit ordering.
