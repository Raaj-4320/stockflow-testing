# Source of Truth Remediation Plan

Date: 2026-06-18

Principles:

- Do **not** mix phases into one large PR.
- Every phase must be independently reviewable, reversible, and safe to deploy.
- Canonical event data and canonical selectors must become the only trusted source for business numbers.
- Snapshot fields may remain only as rebuildable caches or explicitly labeled debug/export fields.

## Phase 0 — Safety Guardrails

### Scope

Add safety rails before changing domain engines.

### Files likely touched

- `services/storage.ts`
- `services/importExcel.ts`
- `pages/Admin.tsx`
- `pages/Customers.tsx`
- `pages/PurchasePanel.tsx`
- `pages/Transactions.tsx`
- `services/errorMessages.ts`
- new `services/dataIntegrityGuards.ts`
- new `services/backup.ts`
- new `services/writeQuarantine.ts`

### Exact risks being removed

- Bulk/admin writes can overwrite good data without an automatic backup.
- Silent snapshot fallback can hide canonical replay failure.
- Duplicate IDs can cause `Map` overwrites and data invisibility.
- Partial Firestore reads can make the UI or write paths operate on incomplete state.
- Failed writes can be treated as locally committed business state.

### Required work

1. Create automatic backup package before import, admin merge, delete, repair, and bulk write operations.
2. Add duplicate ID detector for all core collections before save/sync.
3. Add partial read detection and a `dataReadiness` state for multi-collection Firestore loads.
4. Add write failure quarantine: failed writes go to a pending/quarantined queue instead of being treated as committed.
5. Add common `CanonicalResult<T>` / `DataIntegrityResult<T>` semantics for all future ledger engines.
6. Make snapshot fallback warnings consistent: no silently trusted cached values.

### Acceptance criteria

- Any bulk/admin write creates a timestamped backup first.
- Duplicate IDs block writes and show a clear error.
- UI can distinguish `empty data` from `data unavailable / partial read`.
- Failed cloud writes are visible as quarantined/pending and cannot silently become trusted state.
- Existing customer balance no-silent-fallback behavior remains intact.

### Test plan

- Unit test duplicate ID detection for every collection.
- Simulate partial Firebase reads and confirm guarded unavailable state.
- Simulate import/admin bulk write and confirm backup artifact is created.
- Simulate cloud write failure and confirm quarantine entry.
- Regression test customer balance views still show canonical or unavailable.

### Rollback plan

- Feature flag guardrails in read-only warn mode first.
- If blocking logic causes false positives, disable blocking and keep logging/backups.
- Backups created by this phase allow restoring pre-change data.

### Production risk level

**Medium.** Safety code can block operations if too strict, but rollout can start in warn-only mode.

---

## Phase 1 — Stock Ledger

### Scope

Create a canonical append-only stock movement ledger and convert product stock snapshots to rebuildable cache.

### Files likely touched

- `types.ts`
- `services/storage.ts`
- `services/stockBuckets.ts`
- `services/productVariants.ts`
- `pages/Sales.tsx`
- `pages/ProductAnalytics.tsx`
- `pages/PurchasePanel.tsx`
- `pages/Reports.tsx`
- `pages/Transactions.tsx`
- `services/excel.ts`
- `services/importExcel.ts`
- new `services/stockLedgerCore.ts`
- new `services/stockReconciliation.ts`

### Exact risks being removed

- `product.stock` and `product.stockByVariantColor` can drift from transaction/purchase history.
- Stock can become zero or negative due to partial writes, edits, deletes, or import mistakes.
- Sales availability currently depends on mutable snapshots.
- Product analytics and reports can disagree with Sales/Purchase screens.

### Required work

1. Define append-only stock movement model.
2. Define movement types:
   - `sale_out`
   - `return_in`
   - `purchase_in`
   - `purchase_return_out`
   - `manual_adjustment_in`
   - `manual_adjustment_out`
   - `opening_stock`
   - `correction`
   - `transfer_in`
   - `transfer_out`
3. Emit stock movements from sales, returns, purchase receiving, purchase edits, imports, and manual adjustments.
4. Build `deriveProductStock(productId, movements)` and variant/color stock selectors.
5. Reconcile existing `product.stock` and `product.stockByVariantColor` against derived movements.
6. Keep product stock snapshots only as rebuildable cache with `stockRecalculatedAt` and version metadata.

### Acceptance criteria

- Product stock can be rebuilt from stock movements.
- Sales screen availability uses stock ledger selector or verified cache.
- Product stock snapshot mismatch is visible and repairable.
- Existing product stock and variant stock are reconciled in dry-run before any write.
- No stock mutation path updates only product snapshot without movement.

### Test plan

- Unit tests for each stock movement type.
- Golden tests: sale, return, purchase, edit, delete, import, manual adjustment.
- Rebuild test comparing derived stock to product snapshot.
- Duplicate movement ID/idempotency test.
- Negative stock prevention tests.
- Performance test on large movement list with memoized indexes.

### Rollback plan

- Introduce stock ledger in shadow mode first.
- Continue displaying existing product snapshot until dry-run mismatch is understood.
- If deployment fails, stop emitting movements and keep snapshots unchanged.
- Keep reconciliation report for manual rollback.

### Production risk level

**High.** Inventory is business-critical and currently snapshot-heavy. Use shadow mode and dry-run reconciliation before switching display/write paths.

---

## Phase 2 — Write Safety

### Scope

Remove full-array replacement saves and replace with transactional patches or append-only events.

### Files likely touched

- `services/storage.ts`
- `services/firebase.ts`
- `services/importExcel.ts`
- `pages/Admin.tsx`
- `pages/Transactions.tsx`
- `pages/PurchasePanel.tsx`
- `pages/Customers.tsx`
- `pages/Sales.tsx`
- new `services/writeJournal.ts`
- new `services/rollback.ts`
- new `services/patchWriter.ts`

### Exact risks being removed

- Full-array `saveData({...data, collection: next})` can overwrite concurrent or partially loaded data.
- Local fallback writes can diverge from cloud state.
- Delete/edit operations may be hard to roll back.
- Interrupted writes can create mixed product/customer/transaction state.

### Required work

1. Introduce `writeJournal` for every business mutation.
2. Replace full-array writes with collection-level patch operations.
3. Use Firestore transactions/batches for multi-document financial and stock changes.
4. Add idempotency keys for process transaction, imports, deletes, and repairs.
5. Add rollback records with before/after snapshots for destructive operations.
6. For offline/local fallback, store pending patch/event queue instead of committed replacement state.

### Acceptance criteria

- No high-risk business flow writes a full replacement array without backup/journal.
- Multi-document writes are atomic or marked pending/quarantined.
- Every destructive write has a rollback record.
- Write failures never look successful.
- Duplicate submits are idempotent.

### Test plan

- Simulate interrupted transaction write halfway through product/customer/transaction updates.
- Simulate duplicate submit and confirm one committed event.
- Simulate offline write and confirm pending queue, not trusted committed state.
- Restore from rollback record for delete/update/import.
- Concurrency test with two clients editing different collections.

### Rollback plan

- Keep old `saveData` behind feature flag for non-critical writes initially.
- If patch writer fails, switch affected operation back to old path only after backup is created.
- Preserve write journal even if old writer is re-enabled.

### Production risk level

**High.** Write-path refactor touches critical data. Must be split by operation family: transactions first, then purchases, then imports/admin.

---

## Phase 3 — Finance/Cashbook Core

### Scope

Create one `financeLedgerCore` consumed by Cashbook, Finance, and Dashboard.

### Files likely touched

- `pages/Finance.tsx`
- `pages/Cashbook.tsx`
- `pages/Dashboard.tsx`
- `utils/financeDebugLogger.ts`
- `services/financeLogger.ts`
- `services/storage.ts`
- `services/excel.ts`
- new `services/financeLedgerCore.ts`
- new `services/financeReconciliation.ts`

### Exact risks being removed

- Cashbook and Finance independently calculate rows and totals.
- Dashboard can display KPIs that disagree with Finance/Cashbook.
- Default-to-zero finance effects can hide missing transaction fields.
- Profit/revenue/cash movement logic is duplicated and inconsistent.

### Required work

1. Define finance event row model:
   - sales revenue
   - sales return
   - customer payment
   - supplier payment
   - purchase payable
   - expense
   - cash adjustment
   - online/bank movement
   - manual correction
2. Build `financeLedgerCore` that returns rows + rollups.
3. Make Cashbook page consume finance ledger rows.
4. Make Finance page consume the same rows and rollups.
5. Make Dashboard consume only finance ledger KPI selectors.
6. Move debug logger to diagnostic consumer, not source of truth.

### Acceptance criteria

- Cashbook, Finance, and Dashboard show the same cash/bank/receivable/payable/revenue/profit totals for the same filter window.
- No page-local finance row builder remains.
- Missing/corrupt rows return validation errors, not zero-valued finance rows.
- Exports use finance ledger rows.

### Test plan

- Golden fixtures for sale, credit sale, payment, return refund, return due-reduction, supplier payment, expense, cash adjustment.
- Compare Cashbook/Finance/Dashboard totals from one fixture.
- Date filter tests.
- Payment method split tests.
- Corrupt row validation tests.

### Rollback plan

- Run finance core in shadow mode and compare against current pages.
- Add mismatch banner but keep old display until mismatch count is zero/accepted.
- If rollout fails, pages switch back to old selectors while keeping comparison logs.

### Production risk level

**High.** Financial KPIs are business-critical. Use shadow mode and reconciliation exports first.

---

## Phase 4 — Supplier Ledger Cleanup

### Scope

Make `buildPurchasePartyLedger` the only payable/credit source.

### Files likely touched

- `services/purchaseLedger.ts`
- `services/supplierLedgerReconciliation.ts`
- `services/ledgerStatements.ts`
- `pages/Dashboard.tsx`
- `pages/PurchasePanel.tsx`
- `pages/Finance.tsx`
- `pages/Cashbook.tsx`
- `services/storage.ts`
- `services/excel.ts`

### Exact risks being removed

- Dashboard and PurchasePanel can calculate supplier payable differently.
- `purchaseOrder.remainingAmount` can drift from supplier payments/credits.
- Supplier credits can be double-counted or missed.
- Supplier reports can disagree with dashboard/payments.

### Required work

1. Expose stable supplier ledger summary selector from `buildPurchasePartyLedger`.
2. Replace Dashboard supplier payable/credit calculations with ledger selector.
3. Replace PurchasePanel payable/credit display with ledger selector.
4. Update Finance/Cashbook supplier rows to use ledger events or finance core integration.
5. Make purchase order remaining amount a rebuildable cache only.
6. Keep supplier reconciliation as validator/repair tool, not alternate source.

### Acceptance criteria

- One supplier and one set of purchase/payment/credit rows produce identical payable/credit in Dashboard, PurchasePanel, statements, Finance, and Cashbook.
- No UI reads `purchaseOrder.remainingAmount` as trusted payable if ledger replay is available.
- Supplier ledger mismatch is visible and repairable.

### Test plan

- Fixture: purchase, partial payment, overpayment/credit, credit application, delete payment, edit purchase.
- Compare all supplier display surfaces.
- Rebuild remaining amount cache and compare dry-run.
- Corrupt/missing supplier payment allocation test.

### Rollback plan

- Run supplier ledger selector in shadow mode beside current views.
- Keep current display until mismatch report is reviewed.
- Roll back by switching display selector only; no data migration required until final cache repair.

### Production risk level

**Medium-High.** Supplier balances matter, but the core ledger already exists, so cleanup can be safer than stock/finance rewrites.

---

## Phase 5 — Reports/Exports/PDF Cleanup

### Scope

Make reports, exports, and PDFs consume canonical DTOs with explicit source labels.

### Files likely touched

- `services/ledgerStatements.ts`
- `services/pdf.ts`
- `services/excel.ts`
- `services/importExcel.ts`
- `pages/Reports.tsx`
- `pages/Customers.tsx`
- `pages/Transactions.tsx`
- `pages/ProductAnalytics.tsx`
- new `services/reportDto.ts`
- new `services/exportDto.ts`

### Exact risks being removed

- Excel/PDF/report services duplicate ledger/finance/profit calculations.
- Snapshot columns can be exported without source labels.
- Reports can disagree with UI screens.
- PDF invoices/ledgers can silently omit malformed data.

### Required work

1. Define canonical DTOs:
   - customer ledger statement DTO
   - supplier ledger statement DTO
   - stock report DTO
   - finance report DTO
   - profit/revenue report DTO
2. Make PDF renderers render DTOs only.
3. Make Excel exporters export DTOs only.
4. Mark snapshot/cache columns with `Cached` or `Debug` labels.
5. Remove local Excel/PDF ledger replay logic.
6. Add report generation validation banners for unavailable canonical data.

### Acceptance criteria

- PDF, Excel, Reports page, and UI statements show the same values from the same DTO for identical filters.
- Snapshot fields are never exported as live truth without labels.
- Export files include source metadata for critical totals.
- Replay failure appears as unavailable/error, not zero or stale snapshot.

### Test plan

- Golden DTO fixtures for customer/supplier/stock/finance/profit reports.
- Snapshot mismatch fixture: exports must label cached fields.
- PDF/Excel parity tests against same DTO.
- Missing canonical data test.

### Rollback plan

- Add DTO path behind feature flag per report type.
- Keep old export until new/old parity verified.
- If a report breaks, switch that report back without affecting canonical core.

### Production risk level

**Medium.** Mostly read-only/reporting, but business decisions depend on reports. Roll out report-by-report.

---

## Phase 6 — Performance

### Scope

Optimize canonical engines and UI after sources of truth are stable.

### Files likely touched

- `pages/Customers.tsx`
- `pages/Dashboard.tsx`
- `pages/Finance.tsx`
- `pages/Cashbook.tsx`
- `pages/Admin.tsx`
- `pages/Transactions.tsx`
- `pages/Sales.tsx`
- `services/customerLedger.ts`
- `services/purchaseLedger.ts`
- `services/storage.ts`
- `services/pdf.ts`
- `services/excel.ts`
- new `services/indexes.ts`
- route-level lazy imports in `App.tsx`

### Exact risks being removed

- O(customers * transactions) customer replay.
- Full table rendering without virtualization.
- Repeated finance/cashbook/dashboard calculations.
- Large Admin/PDF/Excel bundles loaded before needed.
- Repeated filtering/sorting on every render.

### Required work

1. Build memoized indexes:
   - transactions by customer
   - transactions by product
   - purchase orders by party
   - payments by party
   - stock movements by product/bucket
   - finance events by date/type
2. Add replay cache invalidated by affected entity IDs.
3. Virtualize large tables: Transactions, Customers, Cashbook, ProductAnalytics, Reports.
4. Lazy-load Admin, PDF, Excel, import/export, forensic/audit panels.
5. Move heavy replay/aggregation to web worker if needed.
6. Add performance counters for replay counts and render timings in dev.

### Acceptance criteria

- Customer balance recalculation is O(affected customer transactions), not O(all customers * all transactions).
- Dashboard initial render stays responsive with large fixture data.
- Cashbook/Transactions tables render with virtualization.
- PDF/Excel/Admin chunks are lazy-loaded.
- Dev performance logs show bounded replay counts.

### Test plan

- Generate large fixture: 10k transactions, 2k products, 1k customers, 1k purchase orders.
- Measure Dashboard, Customers, Finance, Cashbook render time before/after.
- Verify replay count per action.
- Bundle analysis before/after lazy loading.
- Regression tests for filters/sorts/exports.

### Rollback plan

- Keep selectors API-compatible while changing internals.
- Feature flag virtualization per table.
- Lazy loading rollback is route-level import revert only.
- Performance changes should not alter canonical outputs; compare snapshots before deploy.

### Production risk level

**Medium.** Mostly non-accounting behavior if canonical outputs are stable. Use output parity tests to keep risk controlled.

---

## Release sequencing guidance

1. Phase 0 first, because it reduces blast radius for all later phases.
2. Phase 1 before performance work, because stock has the highest snapshot risk.
3. Phase 2 can begin after Phase 0 and should be split by operation family.
4. Phase 3 and Phase 4 can proceed in parallel only if they do not touch the same UI files in the same PR.
5. Phase 5 should follow domain-core consolidation to avoid building DTOs on unstable sources.
6. Phase 6 last, after source-of-truth semantics are stable.

## PR sizing rule

Each PR should include exactly one of:

- one guardrail,
- one canonical selector migration,
- one write-path family,
- one report/export DTO migration,
- one table virtualization/lazy-load change.

Do not combine data migrations, UI rewrites, and performance optimizations in the same PR.
