# Procurement Phase 5B.7 — New-source Product Materialization Plan (Planning Only)

Date: 2026-04-30  
Scope: Planning artifact only. No runtime behavior changes.

## 1) Executive verdict
Proceed to implementation phase only with a narrow, test-first path that extends the existing receive flow for `sourceType: new` lines while preserving all inventory-source behavior exactly as-is.

## 2) Current deferred boundary (why new-source is blocked today)
Current receive logic intentionally rejects `sourceType: new` lines with `PROCUREMENT_INVALID_SOURCE_TYPE`. This is correct for the hardening phase because:
- product-creation validation rules were not yet locked for receive-time materialization,
- idempotency semantics for mixed materialization + inventory mutation were not finalized,
- schema consistency for optional media and richer product metadata was not yet scoped.

## 3) Required product fields for materialization
For each `sourceType: new` line, materialization requires:
- `name` (from line draft name / `productName`)
- `barcode` (from pending barcode)
- `variants` / `colors` (normalized arrays)
- `buyPrice` (initial purchase cost from line `unitCost`)
- `sellPrice` (required from pending draft, else deterministic fallback)
- optional: `hsn`, `description`, `image`

## 4) Validation rules
### Required fields
- `name`: non-empty trimmed string
- `barcode`: non-empty trimmed string
- `quantity`: `> 0`
- `unitCost`: `>= 0`
- `sellPrice`: must resolve to a valid number by payload or fallback policy

### Uniqueness constraints
- Barcode must be unique per store (reuse existing product uniqueness behavior).
- If barcode already exists in store and is active, receive must fail with deterministic error.

### Variant/color normalization
- Normalize variant/color values by current product normalizer rules:
  - trim whitespace,
  - collapse empty to `''` at row level where required,
  - deduplicate normalized lists,
  - keep row identity stable for stockByVariantColor mapping.

## 5) Materialization mapping (pending order line → product entity)
For each new-source line:
1. Read pending line metadata (`productName`, pending barcode, category, optional image, optional draft metadata).
2. Build product create payload in current product-repo shape:
   - `name` ← pending/draft name fallback to `productName`
   - `barcode` ← pending barcode
   - `category` ← line category or safe default (explicit rule)
   - `imageUrl` ← mapped image value under media policy
   - `buyPrice` ← `unitCost`
   - `sellPrice` ← pending draft sell price or explicit fallback
   - `stock` ← materialized quantity for that line aggregation
   - `variants`/`colors`/`stockByVariantColor` ← normalized line values
3. Persist product in same `storeId` context only.

### Order metadata mapping
- Receive reference remains `PO:<orderId>`.
- Receive note/order note propagates to first purchase-history entry notes.

## 6) Variant/color stock initialization
### Initial stock rules
- Product-level `stock` equals total received quantity for that materialized new product within the order application.

### Per-row mapping
- Initialize `stockByVariantColor` with deterministic rows from receive lines:
  - row key: `(variant, color)` normalized,
  - row stock: summed quantity for matching row key,
  - row ordering: stable deterministic order (first-seen order from lines).

## 7) Buy-price + sell-price behavior
### Initial buy price
- Set to line `unitCost` for single-line materialization.
- For aggregated multi-line same pending product materialization, compute weighted average by quantity and round using current 2-decimal behavior.

### Sell price defaulting
- Preferred: explicit pending draft `sellPrice`.
- Fallback (if missing): set equal to `buyPrice` (safe deterministic fallback for no-negative-margin surprise avoidance must be explicitly documented in tests).

## 8) Image/media handling
- If pending draft provides image value compatible with current product `imageUrl` expectations, persist as `imageUrl`.
- If missing/invalid, persist `null` and continue (no receive failure solely due to image absence).
- Do not add external media upload/transformation in this phase.

## 9) Purchase history expectations
For first materialization entry (history head):
- `date`: receive apply timestamp
- `variant`, `color`
- `quantity`
- `unitPrice`
- `previousStock`: `0`
- `nextStock`: initialized row/product stock after receive
- `previousBuyPrice`: `0`
- `nextBuyPrice`: assigned initial buy price
- `receiveMethod`
- `reference`: `PO:<orderId>`
- `notes`: receive note or order note

History format must remain consistent with current inventory receive history shape.

## 10) Idempotency / duplicate receive behavior
- Keep existing duplicate protection: already-received order rejects with `PROCUREMENT_ORDER_ALREADY_RECEIVED`.
- If explicit idempotency keys are introduced later, they must replay without creating duplicate products or duplicate history entries.
- Materialization apply must be atomic with order status transition in repository semantics.

## 11) Version control rules
- Preserve `expectedVersion` guard before any materialization writes.
- Version conflict must short-circuit with `PROCUREMENT_ORDER_VERSION_CONFLICT`.
- On successful apply: order version increments once via normal order update path.

## 12) Tenant/store isolation
- All lookups and writes (orders + products) are scoped by `storeId`.
- No cross-store barcode checks beyond current tenant scope.
- Materialized product must always carry request tenant storeId.

## 13) Error cases
Minimum deterministic errors for Phase 5B.8:
- `PROCUREMENT_ORDER_NOT_FOUND`
- `PROCUREMENT_ORDER_ALREADY_RECEIVED`
- `PROCUREMENT_ORDER_VERSION_CONFLICT`
- `PROCUREMENT_INVALID_SOURCE_TYPE` (only for unknown source types after new-source enable)
- `PRODUCT_DUPLICATE_BARCODE` (or mapped procurement-specific duplicate barcode code if contract already defines one)
- `PROCUREMENT_PRODUCT_MATERIALIZATION_FAILED` (construction/persistence failure)
- validation failure errors for missing required pending metadata

## 14) Exact implementation test matrix
1. New-source single line materializes product with expected required fields.
2. New-source materialization initializes product stock and stockByVariantColor correctly.
3. New-source purchase history first entry contains all required metadata fields.
4. New-source with missing required barcode fails deterministically.
5. New-source duplicate barcode in same store fails deterministically.
6. New-source same barcode in different store is allowed (tenant isolation).
7. Mixed order (inventory + new) applies both branches in one receive and marks order received.
8. Mixed order failure on new-source validation causes no partial double-apply behavior.
9. Version conflict rejects before any product creation.
10. Duplicate receive after success remains non-destructive and creates no extra products.
11. Path/body order id mismatch rejection still enforced.
12. Receive note/order notes propagate to materialized history entry.
13. Image missing/invalid falls back to `null` without failing receive.
14. Sell price fallback rule is deterministic and tested.
15. Existing inventory-only tests remain unchanged and passing.

## 15) Phase 5B.8 execution plan (safe step-by-step)
1. **Lock baseline first**: keep all current inventory receive tests green.
2. **Add failing tests** for new-source-only happy path and validation failures.
3. **Implement payload extraction/normalization** for pending new-source metadata in procurement service (no abstractions).
4. **Implement product creation call** through existing product repository/service rules in tenant scope.
5. **Implement stock initialization mapping** for materialized product rows.
6. **Implement first purchase-history entry** for newly created product (same structure as inventory receive).
7. **Enable mixed-order execution** (`inventory` + `new`) with deterministic line ordering.
8. **Preserve receive finalization**: order status/receivedQuantity update only after all line applies succeed.
9. **Add negative-path guards** (missing fields, duplicate barcode, version conflict) with explicit error assertions.
10. **Re-run full backend tests/build** and verify no transaction/finance behavior drift.
11. **Publish closeout report** documenting new-source scope completion and unchanged boundaries elsewhere.

---
Planning-only confirmation: this document introduces no runtime/materialization code changes.
