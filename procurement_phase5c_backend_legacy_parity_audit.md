# Procurement Phase 5C — Backend vs Legacy Purchase Panel Parity Audit

Date: 2026-04-30  
Scope: Audit/report only. No runtime, API, frontend, transaction, or finance formula changes.

## 1) Executive verdict (GO / NO-GO for frontend cutover planning)
**GO (with guardrails)** for **frontend cutover planning** (not execution).

Backend procurement now covers the core legacy Purchase Panel behaviors for parties, orders, and receive (inventory + new-source), including mixed-line receives and core protections (version conflict, duplicate receive block, barcode uniqueness, tenant scoping). Remaining differences are mostly representation/metadata depth and idempotency ledger sophistication, not core flow gaps.

## 2) Legacy Purchase Panel behavior inventory
Legacy (`pages/PurchasePanel.tsx` + `services/storage.ts`) provides:
- Party CRUD in local storage service.
- Order create/edit with GST bill fields (`billNumber`, `billDate`, `gstPercent`).
- Receive method selector with four buy-price modes.
- Inventory-source receive updates stock, variant/color rows, buy price, and purchase history.
- New-source lines materialize products at receive time.
- Mixed orders (inventory + new) handled in same receive path.
- Default normalization patterns (e.g., `'No Variant'`, `'No Color'`) and optional pending draft fields (`description`, `hsn`, image, sellPrice).

## 3) Backend procurement behavior inventory
Backend (`backend/src/modules/procurement/*`) now provides:
- Party list/get/create/update.
- Order list/get/create/update (with state/version protections).
- `POST /procurement/orders/:id/receive` with:
  - inventory-source line handling,
  - new-source materialization handling,
  - mixed-line receive support,
  - four buy-price methods,
  - purchase history append,
  - order receive finalization,
  - duplicate receive and version checks,
  - tenant-scoped read/write behavior.

## 4) Parity table
| Capability | Legacy Purchase Panel | Backend Procurement | Parity Status | Notes |
|---|---|---|---|---|
| Party CRUD | Yes | Yes | ✅ Near-parity | Backend has explicit version/error semantics. |
| Order create/edit | Yes | Yes | ✅ Near-parity | Received-order update blocking exists in backend. |
| GST bill metadata | Yes | Yes | ✅ Parity | `billNumber`, `billDate`, `gstPercent` preserved. |
| Inventory-source receive | Yes | Yes | ✅ Parity | Stock + buy-price + history + status transitions in both. |
| New-source materialization | Yes | Yes | ✅ Near-parity | Backend supports controlled receive-time creation. |
| Variant/color stock handling | Yes | Yes | ⚠️ Functional parity | Normalized label conventions differ (`No Variant/Color` vs `Default` fallback in backend receive path). |
| Buy-price methods | 4 methods | 4 methods | ✅ Parity | `avg_method_1`, `avg_method_2`, `no_change`, `latest_purchase`. |
| Purchase history | Yes | Yes | ⚠️ Functional parity | Core metadata aligned; optional legacy richness may differ. |
| Image/media behavior | Yes (draft image inputs) | Partial | ⚠️ Near-parity | Backend maps line image to `imageUrl` when present; no expanded media pipeline. |
| Duplicate receive behavior | Blocked by status | Blocked by status | ✅ Parity | Both prevent second receive mutation. |
| Tenant/store isolation | Implicit local-state context | Explicit store-scoped checks | ✅ Stronger in backend | Backend explicitly enforces scope on lookups/writes. |

## 5) Known differences
1. **Variant/color fallback tokens** differ (`No Variant/No Color` in legacy internals vs backend receive using `Default` fallback for new-source when missing variant/color).
2. **Optional pending draft fields** (`description`, `hsn`) are present in legacy draft workflow but are not first-class fields in backend product model contracts.
3. **Idempotency sophistication** differs: backend currently relies on already-received state blocking rather than a persisted idempotency ledger with replay response semantics.
4. **Image handling** is minimal in backend and does not include legacy/UI conveniences beyond direct field carry-through.

## 6) Risk areas
- Variant/color label normalization drift could cause subtle reporting/view differences during cutover if UI assumes legacy tokens.
- Optional draft metadata loss risk (`description`, `hsn`) if frontend depends on them post-cutover without explicit contract handling.
- Absence of persistent idempotency ledger may matter under retried network requests at API-gateway level.
- In-memory repository baseline differs from eventual persistent-store transactional behavior; rollout should include persistence-parity verification.

## 7) Missing tests or fixtures
Current backend tests are strong on receive flow correctness and protections, but parity audit suggests adding (future, optional) fixtures/tests for:
1. Variant/color fallback token compatibility expectations (`Default` vs `No Variant/No Color`).
2. Explicit assertions around optional pending metadata persistence policy for new-source materialization.
3. Retry-style receive request simulation beyond status-blocking semantics (idempotency replay model if introduced).

## 8) What must remain frozen
- No frontend cutover implementation in this phase.
- No transaction logic changes.
- No finance formula changes.
- No payment/return update-delete widening.
- No procurement contract redesign during parity-audit closeout.

## 9) Simplification recommendations
1. Keep cutover planning focused on **behavioral adapters** (UI mapping/labels), not backend redesign.
2. Freeze current receive backend semantics and only add targeted compatibility shims if parity blockers are proven.
3. Use fixture-driven shadow comparisons for a representative set of legacy orders before any production routing changes.
4. Defer advanced idempotency ledger work unless retry risk is observed in staging.

## 10) Recommended next phase
Proceed to **Phase 5C.1 Frontend Cutover Planning Gate** (planning/test harness only):
1. Define legacy-to-backend field mapping matrix for Purchase Panel payloads/responses.
2. Run shadow-mode parity samples across party/order/receive scenarios.
3. Resolve label/metadata compatibility decisions (`Default` vs `No Variant/No Color`, optional fields).
4. Approve a guarded cutover runbook with rollback criteria.

---
Audit conclusion: backend procurement is sufficiently aligned for cutover planning, with the above warnings tracked before execution.
