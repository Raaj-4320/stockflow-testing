# Procurement Phase 5A Backend Planning Audit

Date: 2026-04-30
Scope: Planning/audit only (no procurement backend implementation)

## 1. Executive verdict

The legacy procurement flow is feature-rich and currently functional in the frontend/storage layer, while backend procurement is still a bare scaffold. This is the right moment for a planning-only phase.

**Verdict:** GO for Phase 5A planning closeout; **NO-GO** for procurement cutover implementation until contracts, invariants, and receive-flow safety checks are explicitly locked.

---

## 2. Current legacy procurement behavior map

### UI/flow surface
- Purchase Panel has order + party tabs and a multi-step wizard.
- Source mode supports:
  - existing inventory product flow,
  - new pending product draft flow.
- Variant/color rows are supported for line-level pricing/quantities.
- GST bill inputs exist (`billNumber`, `billDate`, `gstPercent`).
- Receive modal supports buy-price update methods:
  - avg method 1,
  - avg method 2,
  - no change,
  - latest purchase.

### Persistence/behavior functions
- Purchase party CRUD (create/update) and purchase order create/update exist in storage service.
- Receive flow (`receivePurchaseOrder`) applies line updates via `applyPurchaseLineToProduct`, then marks order `received`.
- Inventory-source lines update existing product stock + buy price + purchase history.
- New-source lines materialize a product only at receive time.

### Key behavior continuity already noted in legacy audit
- Edit-order flow and GST metadata were added while preserving receive semantics.
- Stock integrity and avg-buy logic are intentionally reused from existing storage-level behavior.

---

## 3. Existing backend procurement scaffold status

- Backend procurement module currently exists only as an empty Nest module scaffold (`@Module({})`), with no controller/service/repository contracts wired yet.
- No procurement read/write APIs are active in backend.

---

## 4. Domain boundaries

### Must stay in procurement domain (future backend)
- Purchase parties/suppliers.
- Purchase orders (draft/placed/received lifecycle).
- Receive operations and line-level inventory materialization metadata.
- Purchase bill metadata (GST bill number/date/percent and computed totals).

### Cross-domain touch points (strictly orchestrated)
- Products: stock, variant/color rows, buy-price updates, purchase history append.
- (Optional later) Finance read exposure: procurement artifacts as source-visible only unless explicitly blended.

### Must stay out-of-scope in Phase 5A/5B initial
- Transaction mutation engine changes.
- Payment/return update-delete widening.
- Frontend migration/cutover.
- Procurement-finance formula blending.

---

## 5. Proposed DTO/contracts needed later (planning)

Keep minimal and explicit (no generic engine):

1. `CreatePurchasePartyDto`
2. `UpdatePurchasePartyDto`
3. `ListPurchasePartiesQueryDto`
4. `CreatePurchaseOrderDto`
5. `UpdatePurchaseOrderDto` (edit before receive)
6. `ListPurchaseOrdersQueryDto`
7. `GetPurchaseOrderByIdResponseDto`
8. `ReceivePurchaseOrderRequestDto`
   - includes receive method (`avg_method_1|avg_method_2|no_change|latest_purchase`)
   - expected order version/idempotency fields
9. `PurchaseOrderResponseDto` / `PurchasePartyResponseDto`
10. Error code additions (procurement-specific, version conflict, invalid state, already received)

---

## 6. Proposed backend modules/services/repositories needed later (planning)

### Modules
- `ProcurementModule` (existing scaffold)
- `PurchaseParties` submodule
- `PurchaseOrders` submodule

### Services (future)
- `PurchasePartiesService`
- `PurchaseOrdersService`
- `PurchaseReceiveService` (narrow receive orchestration only)

### Repositories (future)
- `PurchasePartiesRepository`
- `PurchaseOrdersRepository`
- Reuse/compose existing `ProductsRepository` for inventory mutation during receive

### Important
- No “generic workflow engine.”
- Keep receive logic small and explicit per source type (`inventory` vs `new`).

---

## 7. Critical invariants that must not break

1. Pending/new product lines do **not** enter inventory before receive.
2. Receive is the only materialization point for `sourceType: new` lines.
3. Existing-product receive updates stock correctly at variant/color granularity.
4. Buy-price method semantics remain consistent with current four-method behavior.
5. Purchase history is always appended with previousStock/previousBuyPrice/nextBuyPrice metadata.
6. Re-receive/duplicate receive must be blocked or idempotent-safe.
7. Order edit remains allowed only in non-received states.
8. GST bill metadata persists with order and remains auditable.
9. Tenant/store scope isolation for parties/orders/receive.

---

## 8. Risks and unknowns

1. Current logic lives in large legacy `services/storage.ts`; behavior is correct but tightly coupled.
2. Receive operation is high-risk because it mutates inventory and pricing.
3. Variant/color identity normalization mismatches can corrupt per-row stock if not mirrored exactly.
4. New-product materialization fields (barcode/hsn/variants/colors/image/sellPrice) need strict validation and defaults.
5. Local image upload/preview behavior exists in UI flow; backend media strategy for procurement artifacts remains undefined.
6. GST calculations and display are currently frontend-oriented; backend canonicalization strategy needs explicit decision.

---

## 9. What must remain frozen

- No frontend procurement rewrite.
- No backend procurement write implementation in this phase.
- No API contract changes outside planned procurement domain docs.
- No transaction engine changes.
- No payment/return update-delete widening.
- No finance formula changes.
- No procurement cutover.

---

## 10. Simplification recommendations

1. Start with **read/list + order/party baseline contracts** before receive execution.
2. Keep receive orchestration as one explicit service path; avoid abstraction layers.
3. Mirror current method names and behavior to reduce migration drift.
4. Use fixture-first invariants for receive edge cases before any implementation.
5. Defer optional features (imports, media handling expansion, advanced reporting) until baseline receive safety is proven.

---

## 11. Recommended Phase 5B implementation sequence

1. **Contracts freeze (procurement v1 DTOs only)**
   - parties + orders + receive request/response + errors.
2. **Read baseline backend endpoints**
   - list/get parties and orders (no write mutations yet if possible).
3. **Party + order create/update (non-receive)**
   - optimistic version checks and tenant guardrails.
4. **Receive path implementation (narrow + idempotent)**
   - inventory-source lines first, then new-product materialization.
5. **Receive hardening tests**
   - duplicate receive, already-received order, variant/color stock, buy-price method parity, purchase history integrity.
6. **Shadow-mode operational checks**
   - compare backend read outputs with legacy state before any cutover.

This keeps migration conservative, test-first, and domain-bounded.
