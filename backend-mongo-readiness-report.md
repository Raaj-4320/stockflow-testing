# Backend Mongo Readiness Report (Phase 4A)

Date: 2026-04-29
Scope: Read-only backend Mongo verification against staging migration copy.

## 1) Connection status

- Backend currently **does not establish a real MongoDB connection** in runtime.
- `MongoDbService.onModuleInit()` is still a skeleton and only references config values without creating a `MongoClient`.
- Health `ready` check currently returns `{ ok: true }` from a stub `ping()` implementation.

Status: **Blocked for full runtime verification until MongoDbService implementation is completed**.

## 2) Backend config findings (env + db selection)

### Required backend env vars (existing)
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `MONGODB_APP_NAME`
- `MONGODB_MIN_POOL_SIZE`
- `MONGODB_MAX_POOL_SIZE`
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS`
- `MONGODB_SOCKET_TIMEOUT_MS`

### Staging mapping
To point backend verification to staging Mongo data:
- `MONGODB_URI=$MONGO_URI_STAGING`
- `MONGODB_DB_NAME=$MONGO_DB_STAGING`

### Tenant/store scoping
- Repository and service patterns expect `storeId` scoping for reads.
- Tenant guard resolves store context from auth + optional request store override.

## 3) Readiness smoke checks implemented

A read-only script was added:
- `backend/scripts/verify-mongo-readiness.ts`

Script behavior:
- Connects using `--mongoUri --dbName --storeId`
- Counts expected collections (scoped by `storeId`)
- Samples first 3 docs from `products/customers/transactions`
- Validates presence of required fields for those sample docs
- Aggregates simple revenue total from `transactions.totals.grandTotal`
- Outputs:
  - `backend/mongo-readiness-report.json`
  - `backend/mongo-readiness-report.md`

## 4) API contract compatibility check (code-level)

### Products
Expected DTO fields include:
- `id, storeId, name, barcode, category, imageUrl, buyPrice, sellPrice, stock, variants, colors, stockByVariantColor, isArchived, archivedAt, version, createdAt, updatedAt`

### Customers
Expected DTO fields include:
- `id, storeId, name, phone, email, notes, dueBalance, storeCreditBalance, isArchived, archivedAt, version, createdAt, updatedAt`

### Transactions
Expected DTO fields include:
- root: `id, storeId, type, transactionDate, lineItems, settlement, customer, totals, metadata, createdAt, updatedAt, version`
- line item: `productId, productName, quantity, unitPrice, lineSubtotal` (+ optional sku/variant/color)

### Deleted Transactions
Expected fields include:
- `id, storeId, originalTransactionId, deletedAt, snapshot`

### Detected mismatch risks
1. Runtime repositories for products/customers/transactions are currently in-memory and not backed by Mongo reads.
2. Health check may report ready even if Mongo is unreachable (stub ping).
3. Historical references and optional fields (e.g., import artifacts) are not yet validated against live staging docs through API response mapping.
4. Date/money serialization format is assumed from DTOs but not runtime-proven through current controllers against Mongo.

## 5) Validation execution

Executed:
- `npm run build` (backend) ✅
- `npm run verify:mongo:readiness -- --mongoUri "$MONGO_URI_STAGING" --dbName "$MONGO_DB_STAGING" --storeId "dev-store"` ⚠️ failed because staging env vars were empty in this environment.

No write/update/delete operations were executed.

## 6) Blockers and warnings

Blockers:
- Missing staging env values in current execution environment.
- Backend Mongo service remains scaffolded (no live connection/ping).
- Core read APIs are still wired to in-memory repositories.

Warnings:
- Smoke script can validate staging data directly, but API-level parity cannot be concluded until repositories/services are wired to Mongo read adapters.

## 7) Recommended next step (Phase 4A completion path)

1. Implement real Mongo client lifecycle in `MongoDbService` (connect/ping/close) without changing write paths.
2. Add read-only Mongo repository adapters for products/customers/transactions/deletedTransactions.
3. Toggle read path via feature flag for staging only (Firestore remains source of truth).
4. Run dual-read parity checks (Firestore vs Mongo) for selected endpoints.
5. Re-run readiness script with real staging env vars and attach generated JSON/MD outputs.

## 8) Final status

**Phase 4A is partially complete**:
- Tooling for read verification exists.
- Build passes.
- Full backend Mongo read verification remains blocked pending real Mongo wiring and staging env injection.
