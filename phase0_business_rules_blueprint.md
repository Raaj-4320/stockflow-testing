# Phase 0 — Business Rules Blueprint

> This blueprint captures rule intent and enforcement points from current code. Each rule includes migration sensitivity.

| rule name | source files | functions enforcing it | key inputs | outputs/effects | risk if migrated incorrectly |
|---|---|---|---|---|---|
| Auth verification gating | `App.tsx`, `services/auth.ts`, `firestore.rules`, `services/storage.ts` | `ProtectedRoute`, `login`, Firestore `isVerified`, `assertCloudWriteReady` | auth user state, `emailVerified` | blocks unverified access/writes | unauthorized data access or blocked legit users |
| Store initialization on verified login | `services/storage.ts` | `ensureStoreInitializedForCurrentUser`, `syncFromCloud` | current user uid | create/merge store root doc if missing | data missing / broken first-login bootstrap |
| Product create/update/delete | `pages/Admin.tsx`, `services/storage.ts` | `addProduct`, `updateProduct`, `deleteProduct` | product payload | mutate product subcollection + masters | stock/inventory corruption |
| Variant/color stock identity | `services/productVariants.ts`, `services/stockBuckets.ts`, `services/storage.ts` | normalization + key generators | productId, variant, color | consistent bucket targeting | wrong stock bucket updates |
| Stock deduction on sale | `services/storage.ts`, `pages/Sales.tsx` | `processTransaction` internals | tx items + quantities | decrement stock & increment sold metrics | oversell or mismatch stock |
| Stock restoration on return/update/delete | `services/storage.ts`, `pages/Transactions.tsx` | `processTransaction`, `updateTransaction`, `deleteTransaction` | original/updated tx, return mode | restore/reconcile stock correctly | unrecoverable inventory drift |
| Sale settlement calculation | `services/storage.ts`, `pages/Sales.tsx`, `pages/Transactions.tsx` | `getSaleSettlementBreakdown` | total, payment method, store credit use | cash/online/credit split | cashbook and due ledger mismatch |
| Discount handling | `pages/Sales.tsx`, `pages/Transactions.tsx`, `services/storage.ts` | checkout/edit calculators | line discounts, tx discount/tax | total/subtotal normalization | incorrect invoice totals |
| Cash/online/credit due split | `services/storage.ts` | `getSaleSettlementBreakdown` + validators | payment method, explicit settlement | canonical payment split | finance and customer due errors |
| Store credit usage | `services/storage.ts`, `pages/Sales.tsx` | `getClampedStoreCreditUsed` + process path | customer store credit, requested use | reduces payable and customer credit | negative/invalid balances |
| Customer due balance update | `services/storage.ts`, `pages/Customers.tsx`, `pages/Finance.tsx` | `processTransaction`, canonical snapshot helpers | tx history, payment/return modes | adjust `totalDue`/`storeCredit` | customer ledger inaccuracies |
| Return handling modes | `services/storage.ts`, `pages/Sales.tsx` | `getResolvedReturnHandlingMode`, `getCanonicalReturnAllocation` | mode + due context + history | refund cash/online OR reduce due OR store credit | refund liability mistakes |
| Transaction update reconciliation | `services/storage.ts`, `pages/Transactions.tsx` | `getTransactionUpdateAuditPreview`, `updateTransaction` | original vs edited tx | corrected stock/customer/finance effects | silent financial corruption |
| Transaction delete compensation | `services/storage.ts`, `pages/Transactions.tsx`, `pages/Finance.tsx` | `deleteTransaction`, delete compensation helpers | delete reason/mode | archive deleted tx and optional cash compensation record | audit trail gaps and cash mismatch |
| Deleted transaction archive behavior | `services/storage.ts` | delete path + bin loaders | deleted tx data | writes `deletedTransactions` record with impact snapshots | loss of forensic traceability |
| Shift opening rules | `pages/Finance.tsx`, `services/storage.ts` | `startShift`, `saveData` guard | existing sessions, opening balance | one active open shift | duplicate open sessions |
| Shift closing rules | `pages/Finance.tsx` | `closeShift`, `getSessionCashTotals` | closing counts/balance + tx/expense windows | close session with computed system cash/difference | end-of-day reconciliation failure |
| Cashbook calculation | `pages/Finance.tsx`, `services/storage.ts` | finance derivation helpers | tx, expenses, delete compensations | rollups for cash in/out, profit, due/store-credit movements | incorrect management reporting |
| Expense handling | `pages/Finance.tsx`, `services/storage.ts` | `addExpense`, `removeExpense`, category ops | expense form values | expense ledger updates | profit/cash distortion |
| Freight inquiry lifecycle | `pages/FreightBooking.tsx`, `services/storage.ts` | inquiry CRUD functions | inquiry wizard payload | persist inquiry status and lines | procurement planning errors |
| Inquiry -> confirmed conversion | `pages/FreightBooking.tsx`, `services/storage.ts` | `convertInquiryToConfirmedOrder` | inquiry id | confirmed order snapshot + linkage updates | broken lineage and duplicate conversions |
| Purchase order creation | `pages/PurchasePanel.tsx`, `services/storage.ts` | `createPurchaseOrder` | order draft lines + party | persist PO and totals | procurement pipeline break |
| Purchase receive logic | `pages/PurchasePanel.tsx`, `services/storage.ts` | `receivePurchaseOrder`, `applyPurchaseLineToProduct` | receive method + order id | stock increases, buy price update strategy, receipt posting | inventory/cost valuation errors |
| Image upload behavior | `services/storage.ts`, Cloudinary handlers | `uploadProductImageIfNeeded`, `getCloudinarySignature`, upload helper | data URL/image path + env keys | store Cloudinary URL | broken product images and save failures |
| Import validation behavior | `services/importExcel.ts` + storage | import validators + importers | xlsx rows | reject/accept normalized rows and apply mutations | bulk data corruption |
| Export behavior | `services/excel.ts`, `services/pdf.ts`, pages | export functions | selected data/filters | downloadable reports | external reporting contract break |

## Additional Rule Notes
- Security is enforced both client-side (guards) and server-side (`firestore.rules`); migration must preserve server-enforced trust boundary.
- Transaction logic is history-sensitive (returns/allocations), so deterministic ordering and timestamp behavior must be preserved.
- Procurement conversions rely on lineage fields; flattening or lossy transformation will break traceability.
