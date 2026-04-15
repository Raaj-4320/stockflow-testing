# Refactor Blueprint

## Objectives
- Reduce coupling and blast radius of `services/storage.ts`
- Move domain logic out of oversized page components
- Standardize data refresh patterns
- Improve testability of transaction and finance logic

## Proposed Target Modules

| target module | responsibilities to move | extract from | key dependencies | migration difficulty |
|---|---|---|---|---|
| `services/cloudSync.ts` | auth state sync hooks, snapshot listeners, online/offline handling, hydration flags | `services/storage.ts` | firebase auth/firestore, events | High |
| `services/events.ts` | event constants and emitters (`data-op-status`, `cloud-sync-status`, `local-storage-update`) | `services/storage.ts` | window events | Medium |
| `services/products.ts` | product CRUD, category/variant/color masters, barcode generation | `services/storage.ts`, `pages/Admin.tsx` | firestore writes, productVariants, media upload | High |
| `services/customers.ts` | customer CRUD, upfront orders, canonical customer balances | `services/storage.ts`, `pages/Customers.tsx` | transactions helpers | Medium |
| `services/transactions.ts` | transaction create/update/delete, reconciliation previews, settlement rules | `services/storage.ts`, `pages/Sales.tsx`, `pages/Transactions.tsx` | products/customers modules, finance helpers | High |
| `services/finance.ts` | cashbook derivations, KPI snapshots, session totals, due/store-credit rollups | `services/storage.ts`, `pages/Finance.tsx` | transactions module | High |
| `services/procurement.ts` | freight inquiry/confirmed/purchase/receipt workflows | `services/storage.ts`, `pages/FreightBooking.tsx`, `pages/PurchasePanel.tsx` | products module | Medium-High |
| `services/media.ts` | Cloudinary signature + upload orchestration | `services/storage.ts`, API handlers | fetch/crypto/serverless path | Medium |
| `hooks/useStoreData.ts` | common `loadData + event subscribe` pattern | page files | events + selectors | Medium |
| `hooks/useTransactions.ts` | transaction list/query/edit state wrappers | `pages/Transactions.tsx`, `pages/Sales.tsx` | transactions service | Medium |
| `hooks/useFinance.ts` | finance tab state and actions wrappers | `pages/Finance.tsx` | finance service | Medium |

## Recommended Migration Order

1. **Create `events.ts`** (low-risk extraction, no behavior change).
2. **Extract `cloudSync.ts`** and keep current storage API as facade.
3. **Introduce read hooks** (`useStoreData`) and migrate one page at a time.
4. **Extract products + customers modules** (lower risk than transactions).
5. **Extract transactions module** with regression tests for sale/return/payment rules.
6. **Extract finance derivation module** and simplify `pages/Finance.tsx`.
7. **Extract procurement module** and unify line calculators.
8. **Move media upload logic** and consolidate single Cloudinary handler target.
9. **Archive legacy** (`ClassicPOS`) and finalize API/handler deduplication.

## Validation Strategy
- Add unit tests for pure derivation functions first.
- Add integration tests around `processTransaction`, `deleteTransaction`, `updateTransaction`, and `receivePurchaseOrder`.
- Run side-by-side snapshot checks before and after modular extraction for known fixtures.

## Expected Outcomes
- Smaller, testable services with clear boundaries.
- Thinner page components focused on view/state wiring.
- Lower risk of cross-domain regressions.
- Better onboarding and machine-assisted maintainability.
