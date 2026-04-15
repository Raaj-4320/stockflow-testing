# Backend Scaffold (Phases 2B-3A)

This folder contains the migration-safe NestJS backend foundation.

## Implemented foundation
- App bootstrap (`src/main.ts`, `src/app.module.ts`)
- Typed config/env validation with auth/tenant security placeholders
- Global request ID middleware
- Global validation pipe (unknown-field rejection)
- Global exception filter with standard envelope
- Logger and audit interceptor skeleton
- MongoDB connection shell and health endpoints
- Auth/Tenancy foundation (guards, context contracts, resolver)
- Products baseline domain (store-scoped CRUD + fixtures)
- Customers baseline domain (strictly non-ledger; store-scoped CRUD + fixtures)
- Transactions read-model foundation (strictly read-only contracts/endpoints)
- Fixture harness hardening:
  - executable fixture payloads for products/customers
  - transaction read-model fixture planning placeholders

## Intentionally deferred
- Ledger/payment behavior (`totalDue`, `storeCredit`, payments)
- Transactions mutation logic (create/update/delete, settlement, reconciliation)
- Finance/procurement domain logic
- Firestore migration/cutover
- Frontend rewiring

## Preconditions before transaction mutation planning
1. Products + customers suites execute and remain green in CI-capable environment.
2. Transaction read contracts reviewed and accepted.
3. Mutation fixture plan approved before any write-path implementation.
