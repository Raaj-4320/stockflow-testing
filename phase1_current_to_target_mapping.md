# Phase 1 — Current to Target Mapping

## Objective
Map current files/modules to target frontend and backend ownership for staged migration.

| Current | Target Frontend | Target Backend | Notes |
|---|---|---|---|
| `App.tsx` | `app/(dashboard)/layout.tsx` | N/A | shell + guarded route layout |
| `pages/Auth.tsx` | `features/auth` | `auth` | keep verification parity |
| `pages/VerificationRequired.tsx` | `features/auth/verify` | `auth` | server-side verified check required |
| `pages/Admin.tsx` | `features/inventory` | `products`, `uploads` | inventory + media flows |
| `pages/Sales.tsx` | `features/sales` | `transactions`, `customers`, `products` | highest business-risk flow |
| `pages/Transactions.tsx` | `features/transactions` | `transactions`, `audit` | update/delete parity gate |
| `pages/Customers.tsx` | `features/customers` | `customers`, `transactions` | due/store-credit integrity |
| `pages/Finance.tsx` | `features/finance` | `finance` | shift close/cashbook parity |
| `pages/FreightBooking.tsx` | `features/procurement/freight` | `procurement` | lineage-preserving transitions |
| `pages/PurchasePanel.tsx` | `features/procurement/purchase` | `procurement`, `products` | receive affects stock/cost |
| `pages/Reports.tsx` | `features/reports` | `reports` | output schema stability |
| `pages/Settings.tsx` | `features/settings` | `tenancy` | store settings and policies |
| `services/storage.ts` | API client calls from features | split across all domains | phased extraction, no big-bang |
| `services/importExcel.ts` | import UI hooks | domain import services/jobs | validation moves server-side |
| `services/excel.ts` / `services/pdf.ts` | export trigger UI | `reports` | version contracts |
| `api/cloudinary-sign-upload.ts` | upload client | `uploads` | consolidate signing endpoint |

## Transitional Adapters
1. FE compatibility API client mirroring current storage call shapes.
2. Backend compatibility endpoints to reduce first-cut rewrite risk.
3. Feature flags for per-domain cutover and rollback.
