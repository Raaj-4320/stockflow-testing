# Procurement Receive Invariants Plan (Phase 5B.4)

Date: 2026-04-30
Scope: Receive planning + fixtures only (no runtime receive behavior)

## 1) Receive lifecycle (planned)

Proposed receive lifecycle for a purchase order:
1. Validate tenant/store context and auth.
2. Load order by `orderId` in tenant scope.
3. Validate order state is receivable (`draft`/`placed`, not `received`/`cancelled`).
4. Validate optimistic version (`expectedVersion`) when provided.
5. Validate receive method:
   - `avg_method_1`
   - `avg_method_2`
   - `no_change`
   - `latest_purchase`
6. Apply each line by `sourceType`:
   - `inventory`: update existing product stock + buy-price + purchase history.
   - `new`: materialize product from pending line metadata only at receive time.
7. Mark order `received`, set `receivedQuantity`, bump version/update timestamp.
8. Persist idempotency commit (planned) so duplicate same-key requests replay safely.

---

## 2) Inventory-source receive behavior invariants

For `sourceType: inventory` lines:
- Product must already exist in same store.
- Quantity is added to stock (variant/color aware when provided).
- Buy-price update follows selected receive method.
- `totalPurchase` and variant-row purchase counters update consistently.
- Purchase history is appended with:
  - `previousStock`
  - `previousBuyPrice`
  - `nextBuyPrice`
  - `quantity`
  - `unitPrice`
  - variant/color identity
  - reference (`PO:<orderId>`) and notes

No transaction ledger mutation is part of receive baseline.

---

## 3) New-source materialization behavior invariants

For `sourceType: new` lines:
- No inventory mutation before receive.
- Receive creates a product record in same store with:
  - pending barcode/name/category/image/hsn/variants/colors
  - initial stock from receive quantity
  - buy price from line unit cost
  - purchase history initial entry
- New product is materialized exactly once per processed line in successful receive apply.

---

## 4) Buy-price method invariants

### `no_change`
- Keep existing buy price unchanged.

### `latest_purchase`
- Set buy price to incoming line unit cost.

### `avg_method_1`
- Weighted average by quantity using variant-level existing quantity for variant lines, product-level for non-variant lines.

### `avg_method_2`
- Weighted average by quantity using product-level existing quantity.

All methods round as current legacy behavior dictates (2 decimals).

---

## 5) Purchase history append expectations

Each applied line appends a new history entry at the head of purchase history with:
- stable metadata fields (`date`, `variant`, `color`, `quantity`, `unitPrice`, `previousStock`, `previousBuyPrice`, `nextBuyPrice`)
- receive reference binding to order (`PO:<id>`)
- optional order notes included as history notes

History append must be deterministic and non-duplicating under idempotent replay.

---

## 6) Duplicate receive behavior expectations

Planned expected behavior:
- Same idempotency key + same payload => `replayed`, no second stock/price/history mutation.
- Fresh key attempt on already-received order => reject with `PROCUREMENT_ORDER_ALREADY_RECEIVED`.

---

## 7) Version/idempotency expectations

- `expectedVersion` mismatch => `PROCUREMENT_ORDER_VERSION_CONFLICT`.
- Missing/invalid receive method => `PROCUREMENT_INVALID_RECEIVE_METHOD`.
- Invalid source type in line => `PROCUREMENT_INVALID_SOURCE_TYPE`.
- Product materialization failure for `new` line => `PROCUREMENT_PRODUCT_MATERIALIZATION_FAILED`.

Idempotency planning:
- use `(storeId, operation=receive_order, idempotencyKey)` keyspace.
- persist payload hash + accepted response.

---

## 8) Tenant/store isolation invariants

- Order/party/product lookups and writes are strictly scoped by `storeId`.
- Cross-store order IDs must not be receivable.
- New product materialization must occur only in request store.

---

## 9) Error-case invariants

Minimum expected errors for implementation phase:
- order not found (`PROCUREMENT_ORDER_NOT_FOUND`)
- party not found (if required during consistency checks)
- invalid order state (`PROCUREMENT_INVALID_ORDER_STATE`)
- already received (`PROCUREMENT_ORDER_ALREADY_RECEIVED`)
- version conflict (`PROCUREMENT_ORDER_VERSION_CONFLICT`)
- invalid receive method (`PROCUREMENT_INVALID_RECEIVE_METHOD`)
- invalid source type (`PROCUREMENT_INVALID_SOURCE_TYPE`)
- materialization failed (`PROCUREMENT_PRODUCT_MATERIALIZATION_FAILED`)

---

## 10) Exact test matrix for implementation phase (Phase 5B.5+)

1. Receive inventory line with `no_change` (stock increments, buyPrice unchanged).
2. Receive inventory line with `latest_purchase` (buyPrice set to incoming).
3. Receive inventory variant line with `avg_method_1` (variant-qty weighted).
4. Receive inventory line with `avg_method_2` (product-qty weighted).
5. Receive new-source line materializes product with expected baseline fields.
6. Mixed order (inventory + new) applies both branches correctly.
7. Purchase history append integrity per applied line.
8. Duplicate receive same key replays without side effects.
9. Duplicate receive fresh key rejects as already received.
10. Version conflict rejection.
11. Invalid receive method rejection.
12. Invalid source type rejection.
13. Tenant isolation: cross-store receive blocked.
14. Not-found order rejection.
15. Received order update remains blocked after receive completion.

---

## 11) Phase boundary confirmation

This plan intentionally does **not** add runtime receive endpoint or write behavior.
It is a preparatory artifact for safe, test-first implementation in later phase.
