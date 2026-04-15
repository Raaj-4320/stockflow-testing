# Phase 0 — Do Not Break List

These behaviors are mandatory invariants for migration.

| behavior | why critical | where enforced today | how to validate later |
|---|---|---|---|
| Stock consistency per product/variant/color | inventory and fulfillment correctness | `services/storage.ts` transaction paths + `productVariants` + `stockBuckets` | replay sale/return/update/delete fixtures and verify stock buckets |
| Sale settlement correctness (cash/online/credit due) | finance, receipt, and customer due accuracy | `getSaleSettlementBreakdown`, Sales + Finance flows | compare settlement matrix outputs for sample transactions |
| Customer due/store credit correctness | customer trust and receivable tracking | canonical balance helpers + transaction engine | customer ledger regression suite + manual ledger audit |
| Return handling mode effects | cash liability and due/store-credit impact | return allocation helpers + Sales/Transactions | mode-by-mode scenario tests (`refund_cash`,`refund_online`,`reduce_due`,`store_credit`) |
| Transaction update reconciliation | prevents hidden ledger/stock corruption | `updateTransaction`, audit preview helpers | before/after snapshots for edited historical transactions |
| Transaction delete archive and compensation | auditability and cashbook consistency | `deleteTransaction`, deleted records, compensation records | delete-flow tests including bin and compensation totals |
| Shift open/close integrity | daily cash closure and discrepancy reporting | Finance `startShift`/`closeShift` + cash total calculators | close-shift golden fixture and discrepancy checks |
| Expense effect on cashbook and profit | financial reporting accuracy | Finance expense handlers + rollups | P&L regression comparison with controlled fixture |
| Procurement lineage (inquiry -> confirmed -> purchase -> receipt) | traceability and operational continuity | procurement functions in `services/storage.ts` + pages | end-to-end lifecycle integration test |
| Purchase receive stock and buy-price method | inventory valuation correctness | `receivePurchaseOrder`, `applyPurchaseLineToProduct` | method-by-method receiving scenarios |
| Import validation and mutation safety | bulk data integrity | `services/importExcel.ts` + storage writes | dry-run and malformed file tests |
| Export compatibility (Excel/PDF) | external reporting continuity | `services/excel.ts`, `services/pdf.ts`, Reports page | golden file diff of exports |
| Auth verification and owner isolation | security/compliance | `App` guard + `services/auth` + `firestore.rules` | authz tests for unverified and cross-tenant access |
| Store initialization behavior | first-login operability | `ensureStoreInitializedForCurrentUser` | tenant bootstrap test |
| Image upload persistence | media reliability and UX | Cloudinary sign/upload path in storage + handlers | signed upload integration test with sample images |

## Enforcement Priority
1. Transaction/stock/customer ledger invariants
2. Finance shift and cashbook invariants
3. Procurement lineage and receive logic
4. Auth/security invariants
5. Import/export and media integration
