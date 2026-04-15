# Phase 2A — MongoDB Foundation Blueprint

## 1) Connection Strategy
- Single shared Mongo connection module with lifecycle hooks (`onModuleInit`, `onModuleDestroy`).
- Fail-fast startup on invalid URI or auth failure.
- Health indicator checks connection state and command round-trip.

## 2) Config/Env Requirements
Required env keys (minimum):
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `MONGODB_APP_NAME`
- `MONGODB_MIN_POOL_SIZE`
- `MONGODB_MAX_POOL_SIZE`
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS`
- `MONGODB_SOCKET_TIMEOUT_MS`

Optional per environment:
- `MONGODB_TLS`
- `MONGODB_REPLICA_SET`
- `MONGODB_READ_PREFERENCE`

## 3) Repository Strategy
- Base repository enforces explicit `storeId` filter inputs for all tenant data operations.
- No raw collection access from controllers.
- Domain services call repositories; repositories remain persistence-focused.

## 4) Schema Registration Strategy
- Central schema registry file to register all schemas with module ownership tags.
- Domain modules import only their owned schemas.
- Shared schema fragments allowed for audit/idempotency metadata.

## 5) Index Management Approach
- Index declarations colocated with schema definitions.
- Startup index sync disabled by default in production; use controlled migration/index job.
- CI/dev supports safe index drift detection report.

## 6) Migration Compatibility Notes
- Keep Firestore as active source during early phases.
- Backfill/migration adapters must be idempotent and reversible.
- Preserve legacy IDs where required for traceability (`legacyId`, `source*Id`).

## 7) Transaction/Session Usage Guidance
- Avoid broad multi-document transactions in early modules.
- Use idempotency + deterministic operation ordering first.
- Introduce Mongo sessions only where invariant proof requires atomic cross-document updates.

## 8) Auditing Collection Approach
- `audit_events` collection is append-only.
- Include: `requestId`, `actorId`, `storeId`, `operation`, `entityRefs`, `timestamp`, `status`.
- Write audit events through audit module service only.

## 9) Environment Guidance
- **Local:** single-node Mongo, relaxed performance tuning, full debug logs.
- **Dev:** shared cluster + masked test data, index drift checks enabled.
- **Staging:** production-like topology, realistic pools/timeouts, fixture replay required.
- **Prod:** controlled index rollout, strict TLS/auth, observability SLO alerts enabled.
