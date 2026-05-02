# Procurement Phase 5C.1 — Frontend Cutover Planning Gate

Date: 2026-04-30  
Scope: Planning/report only. No frontend/backend/runtime/API contract changes.

## 1) Executive verdict
**GO (planning gate only)** for a guarded frontend cutover implementation phase.

Rationale:
- Backend procurement baseline is complete and parity-audited.
- Core receive behaviors (inventory + new-source + mixed) are present and tested.
- Remaining concerns are integration compatibility/migration safety, not missing backend fundamentals.

## 2) Current legacy Purchase Panel call map
Current `pages/PurchasePanel.tsx` uses storage-layer functions directly:
- Read
  - `loadData()` for product snapshot and supporting lists
  - `getPurchaseOrders()`
  - `getPurchaseParties()`
- Write
  - `createPurchaseParty()`
  - `updatePurchaseOrder()`
  - `createPurchaseOrder()`
  - `receivePurchaseOrder(orderId, method)`
- Utility/data preparation
  - variant/color stock row utilities (via `getProductStockRows` and storage normalization behavior)
  - pending new-product draft assembly in UI before receive.

## 3) Target backend API map
Backend procurement API surface target for future UI wiring:
- Parties
  - `GET /procurement/parties`
  - `GET /procurement/parties/:id`
  - `POST /procurement/parties`
  - `PATCH /procurement/parties/:id`
- Orders
  - `GET /procurement/orders`
  - `GET /procurement/orders/:id`
  - `POST /procurement/orders`
  - `PATCH /procurement/orders/:id`
- Receive
  - `POST /procurement/orders/:id/receive`

## 4) Legacy function → backend endpoint mapping table
| Legacy function | Current purpose | Target backend endpoint | Adapter notes |
|---|---|---|---|
| `getPurchaseParties()` | List parties | `GET /procurement/parties` | Map query search/archive flags when needed. |
| `createPurchaseParty(party)` | Create party | `POST /procurement/parties` | Normalize nullable optional fields. |
| `updatePurchaseParty(party)` (legacy storage-level behavior) | Update party | `PATCH /procurement/parties/:id` | Include `expectedVersion` once UI has version token. |
| `getPurchaseOrders()` | List orders | `GET /procurement/orders` | Preserve status/party filters and sorting in UI. |
| `createPurchaseOrder(order)` | Create order | `POST /procurement/orders` | Map lines exactly by `sourceType` + pending fields. |
| `updatePurchaseOrder(order)` | Edit order | `PATCH /procurement/orders/:id` | Respect backend received-order lock. |
| `receivePurchaseOrder(orderId, method)` | Receive + inventory/materialize | `POST /procurement/orders/:id/receive` | Send `orderId`, `expectedVersion`, `receiveMethod`, optional note. |

## 5) Data shape compatibility matrix
| Domain | Legacy shape | Backend shape | Compatibility |
|---|---|---|---|
| Party | Local object w/ optional fields | DTO with explicit validation | Near-compatible (adapter for nullable fields). |
| Order header | Includes party/bill/gst/notes/status | DTO mirrors these fields | Compatible. |
| Order lines | `inventory` + `new`; pending fields in line | Same source model in procurement DTO | Compatible with careful field normalization. |
| Receive method | 4 method strings | Same 4 enum strings | Compatible. |
| Product fallback labels | Often `No Variant`/`No Color` semantics | Backend currently may use `Default` fallback for missing variant/color in new-source path | Requires explicit compatibility decision in adapter/UI display logic. |
| Optional draft metadata | Legacy draft carries `description`, `hsn`, image | Backend product contract currently narrower | Requires documented drop/preserve policy during cutover. |

## 6) Required frontend adapter plan
Implement a **thin procurement adapter layer** (next phase) without changing backend contracts:
1. Encapsulate all Purchase Panel procurement calls behind adapter functions.
2. Translate legacy storage function input/output shapes to backend DTOs/responses.
3. Preserve existing UI state semantics (wizard state, receive preview, optimistic edits).
4. Centralize normalization decisions:
   - variant/color fallback token presentation,
   - optional metadata preservation/drop behavior,
   - error-code to UI-message mapping.
5. Keep adapter explicit; avoid generic runtime orchestration frameworks.

## 7) Guard / feature-flag plan
Use a single scoped flag (example: `procurementBackendEnabled`) with staged rollout:
- OFF: existing legacy storage path only.
- SHADOW: legacy remains source of truth; backend calls run in parallel for comparison/logging only.
- CANARY: selected tenant/store routes write/read through backend adapter.
- ON: backend adapter primary path; legacy fallback still available for fast rollback window.

Flag must be reversible without redeploy-risky schema changes.

## 8) Shadow parity testing plan
Before any canary writes:
1. Select representative sample scenarios:
   - party create/update,
   - order create/edit,
   - inventory-only receive,
   - new-source receive,
   - mixed receive.
2. For each scenario, compare legacy vs backend outputs:
   - status transitions,
   - quantities/amounts,
   - buy-price outcomes,
   - stockByVariantColor results,
   - error codes on expected failures.
3. Log parity mismatches into a fixed matrix and classify:
   - cosmetic/UI-only,
   - adapter-fixable,
   - backend-critical.
4. Block canary until no backend-critical mismatches remain.

## 9) Rollback plan
If cutover issues occur:
1. Flip feature flag to legacy path immediately.
2. Freeze new backend writes for affected stores.
3. Capture failed payload + backend response + UI context snapshot.
4. Reconcile impacted purchase orders/products manually with audit logs.
5. Re-run shadow parity before re-enabling canary.

Rollback trigger should not require changing contracts or deploying code hotfixes first.

## 10) Known compatibility decisions
### Variant/color fallback tokens
- Decision: keep UI display compatibility with legacy semantics (`No Variant` / `No Color`) even if backend internal fallback differs.
- Adapter responsibility: normalize for display and comparison logic.

### Optional metadata fields
- Decision: `description` and `hsn` are **best-effort** during initial cutover unless backend contract expands later; do not block receive on missing optional metadata.

### Image/media behavior
- Decision: continue lightweight pass-through of image string where supported; no media pipeline expansion in cutover phase.

### GST metadata
- Decision: treat `billNumber`, `billDate`, `gstPercent` as required parity-critical fields and block go-live if drift found.

## 11) What must remain frozen
- No frontend cutover implementation in this planning gate.
- No backend behavior changes.
- No procurement contract redesign.
- No transaction logic or finance formula changes.
- No payment/return update-delete scope changes.

## 12) NO-GO conditions for cutover
Cutover execution must be blocked if any of these are unresolved:
1. Backend-critical parity mismatches in receive outcomes (stock/buy-price/history/order status).
2. Unhandled version-conflict or duplicate-receive UX paths in adapter.
3. Tenant-scope leakage risk in canary telemetry.
4. Inability to rollback safely via flag.
5. GST metadata drift between legacy and backend for audited sample set.

## 13) Recommended implementation sequence for the next phase
1. Add adapter interface and map read-only calls first.
2. Add write adapters for parties/orders (without switching receive yet).
3. Enable shadow mode for receive payload/response comparison.
4. Resolve compatibility decisions in adapter layer (tokens/optional metadata/error mapping).
5. Run canary on controlled stores with rollback rehearsed.
6. Promote gradually only after parity matrix stays green.

---
Planning-gate confirmation: this document is planning only and introduces no runtime changes.
