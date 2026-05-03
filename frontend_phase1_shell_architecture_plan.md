# Frontend Phase 1 — Next.js Shell Architecture Plan

Date: 2026-05-01  
Scope: Planning-only. No legacy move, no cutover, no backend/API behavior changes.

## 1) Executive verdict
**GO** for a small, controlled Phase 1 implementation path that strengthens the `frontend/` Next.js shell foundations without migrating legacy pages yet.

## 2) Current frontend split
### Root legacy Vite app (active)
- Current production-path UI remains at repository root.
- Existing routing, page behavior, and storage-driven flows remain unchanged.

### `frontend/` Next.js shell (isolated)
- App Router scaffold exists as future workspace.
- Placeholder routes exist for home and procurement.
- No procurement backend wiring and no legacy service imports.

## 3) Target Next.js folder structure
Keep structure intentionally small:

```text
frontend/
  app/
  features/
  shared/
  lib/
  services/
```

Planned responsibilities:
- `app/`: route shells, layout, route-level metadata.
- `features/`: domain-oriented UI slices (e.g., future procurement feature module).
- `shared/`: reusable UI primitives and common visual patterns.
- `lib/`: pure utilities (formatters, guards, mapping helpers).
- `services/`: API/adapters and environment-aware service clients.

## 4) Routing plan
Phase 1 route stance:
- Keep existing:
  - `/` (shell home)
  - `/procurement` (placeholder)
- Add only lightweight informational shell routes if needed (no legacy parity claims yet).
- Do not route production traffic from root app to `frontend/` in this phase.

## 5) Shared UI/component plan
- Introduce only minimal shell primitives first (layout wrappers, section headers, empty states).
- Do not copy large legacy components into `frontend/`.
- Prefer composable, feature-local components in `features/` and promote to `shared/` only when reused.

## 6) API adapter plan
- Keep API clients in `frontend/services/` and mapper/helpers in `frontend/lib/`.
- Adapter rules:
  - thin wrappers only,
  - explicit request/response mapping,
  - no generic API framework.
- No procurement API wiring in Phase 1 implementation scope.

## 7) Auth/tenant context plan
- Phase 1: define interfaces/contracts only (context shape and provider boundary), no production auth switch.
- Suggested context shape (future):
  - `storeId`
  - `userId`
  - `roles/permissions`
  - `token/session metadata`
- Integrate with backend auth/tenant headers only in later phase after adapter and route shell readiness.

## 8) Feature flag strategy
- Use environment flags for incremental enablement:
  - shell visibility flags (future)
  - procurement feature flags (future)
- Defaults should keep behavior inert/off until explicit enablement.
- No flag should alter root legacy app behavior in this phase.

## 9) Procurement future wiring plan
When Phase 2 starts (not now):
1. Add procurement service client in `frontend/services/` using backend procurement contracts.
2. Build procurement read-only views first (list/get), with placeholder write controls disabled.
3. Add controlled write actions later with explicit error mapping.
4. Preserve legacy parity checkpoints before any receive/action wiring.

## 10) What must remain frozen
- Root Vite app structure and routing.
- Legacy `pages/`, `components/`, `services/` files.
- Backend behavior and contracts.
- Procurement cutover and production routing.
- Finance/transaction scope boundaries.

## 11) Risks and unknowns
- Parallel-frontend drift risk if shell grows without parity checkpoints.
- Inconsistent UI semantics risk if shared design primitives are not defined early.
- Auth/tenant propagation assumptions may diverge from backend expectations if not contract-checked.
- Team/operator confusion risk with two runnable frontends in one repo.

## 12) Simplification rules
1. No large legacy UI duplication into `frontend/`.
2. No generic API framework or plugin-heavy abstraction.
3. Build one thin layer at a time: routes → shared primitives → adapters.
4. Keep each phase independently reversible.
5. Prefer documentation + checklists over broad scaffolding.

## 13) Recommended next implementation phase
**Frontend Phase 1.1 — Shell Foundations (Implementation)**
- Add minimal shared shell components (header/container/empty state).
- Add typed environment/config helper in `frontend/lib/`.
- Add placeholder feature module skeleton in `features/procurement/` without backend calls.
- Add developer runbook for dual-frontend workflows.
- Re-run build checks for root app, backend, and `frontend/`.

---
Planning confirmation: this document introduces no runtime wiring, no backend changes, and no cutover behavior.
