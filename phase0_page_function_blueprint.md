# Phase 0 — Page Function Blueprint

> Scope: active pages in routing/auth shell. Focus on major functions (handlers, calculators, refreshers, listeners).

## 1) `pages/Admin.tsx`

| function | type | purpose | inputs | outputs | local state read/write | services called | downstream effects | connected UI | risks/notes |
|---|---|---|---|---|---|---|---|---|---|
| `refreshData` | data refresh function | hydrate products/categories/profile/masters | none | void | writes products/categories/storeName/masters | `loadData` | page refresh | all inventory views | must remain idempotent |
| `saveProduct` | API trigger | create or update product | form payload | Promise<void> | reads formData/editingProduct; writes list/state | `addProduct`,`updateProduct` | persists product + emits refresh events | product modal | validation spread between UI+service |
| `handleAddPurchase` | UI handler | apply purchase stock increment/history | purchase fields | Promise<void> | reads purchase modal fields; writes product state/modal | `updateProduct` | updates stock/buy price/history | purchase modal | finance impact if migrated wrong |
| `handleDelete` | UI handler | delete product | id | Promise<void> | updates selected products | `deleteProduct` | remove product | product list row action | destructive path requires confirmation parity |
| `handleAddCategory`/`handleDeleteCategory`/`handleSaveRenameCategory` | modal handler | manage category catalog | category names | void/Promise | reads category modal state | `addCategory`,`deleteCategory`,`renameCategory` | category list changed; product relabeling side effects | category modal | rename/delete touches product associations |
| `handleBatchEditProducts`/`handleBatchDeleteProducts` | UI handler | multi-product operations | selected ids | void/Promise | reads selection arrays | storage CRUD functions | bulk changes | list toolbar | high operator-error risk |
| `handleExport` | UI handler | dispatch report export path | export type + format | void | reads products/filters | `exportProductsToExcel` + PDF builders | downloads file | export modal | ensure parity after migration |

## 2) `pages/Sales.tsx`

| function | type | purpose | inputs | outputs | local state read/write | services called | downstream effects | connected UI | risks/notes |
|---|---|---|---|---|---|---|---|---|---|
| `refreshData` | data refresh function | hydrate products/customers/transactions | none | void | writes data lists | `loadData` | sync UI with store state | page init/listeners | race with async sync possible |
| `addToCart`,`updateQuantity`,`setManualQuantity` | UI handler | manage cart lines | product/line ids, qty | void | reads/writes cart and errors | local + variant helpers | cart totals update | cart panel/product cards | stock guard parity critical |
| `getReturnableQty`,`getProductReturnableQty` | derived calculator | compute return eligibility | product/variant/customer | numbers | reads transactions | local helper logic | controls return limits | return popup + product badges | migration must preserve logic |
| `initiateCheckout` | UI handler | validate before processing | current cart/payment/customer | void | reads checkout state; sets errors/modal | local validation + shift checks | gate to commit | checkout modal | high business impact |
| `completeCheckout` | API trigger | build transaction and persist | transaction inputs | Promise<void> | reads cart/customer/payment | `processTransaction` | stock/customer/tx mutation | checkout submit | core revenue path |
| `handleDataOpStatus` | event listener | correlate op status to pending checkout | event detail | void | reads/writes pending refs, completion states | listens `data-op-status` | success/error UX | completion modal | event ordering sensitivity |
| `handlePrintReceipt`,`handleExport` | UI handler | PDF/Excel invoice output | format choice | void | reads completed tx | `generateReceiptPDF`,`exportInvoiceToExcel` | downloads/print | completion modal | output parity needed |
| `createReturnFromSelectedTransaction` | API trigger | create canonical return tx from sale | selected tx + mode | Promise<void> | reads return modal state | `getCanonicalReturnPreviewForDraft`,`processTransaction` | adds return tx, adjusts stock/due | return popup | reconciliation-sensitive |

## 3) `pages/Transactions.tsx`

| function | type | purpose | inputs | outputs | local state read/write | services called | downstream effects | connected UI | risks/notes |
|---|---|---|---|---|---|---|---|---|---|
| `refreshData` | data refresh function | hydrate transactions/customers/products/bin | none | void | writes local lists | `loadData` | page refresh | list/bin views | baseline loader |
| `openTransactionEditor`,`closeTransactionEditor` | modal handler | control editor lifecycle | tx | void | writes edit states | none | open/close edit modal | edit modal | state reset correctness |
| `getEditedSubtotal`,`getEditedDiscount`,`getEditedTax`,`getEditedTotal` | derived calculator | compute edited totals | editing items/tax | numbers | reads edit state | local logic | preview totals | edit modal summary | parity with service reconciliation |
| `handleSaveTransaction` | API trigger | persist edited transaction | edited tx | Promise<void> | reads edit states; writes load/error | `updateTransaction` | reconciliation writes + audit | edit modal save | high-risk correctness path |
| `openDeleteModal`,`handleConfirmDelete` | modal handler/API trigger | delete tx with reason | tx id + reason | Promise<void> | reads delete modal state | `getDeleteTransactionPreview`,`deleteTransaction` | delete archive + compensation effects | delete modal | destructive financial impact |
| `handleRunExcelExport`,`handleDownloadPDF`,`handleExport` | UI handler | export operations | filters/tx | void | reads filters | `exportTransactionsToExcel`,`exportInvoiceToExcel`, PDF utilities | file output | export UI | audit/report parity |

## 4) `pages/Customers.tsx`

| function | type | purpose | inputs | outputs | state read/write | services called | effects | UI | risks |
|---|---|---|---|---|---|---|---|---|---|
| `refreshData` | data refresh function | load customers/transactions/upfront | none | void | writes lists/viewing customer | `loadData` | refresh | page init | must keep canonical snapshot in sync |
| `handleAddCustomerSubmit` | API trigger | create customer | form values | void | writes errors/list | `addCustomer` | customer added | add modal | identity collision checks |
| `handleSaveCustomerEdit` | API trigger | update customer profile | form values | void | writes editing state | `updateCustomer` | customer updated | edit modal | batch edit progression logic |
| `handleDeleteCustomer` | API trigger | remove customer | id | void | writes modal state | `deleteCustomer` | customer removed | delete modal | orphan references risk |
| `handleRecordPayment` | API trigger | collect due payment | amount/method | Promise<void> | reads payment form | `processTransaction` | payment transaction + due update | payment modal | finance-critical |
| `handleSaveUpfrontOrder`,`handleCollectUpfrontPayment` | API trigger | manage upfront orders | order fields | Promise<void> | writes upfront state | `addUpfrontOrder`,`updateUpfrontOrder`,`collectUpfrontPayment` | upfront ledger updates | upfront modals | order status consistency |
| `handleExport` | UI handler | customer/statement export | type/format | void | reads selected customer/tx | excel/pdf services | outputs files | export modal | reporting parity |

## 5) `pages/Reports.tsx`

| function | type | purpose | inputs | outputs | services | downstream |
|---|---|---|---|---|---|---|
| `refreshData` | data refresh function | load products/transactions | none | void | `loadData` | keeps reports current |
| `generatePDF` | helper/UI handler | build internal/customer catalog PDF | report type | Promise<void> | local + jsPDF | download PDF |
| `handleExport` | UI handler | dispatch format export | format/type | void | `exportProductsToExcel`,`exportDetailedSalesToExcel` | file output |

## 6) `pages/Settings.tsx`

| function | type | purpose | inputs | outputs | services called | risks |
|---|---|---|---|---|---|---|
| `refreshData` | data refresh function | load store profile and current user | none | void | `loadData`,`getCurrentUser` | stale profile if listeners fail |
| `handleSave` | API trigger | persist profile updates | profile state | void | `updateStoreProfile` | admin PIN preservation behavior must match |
| `handleTaxChange` | UI handler | map label to tax value | select event | void | local `TAX_OPTIONS` | label/value mismatch risk |
| `handleSignatureUpload` | helper | convert image to resized data URL | file input event | void | canvas APIs | image format/size parity |

## 7) `pages/Finance.tsx`

| function | type | purpose | services | notes |
|---|---|---|---|---|
| `refreshData` | data refresh function | load canonical app state and clear errors | `loadData` | core Finance refresh point |
| `getSessionCashTotals` | derived calculator | compute cash/expense totals for session window | storage helpers + local logic | crucial for shift close correctness |
| `exportCashbookCsv`,`exportCashbookWorkbook` | UI handler | export filtered cashbook diagnostics | xlsx/local utils | output parity sensitive |
| `startShift` | API trigger | create open cash session | `saveData` | blocks if existing open shift |
| `closeShift` | API trigger | close active session with totals/difference | `saveData` + finance derivations | high business risk path |
| `handleManagerUnlock` | modal handler | verify manager PIN before opening edit | local + profile pin | security-sensitive but client-side only |
| `saveOpeningBalanceEdit` | API trigger | update opening balance of open shift | `saveData` | affects all downstream cashbook numbers |
| `addExpense`,`removeExpense`,`addExpenseCategory`,`deleteExpenseCategory` | API trigger | expense/category ledger maintenance | `saveData` | impacts P&L and cash totals |
| `collectPayment` | API trigger | collect customer payment from finance tab | `processTransaction` | cross-domain customer due effect |

## 8) `pages/FreightBooking.tsx`

| function | type | purpose | services | risks |
|---|---|---|---|---|
| `refresh` | data refresh function | load products/inquiries/confirmed orders/brokers | `loadData`,`getFreight*` | stale workflow state risk |
| `openNewInquiry`,`openEditInquiry`,`resetWizard` | modal/wizard handlers | manage workflow state transitions | local | wizard-state complexity |
| `updatePricingEntry`,`updateAssignment`,`updateCartonCbm` | derived calculator/UI handler | line/carton/cbm calculations | local helpers | numeric consistency |
| `createBroker`,`createBrokerQuick`,`addCategoryQuick` | API trigger | quick master-data creation | `createFreightBroker`,`addCategory` | taxonomy drift risk |
| `saveInquiry` | API trigger | create/update inquiry | `createFreightInquiry`,`updateFreightInquiry` | lifecycle integrity |
| `convertToConfirmedOrder` | API trigger | convert inquiry to confirmed order | `convertInquiryToConfirmedOrder` | lineage-critical transition |

## 9) `pages/PurchasePanel.tsx`

| function | type | purpose | services | risks |
|---|---|---|---|---|
| `refresh` | data refresh function | load products/orders/parties | `loadData`,`getPurchaseOrders`,`getPurchaseParties` | stale receiving decisions |
| `openCreateOrder`,`resetWizard` | modal/wizard handlers | order creation workflow state | local | workflow drift |
| `updatePricingEntry` | helper | update line draft quantity/cost | local | amount calc integrity |
| `saveParty` | API trigger | create supplier party | `createPurchaseParty` | data quality |
| `saveOrder` | API trigger | create purchase order | `createPurchaseOrder` | receiving dependencies |
| `confirmReceiveOrder` | API trigger | apply receive and price method | `receivePurchaseOrder` | stock/cost correctness-critical |

## 10) `pages/Auth.tsx`

| function | type | purpose | services |
|---|---|---|---|
| `handleSubmit` | API trigger | login/register/reset action router | `login`,`register`,`resetPassword` |
| `handleResendVerification` | API trigger | resend verification email | `resendVerificationEmail` |

## 11) `pages/VerificationRequired.tsx`

| function | type | purpose | services |
|---|---|---|---|
| `handleResend` | API trigger | resend auth verification mail | firebase auth SDK |
| `handleBackToLogin` | UI handler | signout and reset flow | firebase auth SDK |

## Uncertainty Notes
- Some internal helper outputs are inferred from names and usage context where explicit types are loosely enforced in component code.
- For exhaustive line-level side effect mapping, pair this file with `function-inventory.csv` and `phase0_service_function_blueprint.md`.
