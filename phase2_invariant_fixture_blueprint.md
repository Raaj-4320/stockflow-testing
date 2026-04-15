# Phase 2A — Invariant Fixture Blueprint

## Purpose
Define deterministic fixture sets that protect Phase 0 do-not-break invariants and gate Phase 2B+ domain implementation.

## Fixture Set Matrix

| Fixture Set | What It Proves | Source Rules | Recommended Inputs | Expected Outputs | Run Timing | Depends / Used By |
|---|---|---|---|---|---|---|
| `stock_bucket_identity_v1` | Variant/color bucket keys map consistently and stock deltas hit correct bucket | stock bucket identity invariants | product with multi variant+color, mixed sale/return lines | exact bucket-level before/after stock deltas | pre-merge + nightly | products, transactions, procurement |
| `settlement_matrix_v1` | canonical settlement split for cash/online/credit permutations | sale settlement invariants | totals, discounts, tax, payment methods, store-credit usage combinations | deterministic `cashPaid/onlinePaid/creditDue` matrix | pre-merge for tx endpoints | transactions, finance, reports |
| `due_credit_balance_v1` | due/store-credit updates stay consistent across sale/payment/return | due/store-credit invariants | customer opening due/credit, ordered tx sequence | final due/credit snapshots match golden ledger | pre-merge + regression | customers, transactions, finance |
| `return_modes_v1` | each return handling mode effect is correct | return mode invariants | original sale + varied return mode scenarios | expected cash refund / online refund / due reduction / store-credit outcomes | pre-merge for return paths | transactions, customers, finance |
| `tx_update_reconciliation_v1` | edit of historical transaction reconciles stock and ledger correctly | update reconciliation invariants | original tx + edited tx pairs with different items/payments | before/after stock + ledger deltas match preview expectations | pre-merge before enabling update API | transactions, audit |
| `tx_delete_compensation_v1` | delete flow archives correctly and handles compensation | delete invariants | deletable tx samples with compensation modes | archive snapshot + optional compensation records + cashbook effects | pre-merge before delete API | transactions, finance, audit |
| `shift_open_close_v1` | one open shift rule and close calculations parity | shift invariants | opening balance, tx/expense windows, closing counts | close status + system cash + discrepancy calculations | pre-merge + end-to-end | finance |
| `cashbook_rollup_v1` | cashbook totals/profit rollups remain deterministic | finance invariants | fixture day/week with tx/expenses/deletes | exact rollup outputs and category totals | pre-merge for finance reporting | finance, reports |
| `procurement_lineage_v1` | inquiry->confirmed->purchase->receipt lineage immutability | procurement lineage invariants | linked records with conversion transitions | immutable lineage IDs preserved and transitions valid | pre-merge before procurement mutations | procurement, audit |
| `purchase_receive_effects_v1` | receive updates stock and buy-cost strategy correctly | receive stock/cost invariants | purchase lines with multiple receive methods | expected stock increments + cost updates per method | pre-merge before receive endpoint | procurement, products, finance |
| `import_validation_edges_v1` | malformed bulk input is rejected safely and valid rows normalized | import safety invariants | malformed headers/types/duplicates + valid mixed files | deterministic reject reasons + accepted normalized records | pre-merge for imports | imports, products, transactions |
| `export_shape_contracts_v1` | export payload shape/version compatibility remains stable | export compatibility invariants | report filter sets for key exports | stable schema/column ordering/version markers | nightly + release | reports, frontend |

## Fixture Storage Strategy
```text
tests/fixtures/invariants/
  stock/
  settlement/
  ledger/
  transactions/
  finance/
  procurement/
  imports/
  exports/
```

## Assertion Strategy
- Prefer snapshot + explicit numeric assertions.
- Include tolerance policy only where rounding is intentionally defined.
- Every fixture maps to a named invariant in Phase 0 do-not-break list.

## Run Cadence
1. Contract and pure-calculator fixtures: each PR.
2. Domain-integrated fixtures: PRs touching domain module.
3. Full invariant suite: nightly and pre-release.

## Ownership
- Transactions lead: settlement, returns, update/delete fixtures.
- Finance lead: shift/cashbook fixtures.
- Procurement lead: lineage and receive fixtures.
- Platform lead: fixture harness, CI gating.
