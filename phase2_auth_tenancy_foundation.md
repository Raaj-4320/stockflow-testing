# Phase 2A — Auth + Tenancy Foundation Blueprint

## 1) Auth Strategy (Foundation)
- Use token/session abstraction that supports transitional provider bridging.
- Do not force immediate provider cutover in 2A.
- Expose authenticated principal as request context object.

## 2) Verified-User Policy
- Verified status must be enforced server-side on protected mutation endpoints.
- Unverified users may access only allowed auth/verification endpoints.
- Policy parity with current verified-owner model is mandatory before domain writes.

## 3) Store/Tenant Resolution
Resolution priority:
1. Auth token claim (preferred canonical store context).
2. Explicit header/route store selector only if authorized and validated.
3. Fallback denied when ambiguous.

## 4) Request-Scoped Tenant Context
Each protected request derives and carries:
- `actorId`
- `storeId`
- `isVerified`
- `roles/capabilities`
- `requestId`

This context is required for repository and audit operations.

## 5) Store Isolation Rules
- Every tenant-owned query requires `storeId` filter from resolved context.
- Never trust client-provided `storeId` without guard verification.
- Cross-tenant access attempts return authorization error and audit event.

## 6) First-Login / Store Bootstrap Strategy
- Keep bootstrap behavior parity with current runtime expectations.
- On first verified login, ensure store shell/config exists.
- Bootstrap operation must be idempotent and auditable.

## 7) Extensibility: Multi-User / Membership
- Keep initial model owner-centric for parity.
- Design tenancy service with future `store_memberships` extension points.
- Role capability map can remain coarse in Phase 2A and expand later.

## 8) Phase 2A Security Acceptance Criteria
- Auth guard/tenant guard scaffolds defined and testable.
- Verified policy explicitly documented and wired to protected route strategy.
- Tenant context contract locked and used by all future domain templates.
