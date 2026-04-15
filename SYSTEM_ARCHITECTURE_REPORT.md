# 1. Delta From First Report

This second pass adds **engineering extraction depth** that was missing in pass one:

- Expanded from high-level architecture summary to a **repo-wide inventory table** with line counts, activity status, importers, dependencies, and criticality.
- Added **evidence-driven usage classification** (`definitely active`, `legacy`, `unclear`) using actual route map/import graph/call paths.
- Added **function/module extraction** per major file with export lists, internal major handlers, side effects, read/write behavior, and callers.
- Added **import graph hotspot analysis** using observed local import counts.
- Added explicit **Firestore schema + collection path map**, including legacy schema compatibility assumptions in migration scripts.
- Added full **event/synchronization map** (emitters/listeners and update consequences).
- Added **critical call-chain traces** for boot/auth/CRUD/checkout/finance/procurement/upload/import-export.
- Added explicit **active vs legacy code report**, and a moduleized **refactor blueprint + rebuild spec** aimed at another AI/engineer handoff.

---

# 2. Full Source Inventory

> Scope: meaningful app/runtime/config/scripts files (excluding `node_modules`, lockfile internals, and build artifacts).

| file path | approx lines | file type | primary responsibility | active / legacy / unclear | imported by | depends on | criticality |
|---|---:|---|---|---|---|---|---|
| `index.tsx` | 18 | entry | App bootstrap + behavior logger init | Definitely active | Vite entry | `App`, `services/behaviorLogger` | High |
| `App.tsx` | 307 | app shell | Auth gate, router, nav, status banners | Definitely active | `index.tsx` | pages, `services/auth`, `services/storage`, `services/firebase`, `components/ui` | High |
| `types.ts` | 545 | shared types | Canonical domain schemas/interfaces | Definitely active | pages + services | none | High |
| `components/ui.tsx` | 201 | UI primitives | Button/Input/Card/Badge/Tabs/Switch | Definitely active | 11 files | `clsx`, `tailwind-merge`, React | High |
| `components/ExportModal.tsx` | 63 | component | Generic PDF/Excel export picker modal | Definitely active | Admin/Customers/Reports/Sales/Transactions | `components/ui` | Medium |
| `components/UploadImportModal.tsx` | 155 | component | Generic import modal with progress/result | Definitely active | Admin/Customers/PurchasePanel/Transactions | `components/ui`, `services/importExcel` types | Medium |
| `pages/Auth.tsx` | 307 | page | Login/register/reset/resend flows | Definitely active (rendered by App auth state) | `App.tsx` | `services/auth`, `components/ui` | High |
| `pages/VerificationRequired.tsx` | 57 | page | Unverified user gate page | Definitely active (route + auth state) | `App.tsx` | `services/firebase`, firebase auth SDK, `components/ui` | High |
| `pages/Admin.tsx` | 2040 | page | Inventory master CRUD + categories + barcode + import/export | Definitely active (route `/`) | `App.tsx` | `services/storage`, `productVariants`, `excel`, `importExcel`, UI + modals | High |
| `pages/Sales.tsx` | 1517 | page | POS checkout/returns/cart/customer assignment | Definitely active (route `/sales`) | `App.tsx` | `services/storage`, `productVariants`, `stockBuckets`, `pdf`, `excel`, UI | High |
| `pages/Transactions.tsx` | 1951 | page | Transaction history/edit/delete/bin/import/export | Definitely active (route `/transactions`) | `App.tsx` | `services/storage`, `numberFormat`, `pdf`, `excel`, `importExcel`, UI | High |
| `pages/Customers.tsx` | 1496 | page | Customer CRM, due collection, upfront orders | Definitely active (route `/customers`) | `App.tsx` | `services/storage`, `pdf`, `excel`, `importExcel`, `numberFormat`, UI | High |
| `pages/Reports.tsx` | 323 | page | Product catalog/internal report exports | Definitely active (route `/pdf`) | `App.tsx` | `services/storage`, `excel`, `productVariants`, UI | Medium |
| `pages/Settings.tsx` | 233 | page | Store profile/tax/signature/PIN settings | Definitely active (route `/settings`) | `App.tsx` | `services/storage`, `services/auth`, `types`, UI | Medium |
| `pages/Finance.tsx` | 2899 | page | Cashbook, shift open/close, expense, profit analytics | Definitely active (route `/finance`) | `App.tsx` | `services/storage`, `financeLogger`, `numberFormat`, `services/auth`, UI | High |
| `pages/FreightBooking.tsx` | 1056 | page | Freight inquiry workflow + conversion to confirmed order | Definitely active (route `/freight-booking`) | `App.tsx` | `services/storage`, `productVariants`, `types`, UI | Medium-High |
| `pages/PurchasePanel.tsx` | 841 | page | Purchase order create/import/receive flow | Definitely active (route `/purchase-panel`) | `App.tsx` | `services/storage`, `importExcel`, `productVariants`, `types`, UI | Medium-High |
| `pages/ClassicPOS.tsx` | 1836 | page | Alternate/demo POS with hardcoded data | Legacy but present (not routed/imported) | none | React only | Low-Med |
| `services/firebase.ts` | 33 | service | Firebase app/auth/db init from env | Definitely active | `App`, `services/auth`, `services/storage`, Verification page | firebase SDK | High |
| `services/auth.ts` | 128 | service | Auth API wrapper + profile bootstrap doc | Definitely active | `App`, Auth/Settings/Finance pages | `services/firebase`, firebase auth/firestore SDK | High |
| `services/storage.ts` | 4613 | service (god-module) | Domain logic + cloud sync + writes + validation + audit + events | Definitely active | App + 9 page/service files | firebase SDK, `types`, `stockBuckets`, `financeLogger` | High |
| `services/productVariants.ts` | 82 | service/util | Variant/color normalization and stock row helpers | Definitely active | 7 page files + excel/pdf/stockBuckets | `types` | High |
| `services/stockBuckets.ts` | 44 | service/util | Cart item stock bucket aggregation identity | Definitely active | Sales page + storage service | `types`, `productVariants` | Medium |
| `services/numberFormat.ts` | 29 | util | Money/INR formatting helpers | Definitely active | Sales/Customers/Transactions/Finance + excel/pdf | none | Medium |
| `services/excel.ts` | 599 | service | Excel export suite | Definitely active | Admin/Customers/Reports/Sales/Transactions | `types`, `storage`, `numberFormat`, `productVariants`, xlsx | Medium-High |
| `services/importExcel.ts` | 1047 | service | Template/download/import validation + writes | Definitely active | Admin/Customers/PurchasePanel/Transactions + modal type imports | `storage`, `types`, `productVariants`, xlsx | High |
| `services/pdf.ts` | 467 | service | Invoice PDF + thermal print rendering | Definitely active | Sales/Customers/Transactions | `storage`, `types`, `numberFormat`, `productVariants`, jspdf | Medium |
| `services/behaviorLogger.ts` | 429 | service | Global telemetry/event/fetch/xhr interception | Definitely active (`index.tsx`) | `index.tsx` | window/document/fetch/xhr globals | Medium |
| `services/financeLogger.ts` | 14 | util | Finance log wrapper gated by env flag | Definitely active | `services/storage`, Finance page | none | Low-Med |
| `services/gemini.ts` | 39 | service | Gemini product description / sales analysis | Likely inactive in current UI (no imports in pages) | none local imports | `@google/genai` | Low |
| `api/cloudinary-sign-upload.ts` | 42 | API handler | Cloudinary signed-upload signature endpoint | Unclear runtime target (framework API path) | none local | crypto + env | Medium |
| `netlify/functions/cloudinary-sign-upload.ts` | 38 | serverless handler | Netlify Cloudinary signature endpoint | Likely active for Netlify deployments | none local | crypto + env | Medium |
| `scripts/backfill-customer-product-stats.js` | 118 | maintenance script | Backfill `customerProductStats` from transactions | Legacy/ops active (manual) | npm script only | firebase-admin | Medium |
| `scripts/verify-customer-product-stats-backfill.js` | 95 | maintenance script | Verify migration marker strict completion | Legacy/ops active (manual) | npm script only | firebase-admin | Medium |
| `scripts/migrate-images-to-cloudinary.js` | 249 | maintenance script | Migrate legacy image URLs to Cloudinary | Legacy/ops active (manual) | npm script only | firebase-admin + cloudinary | Medium |
| `scripts/verify-image-migration-status.js` | 129 | maintenance script | Verify remaining Firebase Storage image refs | Legacy/ops active (manual) | npm script only | firebase-admin | Medium |
| `firestore.rules` | 52 | security config | Firestore authz policy and isolation | Definitely active if deployed | firebase deploy flow | rules DSL | High |
| `firebase.json` | 5 | config | Maps firestore rules file | Definitely active in deploy flows | firebase CLI | rules path | Medium |
| `vite.config.ts` | 23 | build config | Vite config, env injection, aliases | Definitely active | Vite toolchain | Vite/react plugin/path | High |
| `package.json` | 40 | build/runtime meta | scripts/dependencies | Definitely active | npm tooling | N/A | High |
| `index.html` | 114 | web shell | app root mount + styles/scripts | Definitely active | Vite runtime | N/A | High |
| `netlify.toml` | 0 | deploy config | Empty placeholder currently | Unclear | none | none | Low |

---

# 3. Exact Route-to-File Map

| route path | component file | child components used | services used | guard | major actions |
|---|---|---|---|---|---|
| `/` | `pages/Admin.tsx` | `ExportModal`, `UploadImportModal`, shared UI | `storage`, `productVariants`, `excel`, `importExcel` | `ProtectedRoute` (verified) | product CRUD, category/variant/color management, purchase history updates, low stock export |
| `/sales` | `pages/Sales.tsx` | `ExportModal`, shared UI, `ProductGridItem` local | `storage`, `productVariants`, `stockBuckets`, `pdf`, `excel`, `numberFormat` | `ProtectedRoute` | cart build, checkout, return flow, customer attach/create, receipt/invoice export |
| `/transactions` | `pages/Transactions.tsx` | `ExportModal`, `UploadImportModal`, shared UI | `storage`, `pdf`, `excel`, `importExcel`, `numberFormat`, `productVariants` | `ProtectedRoute` | filter/search, edit transaction, delete with reason, view deleted bin, export/import history |
| `/customers` | `pages/Customers.tsx` | `ExportModal`, `UploadImportModal`, shared UI | `storage`, `pdf`, `excel`, `importExcel`, `numberFormat`, `productVariants` | `ProtectedRoute` | customer CRUD, payment collection, upfront orders, customer statements/invoices |
| `/pdf` | `pages/Reports.tsx` | `ExportModal`, shared UI | `storage`, `excel`, `productVariants` | `ProtectedRoute` | generate product catalog/internal PDF and detailed sales export |
| `/settings` | `pages/Settings.tsx` | shared UI | `storage`, `auth` | `ProtectedRoute` | update store profile, tax settings, signature image, manager unlock PIN |
| `/finance` | `pages/Finance.tsx` | shared UI + local stat/tile components | `storage`, `financeLogger`, `numberFormat`, `auth` | `ProtectedRoute` | shift open/close, expense entry/categories, cashbook analysis/export, credit collection |
| `/freight-booking` | `pages/FreightBooking.tsx` | shared UI + local `SummaryCard`/`Modal` | `storage`, `productVariants` | `ProtectedRoute` | create/edit freight inquiry, broker/category quick create, convert inquiry -> confirmed order |
| `/purchase-panel` | `pages/PurchasePanel.tsx` | `UploadImportModal`, shared UI + local `SummaryCard`/`Modal` | `storage`, `importExcel`, `productVariants` | `ProtectedRoute` | create purchase order, manage party, import purchases, receive order to stock |
| `/verify-email` | `pages/VerificationRequired.tsx` | shared UI | `services/firebase` + firebase/auth SDK | none (explicit page) | resend verification, sign out/reload |
| `*` | redirect | N/A | N/A | N/A | catch-all navigation -> `/` |

Auth-shell routing in `App.tsx`:
- `authStatus === unauthenticated` -> render `<Auth/>`
- `authStatus === unverified` -> render `<VerificationRequired/>`
- else render router shell.

---

# 4. Full Export and Function Inventory

## 4.1 App shell and entry

### `index.tsx`
- Exports: none.
- Side effects:
  - validates root element existence.
  - calls `initializeBehaviorTracking()`.
  - mounts `<App/>`.
- Called by: Vite runtime.

### `App.tsx`
- Exports: default `App`.
- Major internal components/functions:
  - `NavItem` (UI-only): active-route sidebar link rendering.
  - `QuickLink` (UI-only): quick action navigation links.
  - `MenuController` (side-effectful): closes mobile menu on location change.
  - `ProtectedRoute` (UI+guard): redirects to `/verify-email` if not verified.
  - `handleLoginSuccess` (state setter): updates local authStatus.
- State reads: auth status, current email, storeName, cloud/op status.
- Writes: local component state only.
- Calls: `getCurrentUser`, `logout`, `loadData`, Firebase `onAuthStateChanged`.

## 4.2 Pages

### `pages/Admin.tsx`
- Exports: default `Admin`.
- Major internal functions (selected high-value):
  - `refreshData` (side effect): loads products/categories/profile/masters from `loadData()`.
  - `saveProduct` (async + side effect): create/update via `addProduct` or `updateProduct`.
  - `handleAddPurchase` (async + side effect): adjusts stock/purchase history then updates product.
  - `handleDelete` (async): delete product via `deleteProduct`.
  - `handleAddCategory`, `handleDeleteCategory`, `handleSaveRenameCategory` (side effects via storage).
  - `handleBatchEditProducts`, `handleBatchDeleteProducts` (multi-entity UI workflows).
  - `handleDownloadLowStockPDF`, `handleDownloadCategoryPDF`, `handleExport` (report generation side effects).
- Reads: products/categories/masters/profile from `loadData`.
- Writes: product/category/master state and storage via service calls.
- Callers: route `/` UI actions.

### `pages/Sales.tsx`
- Exports: default `Sales`.
- Major functions:
  - `refreshData` (load state from storage).
  - cart mutators: `addToCart`, `updateQuantity`, `setManualQuantity`, `updatePrice`, `updateDiscount`.
  - return/stock helpers: `getLineAvailableStock`, `getReturnableQty`, `getProductReturnableQty`.
  - checkout pipeline: `initiateCheckout` -> `completeCheckout` -> `processTransaction`.
  - `handleDataOpStatus` listens for transaction op completion events.
  - `handlePrintReceipt` + `handleExport` produce PDF/Excel invoice.
- Side effects: heavy (storage writes, event-driven completion, receipt generation).
- Reads/writes: products/customers/transactions/cart and many UI states.

### `pages/Transactions.tsx`
- Exports: default `Transactions`.
- Major functions:
  - `refreshData` load transactions/customers/products/bin.
  - edit utilities: `openTransactionEditor`, `updateEditingItem`, `addSaleLine`, derived total calculators.
  - destructive flow: `openDeleteModal` -> `handleConfirmDelete` -> `deleteTransaction`.
  - update flow: `handleSaveTransaction` -> `updateTransaction`.
  - export flow: `handleExport`, `handleRunExcelExport`, `handleDownloadPDF`.
- Uses storage audit helpers: `getDeleteTransactionPreview`, `getTransactionUpdateAuditPreview`, return preview.

### `pages/Customers.tsx`
- Exports: default `Customers`.
- Major functions:
  - `refreshData`, canonical due/credit snapshot mapping.
  - customer edit/create/delete handlers.
  - payment collection (`handleRecordPayment`) -> posts payment transaction via `processTransaction`.
  - upfront order functions: add/update/collect.
  - export handlers: statements, all customers, invoice export.
- Side effects: storage writes and PDF/Excel generation.

### `pages/Finance.tsx`
- Exports: default `Finance`; local presentational helpers (`StatCard`, `Pill`, `MoneyTile`).
- Major pure-ish helpers:
  - financial derivations: `getSaleSettlementContribution`, `accumulateCanonicalReturnEffects`, `buildCanonicalFinanceBreakdown`, `getSessionCashTotals`.
  - diagnostics: `scanSessionHistory`, `evaluateCarryForwardSession`, `getLastValidClosingSession`.
- Major side-effect handlers:
  - `persistState` -> `saveData`.
  - shift lifecycle: `startShift`, `closeShift`.
  - opening edit security: `handleManagerUnlock`, `saveOpeningBalanceEdit`.
  - expense ops: `addExpense`, `removeExpense`, category add/delete.
  - exports: `exportCashbookCsv`, `exportCashbookWorkbook`, `exportExpensePDF`.
- Reads/writes: many `AppState` slices (`transactions`, `cashSessions`, `expenses`, corrections).

### `pages/FreightBooking.tsx`
- Exports: default `FreightBooking`; local `SummaryCard`, `Modal`.
- Major functions:
  - `refresh` load product/inquiry/confirmed-order/broker data.
  - wizard flow: `openNewInquiry`, `openEditInquiry`, `selectProduct`, `goToPricing`.
  - line/carton calculators: `updatePricingEntry`, `updateAssignment`, `createNewCarton`, `updateCartonCbm`.
  - metadata quick create: `createBroker`, `createBrokerQuick`, `addCategoryQuick`.
  - `saveInquiry` -> `createFreightInquiry` / `updateFreightInquiry`.
  - `convertToConfirmedOrder` -> `convertInquiryToConfirmedOrder`.

### `pages/PurchasePanel.tsx`
- Exports: default `PurchasePanel`; local `SummaryCard`, `Modal`.
- Major functions:
  - `refresh`, `openCreateOrder`, wizard steps.
  - line pricing updates.
  - party create `saveParty`.
  - order create `saveOrder` -> `createPurchaseOrder`.
  - receiving flow: `handleReceive` -> modal -> `confirmReceiveOrder` -> `receivePurchaseOrder`.

### `pages/Reports.tsx`
- Exports: default `Reports`.
- Functions: `refreshData`, `generatePDF`, `handleExport`, plus image source resolution.
- Side effects: PDF generation and excel exports.

### `pages/Settings.tsx`
- Exports: default `Settings`.
- Functions: `refreshData`, `handleSave`, `handleTaxChange`, `handleSignatureUpload`.
- Side effects: `updateStoreProfile`, image resizing via canvas.

### `pages/Auth.tsx`
- Exports: default `Auth`.
- Functions: `handleSubmit`, `handleResendVerification`.
- Side effects: auth requests and local messages.

### `pages/VerificationRequired.tsx`
- Exports: default `VerificationRequired`.
- Functions: `handleResend`, `handleBackToLogin`.
- Side effects: firebase auth operations + reload.

### `pages/ClassicPOS.tsx`
- Exports: default `ClassicPOS`.
- Internal functions: complete local POS behavior with hardcoded sample data.
- Usage status: not imported by route shell; appears legacy/demo.

## 4.3 Services

### `services/firebase.ts`
- Exports: `{ app, db, auth }`.
- Behavior: env resolution from `process.env` and `import.meta.env`; conditionally initializes Firebase.
- Side effects: initialization attempt at module load.

### `services/auth.ts`
- Exports:
  - `getCurrentUser`
  - `login`
  - `register`
  - `resetPassword`
  - `resendVerificationEmail`
  - `logout`
- Reads: firebase auth state.
- Writes: Firestore `users/{uid}` profile docs on first login/register.
- Side effects: auth state transitions, signout+reload.

### `services/storage.ts` (core engine)
- Exports (high-level groups):
  1. constants/registries (`STORAGE_FLOW_REGISTRY`, credit threshold).
  2. finance/return normalization helpers.
  3. preview/audit helpers (`getDeleteTransactionPreview`, `getTransactionUpdateAuditPreview`, etc.).
  4. state load/save (`loadData`, `saveData`, `requestStoreProvisioning`, `updateStoreProfile`, `resetData`).
  5. product/category/master CRUD.
  6. customer/upfront CRUD.
  7. procurement/freight/purchase CRUD + conversion + receipt.
  8. transaction lifecycle (`processTransaction`, `addHistoricalTransactions`, `deleteTransaction`, `updateTransaction`).
- Major internal side-effectful functions:
  - cloud sync/eventing: `syncFromCloud`, `syncToCloud`, `emitDataOpStatus`, `emitCloudSyncStatus`, `emitLocalStorageUpdate`.
  - Firestore ops and guards: `assertCloudWriteReady`, `writeAuditEvent`, subcollection upserts/deletes.
  - transaction atomic commit path: `commitProcessTransactionAtomically` + post-commit compensation handling.
  - image upload path: `getCloudinarySignature`, `uploadDataUrlToCloudinary`, `uploadProductImageIfNeeded`.
- Reads: full app domain state + auth/network/cloud flags.
- Writes: Firestore root + subcollections + browser events + in-memory state.

### `services/productVariants.ts`
- Exports normalization and stock/price resolution helpers (`NO_VARIANT`, `NO_COLOR`, resolver functions).
- Pure utility behavior (mostly).

### `services/stockBuckets.ts`
- Exports identity/key builders and cart aggregation by product/variant/color.
- Pure utility behavior.

### `services/numberFormat.ts`
- Exports formatting helpers; pure.

### `services/excel.ts`
- Exports 6 functions:
  - `exportProductsToExcel`
  - `exportTransactionsToExcel`
  - `exportDetailedSalesToExcel`
  - `exportCustomersToExcel`
  - `exportInvoiceToExcel`
  - `exportCustomerStatementToExcel`
- Side effects: downloads files (`XLSX.writeFile`).
- Reads: for some exports, calls `loadData()` and storage finance helpers.

### `services/importExcel.ts`
- Exports template/data downloaders and importers:
  - templates: inventory/customers/transactions/purchase
  - data exports: inventory/customers/transactions/purchase
  - imports: `importInventoryFromFile`, `importCustomersFromFile`, `importTransactionsFromFile`, `importHistoricalTransactionsFromFile`, `importPurchaseFromFile`
- Side effects: file parsing/writing, storage writes through service functions.

### `services/pdf.ts`
- Exports: `generateReceiptPDF`, `printThermalInvoice`.
- Reads: `loadData().profile`, customers/transactions.
- Side effects: file download or print popup.

### `services/behaviorLogger.ts`
- Exports:
  - logging APIs (`logUserAction`, `logStateChange`, `logError`)
  - reporting (`generateSessionSummary`, `exportLogs`)
  - bootstrap (`initializeBehaviorTracking`)
  - external event emitters (`emitUserActionEvent`, `emitStateChangeEvent`)
- Side effects:
  - monkey-patches `window.fetch` and XHR
  - adds document/window listeners
  - stores logs in `window.__APP_LOGS__`.

### `services/financeLogger.ts`
- Exports `financeLog` object wrapper around console logging.

### `services/gemini.ts`
- Exports `generateProductDescription`, `analyzeSales`.
- Async network calls to Google GenAI.
- Not currently imported by active pages/services (local graph), so likely dormant.

## 4.4 Cloudinary/serverless handlers

### `api/cloudinary-sign-upload.ts`
- Export: default `handler(req,res)`.
- Behavior: POST-only, validates env keys, computes SHA1 signature using timestamp+folder.

### `netlify/functions/cloudinary-sign-upload.ts`
- Export: `handler(event)`.
- Behavior: same logic adapted to Netlify function response model.

## 4.5 Scripts

- `backfill-customer-product-stats.js`:
  - scans stores + transactions, writes `customerProductStats`, sets migration marker.
- `verify-customer-product-stats-backfill.js`:
  - validates marker status/version/strict flag and exits with status code semantics.
- `migrate-images-to-cloudinary.js`:
  - migrates Firebase-storage image URLs to Cloudinary in two legacy layout patterns.
- `verify-image-migration-status.js`:
  - audits remaining Firebase image refs in legacy locations.

---

# 5. Dependency Graph Hotspots

## 5.1 Most depended-on local files (observed)

1. `components/ui.tsx` (11 importers): shared primitive surface across almost every page.
2. `services/storage.ts` (9 importers): central data/business gateway.
3. `types.ts` (8+ importers from pages/services): shared contract model.
4. `services/productVariants.ts` (7 importers): variant/stock correctness helper.
5. `services/numberFormat.ts` (6 importers): display/report formatting.

## 5.2 Why hotspots exist

- The app intentionally centralizes domain logic in `storage.ts`; pages call it directly.
- UI primitives unify styling and interaction baseline.
- `types.ts` hosts broad schema for all modules (sales + finance + procurement), creating broad coupling.

## 5.3 Circular dependency risks

No obvious direct import cycle was detected in local graph extraction. However, there is **functional cyclical coupling risk**:
- `storage` exports finance helpers used by `excel/pdf/pages`, while pages feed user operations back into `storage`; not cyclic imports, but cyclic domain dependency pressure.

## 5.4 Hidden coupling / god-modules

- `services/storage.ts` is a clear god-module:
  - cloud sync
  - event bus emission
  - transaction engine
  - finance derivations
  - procurement lifecycle
  - image upload integration
  - audit logging
- `pages/Finance.tsx` is a UI god-component mixing visualization, analytics, reconciliation, and state mutation workflows.

## 5.5 Broad utility surface area

- `services/productVariants.ts`: small but high-impact correctness utility.
- `services/importExcel.ts`: wide and deep import-time business behavior.

---

# 6. Firestore / Data Model Map

## 6.1 Security model (rules)

- `/users/{uid}`: own-doc read/create/update, no delete.
- `/stores/{uid}` and nested `/stores/{uid}/{subcollection}/{docId}`:
  - require signed-in + email verified + matching `request.auth.uid == uid`.
- Default deny all other paths.

## 6.2 Primary runtime schema (client)

### Root document
- Path: `stores/{uid}`
- Contains root app-state entities **excluding migrated heavy entities** during root sync:
  - profile
  - categories
  - upfrontOrders
  - cashSessions
  - expenses, expenseCategories, expenseActivities
  - freightInquiries / freightConfirmedOrders / freightPurchases
  - purchaseReceiptPostings / purchaseParties / purchaseOrders
  - variantsMaster, colorsMaster
  - migration markers
  - updatedTransactionEvents, deleteCompensations

### Subcollections (actively hydrated)
- `stores/{uid}/products`
- `stores/{uid}/customers`
- `stores/{uid}/transactions`
- `stores/{uid}/deletedTransactions`

### Additional operational collections
- `stores/{uid}/auditEvents`
- `stores/{uid}/operationCommits`
- `stores/{uid}/customerProductStats`

## 6.3 Read paths

- `syncFromCloud()`:
  - opens snapshot listeners for products/customers/transactions/deletedTransactions subcollections.
  - listens root `stores/{uid}` doc.
  - also performs initial `getDocs` hydration for subcollections when root snapshot arrives.

## 6.4 Write paths

- Product/customer/transaction entity writes are subcollection-oriented (`upsert*InSubcollection`/delete).
- Root `saveData` writes sanitized root state with migrated entities omitted to prevent array overwrite blast.
- Transaction atomic flow writes operation commits + customer product stats in transaction flows.

## 6.5 Important field and derived data behavior

- Transaction finance fields:
  - `saleSettlement` (cashPaid/onlinePaid/creditDue)
  - `storeCreditUsed`
  - `returnHandlingMode`
- Customer derived balance normalized via canonical helpers:
  - `totalDue`
  - `storeCredit`
- Product variant combination stats:
  - `stockByVariantColor[]` with optional per-row buy/sell/totalPurchase/totalSold.
- Procurement lineage fields:
  - inquiry -> confirmed (`sourceInquiryId`)
  - confirmed -> purchase (`sourceConfirmedOrderId`)
  - optional inventory linkage `sourceProductId` / `inventoryProductId`.

## 6.6 Legacy schema variants referenced

Migration scripts still inspect:
- top-level `products` collection docs (`products/{id}`), and
- legacy `stores/{id}` doc embedded `products` array.

This indicates historical storage evolution from array/root collection patterns to current subcollection model.

## 6.7 Example effective shape (runtime)

```ts
stores/{uid} {
  profile: StoreProfile,
  categories: string[],
  cashSessions: CashSession[],
  expenses: Expense[],
  freightInquiries: FreightInquiry[],
  purchaseOrders: PurchaseOrder[],
  migrationMarkers: { customerProductStatsBackfill?: ... },
  ...
}

stores/{uid}/products/{productId} -> Product
stores/{uid}/customers/{customerId} -> Customer
stores/{uid}/transactions/{txId} -> Transaction
stores/{uid}/deletedTransactions/{recordId} -> DeletedTransactionRecord
stores/{uid}/customerProductStats/{customerId_productId} -> { soldQty, returnedQty, ... }
```

---

# 7. Event and Synchronization Flow

## 7.1 Events emitted by `services/storage.ts`

- `data-op-status` (`CustomEvent`)
  - emitted by `emitDataOpStatus` around operations (`start/success/error`).
- `cloud-sync-status` (`CustomEvent`)
  - emitted by `emitCloudSyncStatus` for `idle/loading/ready/missing_store/offline/error`.
- `local-storage-update` (`Event`)
  - emitted after memory state changes or sync hydration.
- `app-state-change` (`CustomEvent`)
  - emitted in selected state transitions for behavior logging.

## 7.2 Event listeners

- `App.tsx` listens:
  - `local-storage-update` (refresh store name)
  - `cloud-sync-status` (status banner)
  - `data-op-status` (op toast)
- `Sales.tsx` listens:
  - `storage`, `local-storage-update` (data refresh)
  - `data-op-status` (checkout success/error correlation)
- Most pages listen:
  - `storage` and/or `local-storage-update` to refresh local view state.
- `Finance.tsx` additionally listens:
  - `cloud-sync-status` for online/sync diagnostics.

## 7.3 `services/behaviorLogger.ts` event ecosystem

- listens to:
  - `app-user-action`
  - `app-state-change`
  - `data-op-status`
  - global `error`, `unhandledrejection`, click/submit, hashchange
- emits helper events via exported functions:
  - `emitUserActionEvent`
  - `emitStateChangeEvent`

## 7.4 Sync triggers and cloud lifecycle

- auth state changed -> `syncFromCloud()`.
- browser online event -> attempts reconnect sync.
- browser offline event -> cloud status offline.

## 7.5 Bug-prone zones

- Event ordering/race: `loadData()` may return stale memory before async listeners hydrate.
- Multi-source refresh duplication: many pages subscribe both `storage` and `local-storage-update`.
- UI correlation risk: checkout event matching relies on pending refs + `transactionId` in op-status.

---

# 8. Critical Runtime Call Chains

## 8.1 App boot
1. `index.tsx` -> `initializeBehaviorTracking()`.
2. render `<App/>`.
3. `App` subscribes to auth state and status events.
4. Auth success causes pages to mount and call `loadData()`.
5. `loadData()` may trigger `syncFromCloud()` and listener hydration.

## 8.2 Auth login
1. `pages/Auth.handleSubmit()`.
2. `services/auth.login(email,password)`.
3. Firebase `signInWithEmailAndPassword`.
4. If unverified -> signOut + return requires verification.
5. If verified -> ensure `users/{uid}` doc exists.
6. `onLogin()` callback updates App auth status.

## 8.3 Auth verification gate
1. `App` tracks `onAuthStateChanged`.
2. if user verified => `authenticated`.
3. else -> `unverified` and `VerificationRequired` route/screen.
4. Protected routes enforce `isVerified` else redirect `/verify-email`.

## 8.4 Initial data load
1. page `useEffect` calls `loadData()`.
2. `loadData` returns `memoryState`; if first sync online, triggers `syncFromCloud`.
3. `syncFromCloud` sets listeners and hydrates from Firestore.
4. each listener updates `memoryState` and emits `local-storage-update`.
5. pages refresh state on event.

## 8.5 Product create/update/delete
1. Admin form handler -> `addProduct` / `updateProduct` / `deleteProduct`.
2. storage validates/sanitizes variant stock data.
3. optional image upload to Cloudinary.
4. write subcollection doc change.
5. write root metadata updates (`variantsMaster`, `colorsMaster`, etc.) via `saveData` when needed.
6. listeners refresh products list.

## 8.6 Transaction create/update/delete

### Create (`processTransaction`)
1. Sales/Customers/Finance compose transaction.
2. call `processTransaction(tx)`.
3. storage validates payment/type rules, stock rules, due/credit math.
4. atomic commit writes transaction + product/customer updates + operation commit/audit artifacts.
5. emits op-status + local update.

### Update (`updateTransaction`)
1. Transactions editor prepares updated transaction.
2. storage computes audit preview/corrections.
3. reconcile original and updated effects across product/customer/finance impacts.
4. persist and emit statuses.

### Delete (`deleteTransaction`)
1. Transactions page gets delete preview.
2. user confirms reason.
3. storage reconciles reverse effects, writes deleted record, optional compensation records.
4. emits statuses and refresh events.

## 8.7 Sales checkout
1. cart + payment/customer state assembled in Sales.
2. `initiateCheckout` validates shift/open mode and constraints.
3. `completeCheckout` creates transaction payload with return mode/settlement.
4. call `processTransaction`.
5. listens to `data-op-status` for transaction-specific success/error.
6. on success shows completion UI and allows receipt/invoice export.

## 8.8 Customer payment collection
1. Customers page payment modal -> amount/method.
2. constructs `type: 'payment'` transaction for selected customer.
3. `processTransaction` updates customer due/store-credit and records payment tx.

## 8.9 Finance shift open/close
1. Finance `startShift` validates no open session.
2. creates open `CashSession` and persists via `saveData`.
3. Finance `closeShift` computes system cash totals from transactions/expenses/delete compensations.
4. updates session with closing balance, difference, totals.
5. persists + refreshes cashbook analytics.

## 8.10 Freight inquiry -> confirmed order
1. FreightBooking `saveInquiry` writes inquiry.
2. user action `convertToConfirmedOrder` calls `convertInquiryToConfirmedOrder(inquiryId)`.
3. storage creates confirmed order snapshot and updates inquiry status/link fields.

## 8.11 Purchase order receipt
1. PurchasePanel selects order and receive-price method.
2. calls `receivePurchaseOrder(orderId, method)`.
3. storage applies line inventory deltas (existing or auto-create product path) and buy-price strategy.
4. updates purchase order status + receipt posting artifacts.

## 8.12 Image upload
1. Product add/update/import provides image value.
2. storage detects data URL needing upload.
3. gets signature from `/api/cloudinary-sign-upload` or Netlify function path.
4. uploads to Cloudinary.
5. replaces product image with cloud URL before persistence.

## 8.13 Import/export flow
- Export:
  - page action -> `ExportModal` -> `services/excel` or PDF generator.
- Import:
  - `UploadImportModal` -> `services/importExcel.import*FromFile` -> validation -> storage write functions -> refresh events.

---

# 9. Active vs Legacy Code Report

## 9.1 Definitely active (routed/imported at runtime)
- All routed pages except `ClassicPOS`.
- `App.tsx`, `index.tsx`, `types.ts`, `services/storage.ts`, `services/auth.ts`, `services/firebase.ts`, `components/ui.tsx`, import/export/pdf helpers.
- Firestore rules/config used in deployment workflows.

## 9.2 Likely active (environment/deployment dependent)
- `netlify/functions/cloudinary-sign-upload.ts` (if deployed on Netlify).
- `api/cloudinary-sign-upload.ts` (if platform routes `/api/*` directly).
- `services/gemini.ts` currently not imported locally; could be intended for future feature toggle.

## 9.3 Legacy but present
- `pages/ClassicPOS.tsx`: full alternate POS implementation, not used by route tree.
- Migration scripts referencing legacy image schemas (`products` collection + stores array products).

## 9.4 Duplicate implementations
- Cloudinary signing exists in two files with near-identical logic (`api/` + `netlify/functions/`).

## 9.5 Compatibility code paths
- storage sync intentionally excludes migrated entities from root writes.
- migration markers for customer product stats backfill strict mode.
- strict online-first guards in cloud write flow.

## 9.6 Archive/remove candidates (evidence-based)
- Candidate: `pages/ClassicPOS.tsx` (not imported or routed).
- Candidate: one of the duplicate Cloudinary handlers after choosing deployment target.
- Keep scripts but move under explicit `ops/legacy-migrations` folder to clarify non-runtime role.

---

# 10. Risk Map by File

| file | why risky | likely bug classes | maintainability pain | split strategy |
|---|---|---|---|---|
| `services/storage.ts` | 4.6k LOC, many domains + infra in one file | data race/order bugs, partial writes, reconciliation drift, event mis-sync | hard to reason/test; merge conflicts | split into `cloudSync`, `products`, `customers`, `transactions`, `finance`, `procurement`, `audit`, `media` modules |
| `pages/Finance.tsx` | 2.9k LOC with analytics + mutation + diagnostics | incorrect totals, filter/report mismatches, session close edge cases | huge render + logic density | extract `financeDerivations.ts`, `financeActions.ts`, `useFinanceData` hooks |
| `pages/Admin.tsx` | 2k LOC, many modal workflows | category/stock inconsistency, batch op mistakes | modal and state explosion | extract `useInventoryAdmin`, separate modal components |
| `pages/Transactions.tsx` | complex edit/delete reconciliation UI | accidental mutation errors, delete compensation mismatches | high cognitive load | extract editor model + delete/update orchestration hooks |
| `pages/Sales.tsx` | checkout + return + customer + shift constraints | wrong settlement, stock overdraw, return entitlement errors | heavy local state and conditional branches | split cart engine, checkout engine, return engine hooks |
| `services/importExcel.ts` | large validator/importer surface | silent data normalization mismatch, partial import defects | difficult to verify across modules | split by entity importer + shared validation core |
| `types.ts` | broad schema surface, additive legacy fields | runtime mismatch and optional-field ambiguity | type drift across modules | split by domain type files and export barrel |
| `pages/FreightBooking.tsx` + `pages/PurchasePanel.tsx` | growing procurement complexity | conversion lineage mismatch, quantity/cost assignment errors | wizard-state complexity | extract procurement domain hook + shared line calculator |

---

# 11. Refactor Blueprint

## Target module decomposition

### `services/cloudSync.ts`
- Move from `storage.ts`:
  - auth online/offline listeners
  - `syncFromCloud`, `syncToCloud`
  - listener subscription lifecycle
  - cloud status emissions
- Reduces pressure from: `storage.ts`.
- Migration order: 1st (foundation).

### `services/events.ts`
- Move event constants and emitter functions:
  - `emitDataOpStatus`, `emitCloudSyncStatus`, `emitLocalStorageUpdate`, event registry.
- Reduces hidden coupling and event name duplication.
- Migration order: 1st/2nd.

### `services/products.ts`
- Move product/category/master functions:
  - `addProduct`, `updateProduct`, `deleteProduct`, category ops, variant/color master ops, barcode generation.
- Depends on: media upload + save adapter.
- Migration order: 2nd.

### `services/customers.ts`
- Move customer/upfront operations:
  - `addCustomer`, `updateCustomer`, `deleteCustomer`, upfront order functions.
- Migration order: 2nd.

### `services/transactions.ts`
- Move transaction engine and previews:
  - settlement/return helper exports
  - `processTransaction`, `updateTransaction`, `deleteTransaction`, preview builders.
- Migration order: 3rd (after products/customers split).

### `services/finance.ts`
- Move canonical balance, cash estimate, KPI snapshot and finance derivation helpers.
- Migration order: 3rd.

### `services/procurement.ts`
- Move freight/confirmed/purchase/party/order/receipt operations.
- Migration order: 2nd/3rd parallel.

### `services/media.ts`
- Move Cloudinary signature/upload logic.
- Decide single endpoint strategy.
- Migration order: 2nd.

### Hooks layer
- `hooks/useProducts.ts`
- `hooks/useTransactions.ts`
- `hooks/useCustomers.ts`
- `hooks/useFinance.ts`
- `hooks/useProcurement.ts`

These hooks should:
- encapsulate `loadData()` + event subscriptions,
- expose typed selectors and action wrappers,
- remove repeated `window.addEventListener('storage'/'local-storage-update')` code from pages.

## Suggested migration sequence

1. **Event + cloud sync extraction** (`events.ts`, `cloudSync.ts`) with no behavior change.
2. **Read-model hooks** to stabilize page interfaces.
3. **Domain split** into products/customers/procurement modules.
4. **Transaction engine isolation** with tests before/after.
5. **Finance derivation extraction** and Finance page simplification.
6. Clean up legacy (ClassicPOS, duplicate handlers) after parity verification.

---

# 12. Rebuild Spec for Another AI

## 12.1 Domain modules to implement

1. **Auth module**
   - Firebase auth email/password
   - verification-required gate
   - user profile bootstrap in `/users/{uid}`
2. **Store data module**
   - root `stores/{uid}` + subcollections for products/customers/transactions/deletedTransactions
   - event-driven local cache refresh
3. **Inventory module**
   - product CRUD with variant/color stock rows
   - category + variant/color master management
4. **POS/Transaction module**
   - sale/return/payment transaction types
   - canonical settlement logic
   - return handling modes (`refund_cash`, `refund_online`, `reduce_due`, `store_credit`)
5. **Customer module**
   - due/store-credit tracking
   - payment posting
   - upfront orders
6. **Finance module**
   - shift open/close with computed system cash
   - expense management and cashbook export
7. **Procurement module**
   - inquiry -> confirmed order -> purchase -> receipt posting
   - lineage fields and optional inventory-linked lines
8. **Media module**
   - Cloudinary signed upload path

## 12.2 Route map to reproduce

- `/` inventory admin
- `/sales` POS
- `/transactions`
- `/customers`
- `/pdf` reports
- `/settings`
- `/finance`
- `/freight-booking`
- `/purchase-panel`
- `/verify-email`

## 12.3 Service boundaries (recommended final shape)

- `auth.ts`
- `cloudSync.ts`
- `events.ts`
- `products.ts`
- `customers.ts`
- `transactions.ts`
- `finance.ts`
- `procurement.ts`
- `media.ts`
- `reporting/excel.ts`, `reporting/pdf.ts`, `import/importExcel.ts`

## 12.4 Critical business rules to preserve

- Verified email required for business data access/writes.
- Owner UID isolation in Firestore rules.
- Split settlement behavior for sale transactions (cash/online/credit).
- Return handling mode impacts due/store credit/cash-out behavior.
- Stock updates must respect product+variant+color bucket identity.
- Shift close uses computed system cash from transactions minus expenses plus compensation logic.
- Procurement conversions keep immutable snapshot lineage references.

## 12.5 Legacy caveats to account for

- Legacy scripts still touch old image schema locations.
- `ClassicPOS` exists as alternate non-routed implementation; avoid reintroducing duplicate POS tracks.
- Dual Cloudinary signing handlers should be unified per deployment target.

## 12.6 Minimal rebuild order

1. Scaffold app shell + auth gate + route skeleton.
2. Implement firebase init + security rules deployment.
3. Implement cloud sync cache + events.
4. Implement inventory + POS + customers transaction engine.
5. Implement finance dashboard/shift close.
6. Implement procurement lifecycle.
7. Add import/export/reporting.
8. Add telemetry and migration scripts.

