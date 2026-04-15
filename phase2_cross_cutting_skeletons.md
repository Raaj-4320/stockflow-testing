# Phase 2A — Middleware and Cross-Cutting Skeleton Plan

## Skeleton Responsibility Matrix

| Component | Minimal Scaffold Now | Real Logic Later | Must Test Immediately |
|---|---|---|---|
| Auth Guard | parse/validate principal contract, deny unauth | provider-specific token verification and refresh workflows | unauth blocked, auth context attached |
| Tenant Guard | resolve store context, deny missing/mismatch | advanced membership checks and delegated tenancy | tenant mismatch denied, store context set |
| Permissions Guard | role/capability hook with default deny for protected actions | granular permissions per module/action | default-deny behavior and policy wiring |
| Request ID Middleware | accept or generate request ID; attach to request/response | distributed trace integration | requestId present in success + errors |
| Structured Logger | request lifecycle logs with requestId, actor/store placeholders | full redaction strategy, log sinks, metrics correlation | logs emitted on request start/end/error |
| Exception Filter | map errors to locked envelope | domain-specific error code taxonomy expansion | envelope shape stable for validation and auth errors |
| Validation Pipe | whitelist + forbid unknown + transform primitives | per-domain custom validators | unknown field rejection deterministic |
| Idempotency Middleware | parse key header, attach key/context, interface to storage adapter | replay detection and response caching for mutation routes | missing key policy and duplicate-key stub behavior |
| Audit Interceptor | emit operation envelope with request metadata | enriched before/after diffs per domain mutation | audit event emitted for protected mutation stub |
| Health Controller | `/health/live` + `/health/ready` endpoints | dependency-deep checks and SLO metrics | endpoints return stable status payload |
| Config Module | env schema validation + typed accessor | secret manager integration and dynamic config reload | startup fails on invalid env |

## Immediate Test Scope
1. Bootstrap test: app starts with valid env and fails on invalid env.
2. Request pipeline test: request ID + logger + error envelope present.
3. Guard test: auth/tenant rejection behavior.
4. Validation test: unknown fields rejected.
5. Health test: live/ready endpoints stable.

## Deferred Test Scope (Phase 2B+)
- Domain-specific permission matrices.
- End-to-end idempotency replay across real repositories.
- Rich audit diff semantics for transaction/finance/procurement operations.
