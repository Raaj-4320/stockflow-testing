# Phase 0 — Critical Flow Validation Matrix

> Confidence is based on static code audit + existing structure (not full runtime QA). Use this as pre-migration validation checklist.

| flow name | pages/functions involved | services involved | current confidence | manual verification required | migration sensitivity | notes |
|---|---|---|---|---|---|---|
| Login | `pages/Auth.handleSubmit` | `services/auth.login`, `services/firebase` | Medium-High | credential success/failure, generic error behavior | High | auth contract boundary |
| Verification flow | `App` auth status + `VerificationRequired` handlers | `services/auth`, firebase auth SDK, rules | Medium | resend and post-verify access gating | High | dual gate: UI + rules |
| Product add/update/delete | Admin handlers | `services/storage` product ops | Medium | variant stock rows, image paths, masters update | High | inventory-critical |
| Category/variant/color operations | Admin handlers | `addCategory`,`renameCategory`,`deleteCategory`,`addVariantMaster`,`addColorMaster` | Medium | rename/delete propagation and edge cases | Medium-High | taxonomy integrity |
| Checkout sale | Sales checkout pipeline | `processTransaction`, settlement helpers | Medium | cash/online/credit due split and stock deduction | High | revenue core |
| Return flow | Sales return modal/workflow | return preview + `processTransaction` | Medium | all return modes and due/store-credit behavior | High | liability-sensitive |
| Transaction edit | Transactions editor save path | `updateTransaction`, audit preview helper | Medium-Low | stock/customer/finance reconciliation diff | High | high-complexity path |
| Transaction delete | Transactions delete confirm path | `getDeleteTransactionPreview`,`deleteTransaction` | Medium-Low | archive record + compensation behavior | High | destructive flow |
| Customer payment collection | Customers payment modal | `processTransaction` payment type | Medium | overpayment/store credit creation behavior | High | customer ledger |
| Upfront order flow | Customers upfront modals | upfront order CRUD functions | Medium | status transition and remaining amount updates | Medium | business-specific |
| Shift open | Finance `startShift` | `saveData` | Medium | no duplicate open session guarantee | High | cash control |
| Shift close | Finance `closeShift` | `getSessionCashTotals`,`saveData` | Medium-Low | closing difference calculations and totals | High | financial audit impact |
| Expense add/remove | Finance expense handlers | `saveData` | Medium | cashbook and P&L impacts | Medium-High | accounting accuracy |
| Freight inquiry create/edit | FreightBooking wizard save | freight CRUD in storage | Medium | line/carton/cbm calculations and persistence | Medium-High | procurement integrity |
| Confirmed-order conversion | FreightBooking convert action | `convertInquiryToConfirmedOrder` | Medium | one-way status and lineage links | High | lineage critical |
| Purchase order create | PurchasePanel save order | `createPurchaseOrder` | Medium | line totals and party linkage | Medium-High | procurement pipeline |
| Purchase receive | PurchasePanel receive modal | `receivePurchaseOrder` | Medium-Low | stock deltas + buy price method outcomes | High | inventory valuation |
| Import inventory | Admin import modal | `importInventoryFromFile` | Medium | template compatibility and row validation | High | bulk mutation risk |
| Import transactions | Transactions import modal | `importHistoricalTransactionsFromFile` / `importTransactionsFromFile` | Medium-Low | idempotency and settlement normalization | High | historical ledger risk |
| Export excel/pdf | export modals across pages | excel/pdf services | High | sample output checks only | Medium | external reporting contracts |
| Image upload | Admin + import paths | storage media helpers + Cloudinary handler | Medium | endpoint routing, signature validity, URL persistence | High | media reliability |

## Recommended Manual Validation Sequence
1. Auth + verification gate
2. Sale/return/transaction update/delete
3. Finance shift open/close and cashbook totals
4. Inventory + purchase receive stock consistency
5. Import transaction and import inventory dry-runs
6. Reporting exports and image upload regression
