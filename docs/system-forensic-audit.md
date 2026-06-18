# System-wide forensic audit report

Date: 2026-06-18
Scope: static audit of the React/Vite ERP codebase under `/workspace/stockflow-testing`.

## Evidence commands

```bash
find . -path './node_modules' -prune -o -path './dist' -prune -o \( -name '*.ts' -o -name '*.tsx' \) -print | xargs wc -l | sort -nr | head -30
rg -n "\?\?.*\?\?|\|\| \[\]|\|\| \{\}|\|\| 0|\|\| ''|\?\? \[\]|\?\? \{\}|\?\? 0|\?\? ''|catch \(|catch\{|localStorage|getItem\(" -S services pages components src utils types.ts -g'*.ts*'
rg -n "canonical|replay|ledger|rebuild|snapshot|balance|currentDue|totalDue|storeCredit|payable|stock" services pages utils -g'*.ts*'
rg -n "setDoc|\.set\(|updateDoc|deleteDoc|deleteAll|clearData|resetData|saveData|localStorage\.setItem|localStorage\.removeItem|runFirestoreTransaction|writeBatch|bulk|overwrite|replace" services pages src utils -g'*.ts*'
rg -n "onSnapshot|addEventListener|setInterval|setTimeout|useEffect\(|removeEventListener|unsubscribe|clearInterval|clearTimeout" services pages components src -g'*.ts*'
rg -n "customer\.(totalDue|storeCredit|currentDue|balance)|\bc\.(totalDue|storeCredit|currentDue|balance)\b" -S . -g'!node_modules' -g'!dist'
```

## Executive summary

Final verdict: **HIGH RISK**.

The application contains valuable ERP data and has multiple strong domain-replay efforts, but the system is still high risk because it has very large god modules, many fallback paths, multiple partially duplicated canonical engines, local/cloud fallback writes, denormalized snapshots, and extensive full-array replacement flows. The biggest risks are: (1) snapshot drift, (2) conflicting replay engines, (3) destructive save paths that replace entire arrays/documents, (4) repeated expensive calculations in render, (5) weak disaster recovery, and (6) security-sensitive actions gated mostly in UI/session code.

## Production readiness score

| Category | Score /100 | Rationale |
| --- | ---: | --- |
| Data Integrity | 48 | Canonical ledgers exist, but duplicate engines and snapshot fields remain. |
| Performance | 42 | `services/storage.ts` is 7,136 lines; Finance/Admin/Transactions/Sales/Customers are huge; replay work is repeated. |
| Reliability | 45 | Many catch/fallback paths can continue with partial data. |
| Security | 40 | Client-side permission checks, imports/exports, destructive actions, debug flags. |
| Maintainability | 30 | God files and duplicated business logic. |
| Scalability | 35 | Full collection scans, unbounded arrays, repeated snapshots. |
| Disaster Recovery | 28 | No systematic append-only journal/point-in-time recovery; many array replacement saves. |

## Section 1 — Fallback audit

The fallback scan found **1,868** fallback-like occurrences. Not all are dangerous, but the count is too high for accounting software.

| Severity | File path | Function / area | Risk explanation | Impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| CRITICAL | `services/storage.ts` | `loadData`, `saveData`, local/cloud fallbacks | Many `|| []`, `|| {}`, `|| 0`, and local fallback writes can make missing/corrupt collections look valid. | Corrupted or partially loaded data can be normalized into empty arrays and then saved back. | Introduce typed load result with `status: ok/error/partial`; never persist partial fallback state unless explicitly repaired. |
| HIGH | `services/storage.ts` | `getCanonicalCustomerBalanceSnapshot` | Fallback branch uses stored customer snapshots for customers without ledger events. | Customers whose ledger history is missing can appear valid. | Mark as `noLedgerHistory` and display as unavailable/manual opening balance, not current truth. |
| HIGH | `pages/Sales.tsx` | sale/return payment calculations | Many `Number(x || 0)` and fallback chains around payment/store-credit/stock. | Payment split mistakes can be hidden as zero. | Use strict money parser returning validation errors, not zero. |
| HIGH | `pages/Finance.tsx` | cashbook rows/rollups | Numerous default-to-zero accounting effects. | Missing transaction fields become zero-value finance rows. | Add schema validation before finance aggregation. |
| MEDIUM | `services/importExcel.ts` | import mapping | Missing spreadsheet cells default to existing/stored values or zero. | Bad imports can look successful. | Add strict required-field modes and dry-run warnings. |
| MEDIUM | `services/pdf.ts` | invoice/thermal rendering | Fallback display labels such as ledger unavailable are safer now, but many document fields still default to blank/zero. | Invoices can omit malformed data without operator noticing. | Add document validation banner for incomplete invoices. |
| MEDIUM | `utils/financeDebugLogger.ts` | debug snapshot | Uses `state.customers || []`, `c.totalDue || 0`, product stock fallbacks. | Debug numbers can be misleading during corruption. | Label as debug-only and include partial-data warnings. |

Fallbacks that can hide corruption: empty arrays for collections, zero money defaults, catch blocks that return false/empty values, import normalization, localStorage fallback, Firestore local fallback saves.

Fallbacks that can create accounting inaccuracies: customer/supplier payments defaulting to zero, stock defaults, missing purchase-order amounts, historical reference classification defaults, return allocation defaults.

## Section 2 — Canonical system audit

| Canonical domain | Current engines found | Risk | Surviving engine recommendation |
| --- | --- | --- | --- |
| Customer balance | `services/customerLedger.ts` `buildCorrectCustomerLedgerPreview`; `services/storage.ts` `rebuildCustomerBalanceFromLedger`; `pages/Customers.tsx` `buildCustomerLedgerRows`; `pages/Dashboard.tsx` projection; `services/excel.ts` transaction effects | Duplicate/partially conflicting replay engines. | Keep `buildCorrectCustomerLedgerPreview` as the single read engine; make storage snapshots call it or a shared pure core. Delete page-local replay code. |
| Supplier ledger | `services/purchaseLedger.ts`; `services/supplierLedgerReconciliation.ts`; Dashboard supplier projection | Mostly centralized but Dashboard still presents local projections. | Keep `buildPurchasePartyLedger`; consumers should only read its rows/summary. |
| Stock | `applyTransactionItemsToProduct`, `stockBuckets`, product `stock`, variant rows, purchase receiving | Snapshot-heavy; no single replay from stock movements. | Create append-only stock movement ledger and derive product stock from it. |
| Finance/cashbook | `pages/Finance.tsx` cashbook row builder, `pages/Cashbook.tsx`, `financeLogger`, `financeDebugLogger` | Several finance truths. | Define a single finance-event ledger and make Cashbook/Finance/Dashboard consume it. |
| Dashboard | Customer/supplier/finance projections in page | Dashboard duplicates calculations. | Dashboard must be read-only consumer of canonical selectors. |
| Reports/PDF/Excel | `ledgerStatements`, `pdf`, `excel`, `importExcel` | Some reports use canonical, some export snapshots. | Reports/exports should declare source: canonical vs snapshot export. |

Canonical engines that should be deleted/consolidated: page-local customer ledger row builders, Dashboard customer receivable projection, Finance cashbook row calculations duplicated from Cashbook, Excel transaction effect replay.

## Section 3 — Duplication audit

| Severity | Duplicate logic | Source files | Duplicate count | Consolidation recommendation |
| --- | --- | --- | ---: | --- |
| CRITICAL | Customer ledger/balance replay | `services/customerLedger.ts`, `services/storage.ts`, `pages/Customers.tsx`, `pages/Dashboard.tsx`, `services/excel.ts` | 5 | Extract `customerLedgerCore.ts`; all callers consume rows/summary. |
| HIGH | Supplier payable/credit replay | `services/purchaseLedger.ts`, `pages/Dashboard.tsx`, `services/supplierLedgerReconciliation.ts` | 3 | Use purchase ledger output everywhere. |
| HIGH | Cashbook/finance rollups | `pages/Finance.tsx`, `pages/Cashbook.tsx`, `utils/financeDebugLogger.ts` | 3 | Create `services/financeLedger.ts`. |
| HIGH | Return allocation | `services/storage.ts`, `pages/Sales.tsx`, `pages/Finance.tsx`, `pages/Cashbook.tsx` | 4 | One `returnSettlement.ts` module. |
| MEDIUM | PDF/statement generation | `services/pdf.ts`, `services/ledgerStatements.ts`, `services/excel.ts` | 3 | Build statement DTO once, render to PDF/Excel/WhatsApp. |
| MEDIUM | Product stock display/calculation | `pages/Sales.tsx`, `services/stockBuckets.ts`, `productVariants.ts`, `storage.ts` | 4 | Central stock availability selector. |

## Section 4 — Dead code audit

| Severity | File path | Function / symbol / area | Risk explanation | Estimated bundle savings | Recommended fix |
| --- | --- | --- | --- | ---: | --- |
| HIGH | `pages/Customers.tsx` | repair/audit panels, updated view, manual reconciliation controls | Large debug/admin flows remain in main page bundle. | 20-40 KB gzipped if lazy-loaded. | Lazy-load admin/audit panels. |
| HIGH | `pages/Admin.tsx` | many admin utilities in one component | Admin tools likely not needed in primary route bundle. | 30-60 KB gzipped. | Split per admin feature. |
| MEDIUM | `services/storage.ts` | legacy migration/reconciliation helpers | Many old migration paths likely no longer run. | 10-30 KB gzipped. | Track with usage tests, move to admin-only lazy module. |
| MEDIUM | `services/pdf.ts` | multiple invoice/statement generators | Some paths overlap thermal/standard PDFs. | 5-15 KB. | Consolidate renderer DTOs. |
| LOW | feature flags/debug strings | many files | Flags are useful but stale flags confuse behavior. | Low. | Keep registry of active flags. |

Dead-code confidence is static-only; use TypeScript project references or a dep graph tool before deletion.

## Section 5 — Loading audit

| Severity | File path | Function / area | Risk explanation | Impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| HIGH | `pages/Sales.tsx` | many `useEffect` cart/meta sync effects | Frequent localStorage/session writes and rerenders. | POS lag with large carts/products. | Combine cart state reducer; debounce persistence. |
| HIGH | `pages/Customers.tsx` | per-customer canonical replay map | Replays every customer on customers/transactions/upfrontOrders change. | O(C*T) style cost as transactions grow. | Indexed transaction map + memoized per-customer replay cache. |
| HIGH | `pages/Dashboard.tsx` | dashboard selectors | Multiple large `useMemo` selectors over products/orders/transactions. | Slow dashboard with scale. | Precompute selector indexes once. |
| HIGH | `pages/Finance.tsx` | cashbook rows/rollups | Large page recalculates many finance rows. | Slow finance tab/filter changes. | Move to worker/service selector with incremental indexes. |
| MEDIUM | `services/storage.ts` | multiple Firestore listeners | Many collection listeners update memory state independently. | Partial-state UI windows. | Aggregate readiness barrier/versioned snapshots. |
| MEDIUM | `pages/Cashbook.tsx` | visible row reset | Resets visible rows on filters; may hide expensive recalculation. | UX jumps and repeated work. | Virtualized table. |

Biggest performance offenders by file size: `services/storage.ts` 7,136 lines, `pages/Finance.tsx` 3,606, `pages/Admin.tsx` 3,070, `pages/Transactions.tsx` 2,605, `pages/Sales.tsx` 2,504, `pages/Customers.tsx` 2,493.

## Section 6 — Data loss audit

| Severity | File path | Function / pattern | Recovery possible? | Backup available? | Risk explanation | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| CRITICAL | `services/storage.ts` | `saveData({...data, collection: next})` full-array replacement | Maybe, if browser/cloud stale copy exists | Not systematic | A bad in-memory state can overwrite whole local/cloud dataset. | Append-only event log + point-in-time backups before bulk writes. |
| CRITICAL | `services/storage.ts` | local fallback writes after cloud failure | Maybe | No guaranteed backup | Offline/permission failure can persist divergent local state. | Queue pending writes with conflict resolution, do not mark as committed. |
| HIGH | `services/storage.ts` | delete transaction/customer/supplier/payment paths | Partial | DeletedTransactionRecord exists for transactions only | Some deletes have compensation, others are hard deletes or array filters. | Soft-delete everything; require restore path. |
| HIGH | `services/importExcel.ts` | bulk imports | Depends on backup | User download only | Bad import can replace/merge bad data. | Mandatory dry-run diff + automatic backup. |
| HIGH | `pages/Admin.tsx` | admin cleanup/merge actions | Unknown | Not systematic | Admin tools can mutate many rows. | Add transaction journal and rollback package. |
| MEDIUM | `services/storage.ts` | Firestore setDoc of store doc / subcollections | Firestore history not exposed by app | No | Merge and non-merge writes mixed. | Standardize write API with audit + backup. |

## Section 7 — Disaster scenarios

| Scenario | Expected current behavior | Severity | Recommendation |
| --- | --- | --- | --- |
| Empty transactions | Customer/supplier ledgers may show zero or snapshot fallback if no ledger events. | HIGH | Distinguish no-history from zero-balance. |
| Null customers | Many pages use arrays from load fallback; may show empty UI. | HIGH | Load status must show data unavailable, not empty business. |
| Missing products | Sales/import/transactions may show unknown product or fail inventory update. | HIGH | Product identity ledger with tombstones. |
| Corrupted purchase orders | Supplier ledger may warn or produce wrong payable. | HIGH | Validate purchase order schema before replay. |
| Duplicate IDs | Maps overwrite earlier row silently. | CRITICAL | Global duplicate-id detector before save/sync. |
| Partial Firebase reads | Collection listeners update memory independently, causing temporary mixed state. | HIGH | Versioned multi-collection snapshot readiness. |
| Partial writes | Some transaction product/customer writes happen across many docs. | CRITICAL | All financial/stock writes need atomic transaction or pending state. |
| Interrupted writes | Local fallback and cloud state can diverge. | HIGH | Durable write queue with idempotency keys. |
| Replay crashes | New customer UI surfaces unavailable, but other domains may default to zero. | HIGH | Standard `CanonicalResult<T>` for all ledgers. |

## Section 8 — Runtime crash audit

| Severity | File path | Function / pattern | Risk explanation | Impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| HIGH | `pages/Cashbook.tsx` | unsafe casts from `Record<string, unknown>` to `Transaction` | TypeScript already flags this. | Runtime shape mismatch. | Runtime schema parser. |
| HIGH | `pages/Finance.tsx` | `getCanonicalReturnAllocation(transaction)` with missing args | TypeScript flags existing error. | Runtime wrong allocation/crash. | Fix API calls and tests. |
| HIGH | `pages/PurchasePanel.tsx` | `localeCompare` on `unknown` | TypeScript flags. | Crash on non-string. | Normalize to string. |
| MEDIUM | many files | invalid date parsing fallback | `new Date(value).getTime()` can be NaN and sort incorrectly. | Wrong ordering/replay. | Central date parser with errors. |
| MEDIUM | many files | `Number(value || 0)` | NaN/empty string becomes zero. | Silent accounting errors. | Strict numeric parser. |
| MEDIUM | `services/pdf.ts` | browser print window operations/timeouts | Popup blocked/null document assumptions. | Receipt failure. | Guard print window and return typed error. |
| MEDIUM | `services/storage.ts` | JSON/localStorage parse/load | Corrupt localStorage may fallback/reset. | Data unavailable or overwritten. | Quarantine corrupt payload; require restore. |

## Section 9 — Database audit

| Severity | Area | Risk | Scaling estimate | Recommended fix |
| --- | --- | --- | --- | --- |
| CRITICAL | Firestore sync | Multiple hot subcollections plus store doc; no explicit snapshot version joining. | 10k+ transactions/orders will stress client scans. | Server-side indexed queries and versioned sync batches. |
| HIGH | `transactions` | Replayed/scanned often on client. | O(N) to O(customers*N). | Partition by customer/date and maintain canonical indexes. |
| HIGH | `products` | Product stock snapshots and variant arrays grow. | Large product catalogs slow Sales. | Separate stock buckets/movements collection. |
| HIGH | nested arrays | Upfront payment history, purchase lines, transaction items in documents. | Document size growth; write amplification. | Move unbounded histories to subcollections. |
| HIGH | N+1 stats writes | customerProductStats per product/customer transaction. | Many writes per sale. | Batch/idempotent background aggregation. |
| MEDIUM | localStorage | Full app state cached client-side. | Browser quota risk. | IndexedDB with schema/versioning. |
| LOW | Mongo | No Mongo usage found in static scan. | N/A | Keep absent unless intentionally added. |

## Section 10 — Performance audit: top 20 bottlenecks

1. `services/storage.ts` god service: parsing, sync, writes, replay, imports.
2. `pages/Finance.tsx` full cashbook/finance rollups.
3. `pages/Admin.tsx` giant admin bundle.
4. `pages/Transactions.tsx` large table/detail logic.
5. `pages/Sales.tsx` POS cart + stock + customer replay logic.
6. `pages/Customers.tsx` per-customer canonical replay map.
7. `pages/PurchasePanel.tsx` purchase/supplier logic.
8. `pages/Dashboard.tsx` multi-domain summary selectors.
9. `services/pdf.ts` large PDF/print generation in app bundle.
10. `services/importExcel.ts` xlsx import processing.
11. `services/excel.ts` xlsx export calculations.
12. Repeated customer ledger replay in Customers/Dashboard/Statements.
13. Repeated supplier ledger replay in Dashboard/Reconciliation/Statements.
14. Product stock availability recalculated in Sales.
15. Firestore listener fan-out and full collection mapping.
16. localStorage/sessionStorage cart persistence effects.
17. Cashbook visible row rendering without virtualization.
18. Large PDF/Excel libraries in chunks.
19. Behavior logger global event listeners and batching.
20. WhatsApp/PDF data URL generation before share.

## Section 11 — Memory audit

| Severity | Source | Impact | Fix |
| --- | --- | --- | --- |
| HIGH | `services/storage.ts` online/offline listeners are added in sync setup; verify initialization is one-time. | Duplicate listeners can trigger repeated sync. | Register once with explicit teardown. |
| HIGH | `services/behaviorLogger.ts` document/window listeners | Global listeners may stay forever by design. | Add install guard and uninstall for tests/hot reload. |
| MEDIUM | Firestore `onSnapshot` listeners | Many listeners; teardown exists but partial leaks possible on auth churn. | Central listener registry and tests. |
| MEDIUM | `pages/Settings.tsx` WhatsApp polling interval | Interval cleanup exists but modal/page transitions should be tested. | Use hook with guaranteed cleanup. |
| MEDIUM | Sales timeouts/flash messages | Many timeouts. | Keep refs and cleanup on unmount. |

## Section 12 — Security audit

| Severity | File path | Risk | Impact | Recommended fix |
| --- | --- | --- | --- | --- |
| CRITICAL | `src/auth/simplePermissions.ts`, UI `can(...)` checks | Client-side role checks can be bypassed if Firestore rules allow writes. | Unauthorized destructive actions. | Enforce permissions in Firestore security rules/server. |
| HIGH | Import/export services | Full business data export/import from client. | Data exfiltration/destruction. | Role-enforced server-side export/import approval. |
| HIGH | Admin delete/merge actions | Destructive actions exposed in client. | Data loss. | Server-validated admin operations with audit. |
| HIGH | Debug flags/localStorage | Debug modes can reveal internals. | Sensitive data/log exposure. | Disable debug in production builds or require admin token. |
| MEDIUM | WhatsApp sharing/PDF blobs | Customer data sent externally. | Privacy risk. | Consent/audit logs and redaction. |

## Section 13 — Accounting integrity audit

| Domain | Current source(s) | Duplicate truths / stale risk | Recommendation |
| --- | --- | --- | --- |
| Customer Ledger | Canonical replay + customer snapshots + page projections | High risk reduced but still duplicate engines. | One customer ledger core. |
| Supplier Ledger | Purchase ledger + purchase order snapshots + supplier payments + party credit ledger | Medium-high. | One supplier ledger core. |
| Stock Ledger | Product stock snapshot + variant stock rows + transactions + purchases | Critical. | Append-only stock movement ledger. |
| Cashbook | Finance rows, Cashbook rows, finance logs, manual cash entries | High. | Single finance event ledger. |
| Expenses | Expense collection and finance rollups | Medium. | Expense event ledger consumed by finance. |
| Revenue/profit | Transactions, COGS from product buy prices, finance projections | High; historical buy price changes can distort profit. | Persist immutable cost snapshots per transaction line. |
| Receivables/payables | Customer/supplier replay and snapshots | Medium-high. | Snapshot only cache; canonical results only. |

## Section 14 — Production readiness score

See executive scores above. Final verdict: **HIGH RISK**. The system is not a disaster, but it is not yet safe for high-value production data without stronger canonicalization, backups, atomicity, and recovery controls.

## Section 15 — Snapshot integrity audit

| Field / snapshot | Location | Owner | Update sources | Display locations | Fallback usage | Canonical equivalent | Risk level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `customer.totalDue` | `Customer` | Customer ledger | transaction writes, rebuilds, imports, repairs | Debug/export; normal customer display hardened | Some migration/no-ledger fallback | Customer ledger replay | HIGH |
| `customer.storeCredit` | `Customer` | Customer ledger | transaction writes, returns, payments, rebuilds | Dashboard canonical-derived rows, debug/export | Store credit clamp/write flows | Customer ledger replay | HIGH |
| supplier payable/credit fields | Purchase order/payment/party credit rows | Supplier ledger | purchase/payment/credit updates | Dashboard/reports | Some stored fields remain | `buildPurchasePartyLedger` | HIGH |
| `product.stock` | Product | Inventory | sales, returns, purchases, edits | Sales/product screens | Many `stock || 0` | Stock movement replay (missing) | CRITICAL |
| `product.stockByVariantColor` | Product | Inventory | stock bucket updates | Sales variant picker | fallback to product stock | Stock bucket ledger (partial) | HIGH |
| `product.totalSold` | Product | Sales stats | transaction updates | analytics | Can drift | transaction item replay | MEDIUM |
| `purchaseOrder.remainingAmount` | Purchase order | Supplier ledger | purchase/payments/credits | Dashboard/Purchase panel | Used directly | Supplier ledger replay | HIGH |
| `upfrontOrder.remainingAmount` | Upfront order | Custom order ledger | order/payment updates | Customers/custom order UI | Used directly | Upfront payment history replay | MEDIUM |
| finance/cash session totals | Cash sessions/manual entries | Finance | session open/close, manual edits | Finance | opening/closing fallbacks | Cash movement ledger | HIGH |
| customerProductStats | Subcollection | Analytics | transaction side writes | analytics | stale if transaction edit/delete misses | transaction item replay | MEDIUM |
| report/dashboard totals | useMemo projections | UI | derived at render | dashboards/reports | default zero on failure in places | Canonical selectors | MEDIUM |
| deleted transaction records | deleted history | Recovery/audit | deleteTransaction | admin/audit | partial restore only | append-only event log | MEDIUM |

Snapshot explosion estimate:

- Snapshot Count: 25+ meaningful snapshot/aggregate families.
- Unique Purpose Count: ~12.
- Duplicate Purpose Count: ~13.
- Potential Deletions: customer dashboard local projections, duplicated finance rollups, duplicated ledger statement row builders.
- Potential Consolidations: customer balances, supplier balances, stock availability, cashbook finance, report DTOs.

## Snapshot vs canonical audit

Can snapshots disagree with canonical? **YES**.

How: interrupted writes, imports, local fallback saves, partial Firestore reads, transaction edits/deletes, duplicate IDs, manual repair actions, stale product costs, purchase payment allocation changes.

Affected screens: Customers, Sales, Dashboard, Finance, Cashbook, Purchase Panel, Product Analytics, Exports, PDFs, Reports.

Severity: Customer snapshot display has been hardened, but inventory and supplier/finance snapshots remain high risk.

## Misleading display audit

| Screen | Field | Displayed label | Actual source | Canonical source | Misleading risk |
| --- | --- | --- | --- | --- | --- |
| Sales | Stock | `Stock` | `product.stock` / variant row | Stock movement replay missing | HIGH |
| Sales return | Current dues/return handling | selected customer snapshot in some flows | Customer snapshot/canonical mix | Customer replay | MEDIUM |
| Dashboard supplier | Payable/Credit | purchase ledger output plus stored fields in places | Supplier rows | Purchase ledger | MEDIUM |
| Finance debug | Total receivable | snapshot aggregate | customer snapshots | Customer replay | HIGH if treated as official |
| Excel exports | Total Due | cached customer field | customer snapshot | Customer replay | MEDIUM |
| Purchase panel | Remaining amount | `purchaseOrder.remainingAmount` | order snapshot | Supplier replay | HIGH |

## Snapshot failure simulation

| Failure | Expected current behavior | Risk |
| --- | --- | --- |
| snapshot = null | Many `|| 0`/`|| []` paths continue. | Missing data hidden. |
| snapshot = 0 | Zero can look settled/empty. | Accounting false negative. |
| snapshot stale | Hardened for normal customer balance; still risky for inventory/supplier/export. | High. |
| snapshot 6 months old | Replay may correct if used; snapshot displays/exports may not. | High. |
| snapshot corrupted | Strict canonical paths show unavailable; many other domains coerce to zero. | High. |
| snapshot rebuild failure | Customers show unavailable; other domains vary. | High. |
| partial snapshot update | Mixed state in Dashboard/Finance possible. | High. |
| race condition | Last writer wins for local/cloud fields. | Critical. |

## Snapshot dependency map

```text
Customer transactions + upfront orders -> customer replay -> customer snapshot cache -> debug/export fallback -> Customers/Dashboard/Finance/Cashbook/PDF
Purchase orders + supplier payments + party credit -> supplier replay -> order/payment snapshots -> Purchase/Dashboard/Reports
Transactions + purchases + adjustments -> stock movement intent -> product.stock / stockByVariantColor -> Sales/ProductAnalytics/Reports
Transactions + expenses + cash adjustments -> finance/cashbook projection -> dashboard/finance/cashbook KPIs
```

Locations where snapshots still influence visible business decisions: Sales stock availability, return handling hints, purchase remaining/payable displays, Excel exports, finance debug summaries, product analytics.

## Snapshot removal analysis

| Snapshot | Classification | Why | What breaks if removed | Recommendation |
| --- | --- | --- | --- | --- |
| `customer.totalDue/storeCredit` | OPTIONAL cache | Performance/offline cache | Old exports/import templates and some write paths | Keep cache but never trusted display. |
| `product.stock` | REQUIRED until stock ledger exists | Sales availability | POS cannot check stock quickly | Keep but add stock movement canonical rebuild. |
| `product.stockByVariantColor` | REQUIRED until stock bucket ledger exists | Variant-level sales | Variant picker breaks | Keep with rebuild/reconciliation. |
| `purchaseOrder.remainingAmount` | OPTIONAL cache | Fast payable display | Purchase UI needs replay selector | Replace with supplier ledger selector. |
| finance dashboard totals | SHOULD REMOVE as stored values | Derived at runtime | Nothing if selectors exist | Use canonical finance selectors. |
| customerProductStats | OPTIONAL cache | Analytics speed | Analytics slower | Keep but rebuildable. |
| deleted transaction records | REQUIRED audit | Recovery | Delete restore harder | Convert to append-only audit/event log. |

## Highest-priority remediation roadmap

1. Create a pure `customerLedgerCore` and remove duplicate customer replay implementations.
2. Create a stock movement ledger; make product stock snapshots rebuildable.
3. Add automatic backup before all bulk import/admin/merge/delete operations.
4. Introduce schema validation for every loaded collection and every imported row.
5. Replace full-array `saveData` writes with append-only event writes or transactional patches.
6. Add global duplicate ID detector and partial Firebase read barrier.
7. Move heavy admin/audit/PDF/Excel modules behind lazy loading.
8. Enforce permissions server-side / Firestore rules, not only client-side.
9. Build disaster recovery: point-in-time export, rollback, restore drill.
10. Add invariant tests for ledgers, stock, cashbook, imports, deletes, and partial writes.
