# Phase 1 — MongoDB Schema Blueprint

## Tenancy Model
- All domain collections are store-scoped via required `storeId`.
- All read/write queries include `storeId` filter.
- Index strategy starts with tenant-leading keys.

## Core Collections
- `users`
- `stores`
- `store_memberships` (if multi-user role model)
- `products`
- `customers`
- `transactions`
- `deleted_transactions`
- `transaction_update_events`
- `cash_sessions`
- `expenses`
- `expense_categories`
- `upfront_orders`
- `freight_inquiries`
- `freight_confirmed_orders`
- `purchase_orders`
- `purchase_receipt_postings`
- `purchase_parties`
- `audit_events`
- `operation_commits`
- `customer_product_stats`
- `media_assets` (optional)

## Model Strategy
1. **Embed historical line snapshots** in transactions/procurement records.
2. **Reference entities by ID** (`customerId`, `productId`) while preserving display snapshots.
3. **Keep lineage immutable** for procurement transitions.
4. **Persist ledger-critical fields** (settlement split, due/credit effects, shift totals).

## Key Indexes (Minimum)
- `products`: `{ storeId: 1, barcode: 1 }` unique
- `customers`: `{ storeId: 1, phone: 1 }` (unique when business-valid)
- `transactions`: `{ storeId: 1, date: -1 }`, `{ storeId: 1, customerId: 1, date: -1 }`
- `deleted_transactions`: `{ storeId: 1, deletedAt: -1 }`
- `cash_sessions`: partial unique index for one open session per store
- procurement lineage: `{ storeId: 1, sourceInquiryId: 1 }`, `{ storeId: 1, sourceConfirmedOrderId: 1 }`
- `customer_product_stats`: `{ storeId: 1, customerId: 1, productId: 1 }` unique

## Immutable Fields
- `sourceInquiryId`, `sourceConfirmedOrderId`, `sourceProductId`
- transaction creation metadata
- deleted transaction snapshot payload
- audit event payloads

## Firestore -> Mongo Mapping Direction
- Store-root arrays/subcollections become explicit top-level store-scoped collections.
- Historical data migration must dedupe by stable legacy IDs where present.
- Migration markers are kept in `stores` (or dedicated marker collection).
