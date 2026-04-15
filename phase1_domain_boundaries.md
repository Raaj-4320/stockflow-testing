# Phase 1 — Domain Boundaries

## Boundary Rule
Each domain owns its invariants and persistence model. Other domains interact through service interfaces/events, not direct collection access.

## Domains

### 1) Auth/Tenancy
- Owns identity, verification, session, tenant scope.
- Owns: `users`, `stores`, `store_memberships`.

### 2) Inventory
- Owns products, categories, variants/colors, stock buckets.
- Owns: `products` (+ category/variant/color masters).

### 3) Transactions
- Owns sale/return/payment creation, update/delete reconciliation.
- Owns: `transactions`, `deleted_transactions`, `transaction_update_events`, `operation_commits`.

### 4) Customers/Ledger
- Owns customer balances and customer-linked order states.
- Owns: `customers`, `upfront_orders`, `customer_product_stats`.

### 5) Finance
- Owns shift lifecycle and expense bookkeeping.
- Owns: `cash_sessions`, `expenses`, `expense_categories`.

### 6) Procurement
- Owns freight-to-purchase lifecycle and receipt posting.
- Owns: `freight_inquiries`, `freight_confirmed_orders`, `purchase_orders`, `purchase_receipt_postings`, `purchase_parties`.

### 7) Reports
- Owns export generation contracts and report jobs.
- Owns: report job metadata (if persisted).

### 8) Platform/Audit
- Owns audit, middleware policies, idempotency, upload signing.
- Owns: `audit_events`, idempotency-key store, optional `media_assets`.

## Explicit Non-Leak Rules
- Settlement math belongs to Transactions only.
- Due/store-credit balance rules belong to Customers/Ledger only.
- Shift close discrepancy rules belong to Finance only.
- Procurement lineage transition rules belong to Procurement only.
