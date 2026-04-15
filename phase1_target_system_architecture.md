# Phase 1 — Target System Architecture

## Scope and Constraints
This is a **design-only** artifact for the target production architecture.

- No runtime implementation in this phase.
- No refactor of current runtime files in this phase.
- Phase 0 artifacts are the source of truth for invariants and migration risk.

## Target Stack
- **Frontend:** Next.js (App Router)
- **Backend:** Separate API service (recommended framework: NestJS)
- **Database:** MongoDB
- **Contracts:** DTO/payload-based request/response contracts
- **Protection model:** Middleware/guard/pipeline-driven protection

## Reference Architecture

```text
[ Next.js Frontend ]
   -> [ Typed API Client + Auth Session + Query Cache ]
   -> [ Backend API (NestJS) ]
         -> [ Middleware/Guards/Pipes/Interceptors ]
         -> [ Domain Modules ]
              - Auth/Tenancy
              - Products/Inventory
              - Customers/Ledger
              - Transactions
              - Finance
              - Procurement
              - Reports/Exports
         -> [ MongoDB ]
         -> [ Object Storage / Upload Signing ]
         -> [ Worker Queue for imports/exports ]
```

## Why This Architecture Fits Phase 0 Findings
1. Current high-risk business logic in `services/storage.ts` is moved to server-side domain modules.
2. Do-not-break invariants (stock, settlement, due/credit, shift close, lineage) become backend release gates.
3. UI behavior remains evolvable in Next.js while critical correctness shifts to backend services.

## Non-Negotiable Invariants to Preserve
1. Stock consistency by product+variant+color.
2. Sale settlement correctness (`cash/online/creditDue`).
3. Customer due/store-credit correctness.
4. Return mode correctness (`refund_cash`, `refund_online`, `reduce_due`, `store_credit`).
5. Transaction update/delete reconciliation integrity.
6. Shift open/close and cash discrepancy integrity.
7. Procurement lineage (`inquiry -> confirmed -> purchase -> receipt`) immutability.
8. Auth verification and store isolation parity.

## Cross-Cutting Guarantees
- Every protected request is authenticated and tenant-scoped.
- Mutation endpoints support standardized validation and deterministic error envelopes.
- Critical mutations use idempotency keys.
- Critical operations emit immutable audit events with request correlation IDs.

## Deployment Topology (Target)
- Next.js app and backend API are deployed as separate services.
- MongoDB is the system of record.
- Uploads use signed URLs/tokens (backend-issued) to object storage.
- Optional worker service handles heavy import/export/report jobs.

## Phase 1 Exit Criteria
- Domain boundaries and contracts finalized.
- Middleware architecture and protection order defined.
- MongoDB model blueprint defined with tenant scope and key indexes.
- Migration sequence defined with stage gates and rollback strategy.
