# Phase 0 — Service Function Blueprint

> Priority order preserved as requested. For breadth, this blueprint groups related helper clusters and key exported functions. Use with `function-inventory.csv` for full symbol scan.

## 1) `services/storage.ts` (highest priority)

### 1.1 Domain Role
Central state/domain orchestration layer handling:
- Firestore synchronization
- transaction engine/reconciliation
- product/customer/procurement CRUD
- finance calculations and diagnostics support
- image upload orchestration
- event emission for UI synchronization

### 1.2 Core Internal Runtime Helpers

| function/helper | domain | purpose | sync/async | side effects | reads | writes | Firestore paths | events | callers/modules | risk notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `emitDataOpStatus` | events | operation lifecycle broadcast | sync | dispatch `CustomEvent` | op detail | browser event bus | none | emits `data-op-status` | storage operations | event contract stability critical |
| `emitCloudSyncStatus` | events | cloud connectivity status broadcast | sync | dispatch `CustomEvent` | status/message | cloud status var + event | none | emits `cloud-sync-status` | sync/auth/network handlers | UI dependency on status names |
| `emitLocalStorageUpdate` | events | same-tab refresh trigger | sync | dispatch `Event` | none | event bus | none | emits `local-storage-update` | all mutating flows | high fan-out refresh trigger |
| `writeAuditEvent` | audit | write audit telemetry | async | Firestore addDoc | auth user, payload | audit doc | `stores/{uid}/auditEvents` | none | guard blocks, save/tx flows | best-effort logging only |
| `assertCloudWriteReady` | guard | gate writes on auth/verification/network/hydration/store existence | async | may audit blocked writes | auth/network flags | throws on violation | audit writes only | may emit cloud status offline | write operations | migration must preserve safety gating |
| `syncFromCloud` | sync | subscribe and hydrate state from Firestore | async | snapshot subscriptions and state mutation | auth user + firestore docs | memoryState and sync flags | root + subcollections | emits cloud/local events | `loadData`, auth/online handlers | ordering/race complexity |
| `syncToCloud` | sync | persist root state (excluding migrated entities) | async | setDoc merge | memoryState snapshot | root doc | `stores/{uid}` | none | `saveData` | root payload omissions are intentional |
| `saveData` | persistence | guarded persistence orchestrator | async | cloud writes + event emission + audit | previous/current state | memoryState + cloud + events | root store + audit | data-op/local events | many exported mutators | destructive-write guard sensitivity |
| `getCloudinarySignature` | media | fetch signed upload payload | async | network fetch | env endpoint assumptions | none | none | none | image upload path | deployment endpoint ambiguity |
| `uploadDataUrlToCloudinary` | media | upload base64 image | async | network upload | data URL | cloudinary URL | none | none | product create/update/import | failure blocks product save |
| `uploadProductImageIfNeeded` | media | normalize product image field before save | async | possible upload | product.image | transformed product | none | none | add/update product | migration parity critical |

### 1.3 Major Exported Helper Functions (finance/transaction semantics)

| export | domain | purpose | inputs | outputs | side effects | callers | risk |
|---|---|---|---|---|---|---|---|
| `clampCreditDueAmount` | finance | normalize credit due with threshold | number | number | no | Sales/Transactions/import logic | low-level correctness primitive |
| `getResolvedReturnHandlingMode` | returns | canonical return mode selection | transaction | mode enum | no | Sales/Transactions/excel | affects refund behavior |
| `getSaleSettlementBreakdown` | finance | derive cash/online/credit split | transaction | breakdown object | no | Sales/Transactions/excel/finance | financial correctness critical |
| `getReturnCashRefundAmount` | returns | compute cash refund effect | transaction + historical tx | number | no | finance/excel/transaction logic | sensitive to history ordering |
| `getCanonicalReturnAllocation` | returns | canonical return allocation by mode/due context | tx,history,currentDue | allocation object | no | Sales/Customers/excel/finance | high migration sensitivity |
| `getCanonicalReturnPreviewForDraft` | returns | preview return effect before commit | draft/customers/tx | preview object | no | Sales/Transactions | user decision support |
| `getCanonicalCustomerBalanceSnapshot` | finance/customer | recompute due/store credit map | customers,transactions | snapshot | no | Customers/Finance | mismatch risk if rule drift |
| `getTransactionUpdateAuditPreview` | audit | compute update diff summary | original+updated tx context | preview object | no | Transactions | update correctness guardrail |
| `getDeleteTransactionPreview` | audit | pre-delete impact summary | transaction id | preview/null | no | Transactions | destructive flow safety |

### 1.4 Major Exported Mutations

#### Product + category/master domain
- `addProduct`, `updateProduct`, `deleteProduct`
- `addVariantMaster`, `addColorMaster`
- `addCategory`, `deleteCategory`, `renameCategory`

#### Customer + upfront domain
- `addCustomer`, `updateCustomer`, `deleteCustomer`
- `addUpfrontOrder`, `updateUpfrontOrder`, `collectUpfrontPayment`

#### Procurement domain
- Freight: `getFreightInquiries`, `getFreightInquiryById`, `createFreightInquiry`, `updateFreightInquiry`, `convertInquiryToConfirmedOrder`, `softDeleteFreightInquiry`
- Confirmed/Purchase: `getFreightConfirmedOrders`, `createFreightConfirmedOrder`, `updateFreightConfirmedOrder`, `getFreightPurchases`, `createFreightPurchase`, `updateFreightPurchase`, `convertConfirmedOrderToPurchase`
- Parties/Orders/Receipt: `getPurchaseParties`, `createPurchaseParty`, `updatePurchaseParty`, `getPurchaseOrders`, `createPurchaseOrder`, `updatePurchaseOrder`, `receivePurchaseOrder`, `createPurchaseReceiptPosting`

#### Transaction lifecycle domain
- `processTransaction`
- `addHistoricalTransactions`
- `deleteTransaction`
- `updateTransaction`

### 1.5 Firestore Paths Touched (storage.ts)
- Root: `stores/{uid}`
- Subcollections:
  - `stores/{uid}/products`
  - `stores/{uid}/customers`
  - `stores/{uid}/transactions`
  - `stores/{uid}/deletedTransactions`
  - `stores/{uid}/operationCommits`
  - `stores/{uid}/auditEvents`
  - `stores/{uid}/customerProductStats`

### 1.6 Browser Events in storage.ts
- Emits: `data-op-status`, `cloud-sync-status`, `local-storage-update`, `app-state-change`
- Listens: browser `online`, `offline` and auth state changes

### 1.7 Primary Connected Modules
- Pages: Admin, Sales, Transactions, Customers, Reports, Settings, Finance, FreightBooking, PurchasePanel
- Services: excel, importExcel, pdf

### 1.8 Highest Risks
1. Multi-domain coupling and side-effect concentration.
2. Event-driven synchronization race potential.
3. Transaction reconciliation correctness if logic is split incorrectly.
4. Subcollection/root write contract must remain intact.

---

## 2) `services/importExcel.ts`

| function group | purpose | sync/async | side effects | reads/writes | callers | risk notes |
|---|---|---|---|---|---|---|
| template downloaders (`download*Template`) | generate guided import templates | sync | writes files | reads static fields | Admin/Customers/Transactions/PurchasePanel | schema drift with app model |
| data downloaders (`download*Data`) | export current data into import-ready shape | sync | writes files | reads from `loadData()` | same pages | compatibility expectation |
| importers (`importInventoryFromFile`, etc.) | validate + persist imported rows | async | storage mutations | reads XLSX rows, writes via storage functions | same pages/modal | high correctness risk |
| helpers (`buildCanonicalImportedSaleSettlement`, mode validators, image value resolver) | normalize imported financials/image inputs | sync/async mix | may fetch image URL | import row transformations | importers | critical for historical data parity |

Connected services called:
- `addProduct`,`updateProduct`,`addCustomer`,`updateCustomer`,`processTransaction`,`addHistoricalTransactions`,`createPurchaseOrder`,`updatePurchaseOrder`,`addCategory`,`loadData`

---

## 3) `services/excel.ts`

| export | purpose | async | side effects | reads | writes | callers |
|---|---|---|---|---|---|---|
| `exportProductsToExcel` | inventory export | no | file download | products input | xlsx file | Admin/Reports |
| `exportTransactionsToExcel` | transactions ledger export | no | file download | tx input + `loadData` customers + storage finance helpers | xlsx file | Transactions |
| `exportDetailedSalesToExcel` | detailed sales analytics export | no | file download | tx input | xlsx file | Reports |
| `exportCustomersToExcel` | customer summary export | no | file download | customer+tx inputs | xlsx file | Customers |
| `exportInvoiceToExcel` | invoice export | no | file download | transaction input | xlsx file | Sales/Transactions/Customers |
| `exportCustomerStatementToExcel` | customer statement export | no | file download | customer + tx set | xlsx file | Customers |

Risk: finance derivation coupling with storage helper semantics.

---

## 4) `services/pdf.ts`

| export | purpose | async | side effects | reads | writes | callers | risk |
|---|---|---|---|---|---|---|---|
| `generateReceiptPDF` | invoice generation dispatcher (standard vs thermal) | no | file save / print trigger | transaction/customers/profile | pdf output | Sales/Transactions/Customers | formatting and totals parity |
| `printThermalInvoice` | thermal print document in popup | no | window open + print | same | print output | `generateReceiptPDF` | browser print behavior differences |

---

## 5) `services/auth.ts`

| export | purpose | async | side effects | Firestore path | callers | risk |
|---|---|---|---|---|---|---|
| `getCurrentUser` | current email accessor | no | none | none | App/Settings | low |
| `login` | auth login + verified gate + user doc bootstrap | yes | sign-in/sign-out | `users/{uid}` read/create | Auth page | auth flow critical |
| `register` | create user + profile + send verification + signout | yes | auth + email verification | `users/{uid}` create | Auth page | onboarding parity |
| `resetPassword` | send reset email (generic response) | yes | auth mail send | none | Auth page | messaging consistency |
| `resendVerificationEmail` | resend verification by temporary login | yes | auth state churn | none | Auth page | UX cooldown logic in page |
| `logout` | signout + hard reload | yes | page reload | none | App/Settings | abrupt reload side effects |

---

## 6) `services/productVariants.ts`

Exports: `NO_VARIANT`, `NO_COLOR`, `normalizeVariant`, `normalizeColor`, `productHasCombinationStock`, `getProductStockRows`, `getAvailableStockForCombination`, `formatProductVariantColor`, `formatItemNameWithVariant`, `getResolvedSellPriceForCombination`, `getResolvedBuyPriceForCombination`.

- Domain: variant/color identity and safe stock/price resolution.
- Side effects: none (pure helpers).
- Callers: Admin, Sales, Transactions, Reports, Customers, FreightBooking, PurchasePanel, excel/pdf/stockBuckets.
- Risk: tiny utility but high impact on stock correctness and display consistency.

---

## 7) `services/stockBuckets.ts`

Exports: key normalization and aggregation helpers.
- Domain: inventory bucket identity (`productId + variant + color`).
- Side effects: none.
- Callers: Sales and storage transaction logic.
- Risk: key changes will break stock deduction/reconciliation symmetry.

---

## 8) `services/firebase.ts`

- Purpose: initialize Firebase app/db/auth from env.
- Side effects: initialization attempt at module load.
- Exports: `app`, `db`, `auth`.
- Callers: App, auth service, storage service, verification page.
- Risk: env mismatch leads to null service behavior fallback.

---

## 9) `services/behaviorLogger.ts`

- Core responsibilities:
  - capture UI actions and state changes
  - intercept `fetch` and XHR
  - record app errors/unhandled rejections
  - provide summary/export API on `window`
- Emits/listens:
  - emits `app-user-action`, `app-state-change`
  - listens those plus `data-op-status`, click/submit/hash/error events
- Risk: global monkey-patch behavior and implicit telemetry side effects.

---

## 10) `services/financeLogger.ts`

- Exports `financeLog` helper with categorized console logging (`tx`, `cash`, `ledger`, etc.).
- `load` channel enabled conditionally by env (`VITE_FINANCE_LOAD_LOGS`).
- Risk: low functional risk, but can hide diagnostic signals if disabled.

---

## Uncertainty Flags
- Some internal helper input/output schemas are inferred where code uses broad `any` payloads.
- Firestore write details for deeply nested helpers should be cross-checked line-by-line before migrating transaction engine.
