# Phase 2A — Domain Implementation Start Order

## Strict Implementation Order After Foundation

| Order | Domain/Area | Why This Order | Dependencies | Must Be Proven First | Should Not Start Yet |
|---|---|---|---|---|---|
| 1 | Auth/Tenancy | all other domains depend on trusted identity + store scope | config, guards, request context | Auth/Tenant Gate (G1) | any tenant data mutation domain |
| 2 | Products (baseline CRUD + stock bucket utilities) | lower risk than transactions; needed by sales/procurement | G1 + G2 + Mongo foundation | Contract lock + stock bucket fixtures defined | procurement receive logic |
| 3 | Customers (profile + ledger read model) | needed before tx effects on due/credit | products baseline, G2 | due/store-credit fixture definitions | mutation-heavy ledger adjustments |
| 4 | Transaction Create Path | central revenue flow; unlocks realistic parity testing | products + customers + idempotency + fixtures | G3 + transaction create fixtures green | update/delete reconciliation |
| 5 | Transaction Update/Delete Reconciliation | highest complexity and drift risk | create path + audit + fixture harness | reconciliation fixtures + delete compensation fixtures | finance/procurement dependent features |
| 6 | Finance | depends on trustworthy transaction lifecycle | tx create/update/delete parity | shift/cashbook fixtures green | correction overlays beyond baseline |
| 7 | Procurement | depends on products/finance and lineage policies | products + audit + lineage fixtures | procurement lineage + receive effect fixtures green | full UI cutover |
| 8 | Reports/Uploads | consume stable domain contracts and data models | prior domains + contract stability | export shape fixtures and upload contract checks | schema-breaking report rewrites |
| 9 | Migration Adapters | final compatibility bridge before cutover work | all prior gates + rollback plan | migration adapter gate (G8) | production hard cutover |

## Key Sequencing Notes
- Transaction update/delete must never precede transaction create parity.
- Finance and procurement are intentionally delayed due to high financial/inventory risk.
- Reports should trail domain stabilization to avoid repeated contract churn.
