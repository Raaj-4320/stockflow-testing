# Phase 2A — Implementation/Scaffold Boundary Decisions (ADR)

## ADR-2A-001: Scaffold Before Domain Build
- **Decision:** Build cross-cutting skeletons first.
- **Reason:** Reduces risk of inconsistent auth, validation, and observability when domains start.

## ADR-2A-002: Lock Contracts Before Business Logic
- **Decision:** Freeze v1 DTO and error contracts prior to domain implementation.
- **Reason:** Prevents contract drift and rework across frontend/backend.

## ADR-2A-003: Invariant Fixtures Before Transaction Logic
- **Decision:** Define and baseline invariant fixtures before tx/finance/procurement coding.
- **Reason:** High-risk logic needs objective parity checks before implementation.

## ADR-2A-004: Auth/Tenant Before Products and Beyond
- **Decision:** Auth + tenant context foundation is first real module.
- **Reason:** Every domain requires trusted store-scoped access controls.

## ADR-2A-005: Delay Finance/Procurement Implementation
- **Decision:** Finance and procurement start only after transaction lifecycle parity.
- **Reason:** They depend on transaction correctness and carry high downstream risk.

## ADR-2A-006: Frontend Migration Waits for Backend Foundations
- **Decision:** No frontend cutover work until backend contracts and gates stabilize.
- **Reason:** Avoids dual instability and drift in payload assumptions.

## ADR-2A-007: Firestore Remains Active During 2A
- **Decision:** No Firestore cutover/decommission in this phase.
- **Reason:** 2A is scaffold + safety planning, not data-source switch.
