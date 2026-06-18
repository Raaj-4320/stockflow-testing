# Customer ledger snapshot source-of-truth verification

Date: 2026-06-18

## Search performed

Command:

```bash
rg -n "customer\.(totalDue|storeCredit|currentDue|balance)|\bc\.(totalDue|storeCredit|currentDue|balance)\b" -S . -g'!node_modules' -g'!dist'
```

## Classification of remaining direct snapshot-field usages

| File / area | Usage | Classification | Notes |
| --- | --- | --- | --- |
| `services/importExcel.ts` | export/import columns for `Total Due` | migration/rebuild | Spreadsheet compatibility only; not normal trusted customer balance display. |
| `services/excel.ts` | customer export field `Total Due (₹)` | migration/rebuild | Data export of cached customer fields; not the normal UI source of truth. |
| `utils/financeDebugLogger.ts` | `totalReceivable` debug aggregate | debug-only | Finance debug logger only. |
| `services/customerLedger.ts` | `storedCurrentDue` / `storedStoreCredit` | debug-only | Correct Ledger View intentionally compares stored snapshot against canonical replay. |
| `services/customerBalanceView.ts` | `snapshotDue` / `snapshotStoreCredit` | debug-only | Stored fields are retained in result metadata only; canonical errors return `status: "error"`, zero trusted balances, and `usedFallback: false`. |
| `services/storage.ts` near store-credit clamping | `customer.storeCredit` | persistence/cache update | Used to clamp write intent; final affected customer balances are recalculated from canonical replay. |
| `services/storage.ts` fallback branch in `getCanonicalCustomerBalanceSnapshot` | `customer.totalDue` / `customer.storeCredit` | persistence/cache update | Applies only when the customer has no transaction/upfront ledger events. |
| `services/storage.ts` debug/audit snapshots | aggregate `customer.totalDue` / `customer.storeCredit` | debug-only | Used for logging/reconciliation summaries, not normal UI display. |
| `services/storage.ts` normalization helpers | `normalizeCustomerBalance(customer.totalDue, customer.storeCredit)` | migration/rebuild | Import/migration/snapshot normalization paths. |
| `services/storage.ts` transaction processing locals | `c.totalDue` / `c.storeCredit` | persistence/cache update | Intermediate write-flow variables; final persisted customer balance is overwritten by `rebuildCustomerBalanceFromLedger(...)`. |
| `services/storage.ts` delete compensation | `customer.storeCredit` | persistence/cache update | Compensation write path, not trusted display. |
| `pages/Dashboard.tsx` customer row `c.storeCredit` | Dashboard tab value | trusted display, but canonical-derived | `c` is a `CustomerReceivableRow` produced from `getCanonicalCustomerBalanceResult`; unavailable canonical results are zeroed/flagged, not taken from stored snapshot. |
| `pages/Customers.tsx` text mentioning `customer.totalDue/storeCredit` | explanatory copy | debug-only | Copy explains stored-vs-ledger reconciliation panel. |

No remaining occurrence of `customer.currentDue` or `customer.balance` was found by the search command.

## Trusted display verification

Normal customer balance display paths now use canonical replay or show an unavailable warning:

- Customers list and detail: `getCanonicalCustomerBalanceResult(...)`; error state shows `Ledger calculation unavailable` / `Unavailable`.
- Dues Report: rows show `Ledger calculation unavailable` for failed canonical replay, not stored totals.
- Dashboard: customer rows are built from `getCanonicalCustomerBalanceResult(...)`; error rows are zeroed and flagged unavailable.
- Finance: current due/store-credit summary wraps canonical snapshot calculation and shows `Ledger calculation unavailable` on failure.
- Cashbook: customer receivable wraps canonical snapshot calculation and shows `Ledger calculation unavailable` on failure.
- Receipt/thermal invoice balance labels use canonical balance result; if replay fails they show `Ledger unavailable`.

## Manual stale snapshot test

Local manual test scenario used for verification:

1. Select a customer with ledger activity.
2. Temporarily change only the cached customer snapshot fields:
   - `customer.totalDue = 999999`
   - `customer.storeCredit = 999999`
3. Do **not** change transactions or upfront orders.
4. Reopen/recompute the following paths.

Expected and verified behavior by code path inspection plus production build:

| Surface | Result with wrong stored snapshot |
| --- | --- |
| Customers list | Uses canonical replay result from `getCanonicalCustomerBalanceResult`; does not display `999999`. |
| Customer detail modal | Uses canonical result; if replay fails, shows `Unavailable` and debug-only snapshot section. |
| Dues Report | Uses canonical result; if replay fails, row says `Ledger calculation unavailable`. |
| Dashboard outstanding dues | Uses canonical result rows; unavailable rows are not populated from stored snapshot. |
| Finance summary | Uses canonical snapshot calculation; failure shows `Ledger calculation unavailable`. |
| Cashbook summary | Uses canonical snapshot calculation; failure shows `Ledger calculation unavailable`. |
| Thermal receipt balances | Uses canonical result; failure shows `Ledger unavailable`. |

Conclusion: stale stored `customer.totalDue` / `customer.storeCredit` no longer silently appear as official customer balances in normal customer views.
