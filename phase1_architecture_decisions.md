# Phase 1 — Architecture Decisions (ADR Summary)

## ADR-001: Next.js App Router Frontend
- **Decision:** Use Next.js App Router.
- **Why:** Better long-term route/layout composition and clearer domain separation.

## ADR-002: Separate Backend API
- **Decision:** Introduce dedicated backend service.
- **Why:** Move high-risk business logic out of client runtime.

## ADR-003: Backend Framework = NestJS
- **Decision:** Use NestJS.
- **Why:** Modular architecture + first-class middleware/guards/pipes for policy enforcement.

## ADR-004: MongoDB as System of Record
- **Decision:** Store domain data in MongoDB.
- **Why:** Flexible document model with strong indexability for store-scoped operational workloads.

## ADR-005: DTO-First API Contracts
- **Decision:** All endpoints use explicit DTO request/response contracts.
- **Why:** Prevent payload drift and stabilize migration boundaries.

## ADR-006: Middleware-Driven Protection
- **Decision:** Enforce auth/tenant/validation/idempotency/audit as pipeline controls.
- **Why:** Preserve and harden trust boundaries from Phase 0.

## ADR-007: Domain-Bounded Decomposition
- **Decision:** Split `services/storage.ts` responsibilities by domain ownership.
- **Why:** Reduce blast radius and isolate invariant logic.

## ADR-008: Gradual Strangler Migration
- **Decision:** Cut over domain-by-domain with gates and rollback.
- **Why:** Lower operational risk vs big-bang rewrite.

## ADR-009: Immutable Audit + Lineage
- **Decision:** Keep immutable audit trails and procurement lineage IDs.
- **Why:** Forensic traceability and workflow integrity.

## ADR-010: Phase 0 Invariants as Release Criteria
- **Decision:** No high-risk domain cutover without parity pass.
- **Why:** Protect stock, settlement, customer balances, shift close, and procurement correctness.
