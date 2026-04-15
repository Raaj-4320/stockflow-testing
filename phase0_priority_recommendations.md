# Phase 0 — Audit Priority Recommendations

## Top Files to Study First
1. `services/storage.ts`
2. `types.ts`
3. `App.tsx`
4. `pages/Sales.tsx`
5. `pages/Transactions.tsx`
6. `pages/Finance.tsx`
7. `pages/Admin.tsx`
8. `services/importExcel.ts`
9. `services/excel.ts`
10. `firestore.rules`

## Top Domains to Migrate First (after audit)
1. **Auth + tenancy/security boundary**
2. **Cloud sync and data-access abstraction**
3. **Product + customer basic CRUD domains**
4. **Transaction engine (sale/return/payment) with parity tests**
5. **Finance derivation and shift lifecycle**

## Risky Domains to Delay Until Foundation Stable
1. Transaction update/delete reconciliation (high complexity)
2. Finance cashbook diagnostics and correction overlays
3. Procurement lifecycle conversions and receipt logic
4. Bulk import pipelines
5. Report/export exact-format parity

## Suggested Migration Order After Phase 0
1. Freeze baseline + test fixtures + data backups.
2. Define API contracts for auth, products, customers, transactions.
3. Build backend auth/tenant middleware preserving rules semantics.
4. Implement persistence adapters (Firestore-compatible contract first, Mongo adapter second).
5. Migrate product/customer CRUD with UI compatibility wrappers.
6. Migrate transaction create path, then update/delete reconciliation.
7. Migrate finance shift and cashbook calculations.
8. Migrate procurement lifecycle and receive flow.
9. Migrate import/export/media endpoints.
10. Cutover progressively with validation gates and rollback plan.

## Phase-Gate Recommendation
- **Gate A:** Auth + tenancy parity proven.
- **Gate B:** Transaction and stock invariants green.
- **Gate C:** Finance shift close parity green.
- **Gate D:** Procurement lineage parity green.
- **Gate E:** Import/export/media parity green.
