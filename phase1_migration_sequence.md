# Phase 1 — Migration Sequence (Design)

## Migration Style
Incremental strangler migration with explicit phase gates. No big-bang rewrite.

## Stage Plan

### Stage 0 — Pre-Implementation Freeze
- Lock baseline and phase-0 invariant fixtures.
- Finalize DTO contracts and error envelope format.

### Stage 1 — Foundation
- Stand up backend skeleton (NestJS).
- Implement auth + tenancy parity middleware/guards.
- Add Mongo connection, core repositories, audit base.

### Stage 2 — Lower-Risk Domains
- Products and category/variant/color APIs.
- Customer read + profile CRUD APIs.
- Next.js shell and typed API client baseline.

### Stage 3 — High-Risk Core
- Transaction create + settlement + stock mutation APIs.
- Transaction update/delete reconciliation APIs.
- Finance shift open/close and expense APIs.

### Stage 4 — Procurement + Imports/Exports
- Inquiry->confirmed->purchase->receive APIs with lineage guards.
- Import pipeline validation + async jobs.
- Export/report endpoints with versioned contract outputs.

### Stage 5 — Cutover and Decommission
- Route/domain cutover to backend APIs.
- Disable direct Firestore write paths.
- Retire legacy compatibility adapters once stable.

## Hard Gates
- Gate A: Auth/verification/tenant isolation parity.
- Gate B: Sale/return/update/delete + stock/due parity.
- Gate C: Shift close and cashbook parity.
- Gate D: Procurement lineage/receive parity.
- Gate E: Import/export/upload parity.

## Rollback Rule
After each stage, preserve feature-flag rollback to prior stable path until parity and burn-in checks pass.

## Exact Next Step After Phase 1
Start **Stage 0 execution**: lock DTO contracts + invariant fixtures, then scaffold backend foundation (auth/tenancy/middleware first).
