# Phase 0 — Baseline Freeze Summary

## Scope and Intent
This document captures the **current system baseline** prior to any Next.js/backend/MongoDB migration work. No migration, refactor, or behavior change is included in this phase.

## Current Stack Summary
- Frontend: React 19 + TypeScript + Vite (`type: module`).
- Routing: `react-router-dom` with `HashRouter`.
- Auth: Firebase Auth (email/password + verification gate).
- Persistence: Firestore (`stores/{uid}` root + subcollections).
- Reporting: XLSX + jsPDF/jspdf-autotable.
- Image pipeline: Cloudinary signed upload endpoint(s).
- Runtime telemetry: custom behavior logger (`services/behaviorLogger.ts`).

## Entry Points
- `index.tsx`: root bootstrap + behavior tracking init.
- `App.tsx`: auth gate + route shell + nav + cloud/op status overlays.
- `services/storage.ts`: de facto domain runtime backbone.

## Active Routes (from `App.tsx`)
- `/` -> Admin
- `/sales` -> Sales
- `/transactions` -> Transactions
- `/customers` -> Customers
- `/pdf` -> Reports
- `/settings` -> Settings
- `/finance` -> Finance
- `/freight-booking` -> FreightBooking
- `/purchase-panel` -> PurchasePanel
- `/verify-email` -> VerificationRequired
- `*` -> redirect to `/`

## Critical Services
1. `services/storage.ts` (core state/domain/persistence orchestration)
2. `services/auth.ts` + `services/firebase.ts`
3. `services/importExcel.ts` and `services/excel.ts`
4. `services/pdf.ts`
5. `services/productVariants.ts` and `services/stockBuckets.ts`
6. `services/behaviorLogger.ts`

## Critical Files
- `services/storage.ts` (~4.6k LOC)
- `pages/Finance.tsx` (~2.9k)
- `pages/Admin.tsx` (~2.0k)
- `pages/Transactions.tsx` (~1.95k)
- `pages/Sales.tsx` (~1.5k)
- `types.ts` (schema contract)
- `firestore.rules` (security boundary)

## Current Persistence Model
- Firestore root: `stores/{uid}` with non-migrated root entities (profile, categories, cash sessions, expenses, procurement arrays, etc.).
- Subcollections: `products`, `customers`, `transactions`, `deletedTransactions`.
- Additional audit/ops collections: `auditEvents`, `operationCommits`, `customerProductStats`.
- Migration compatibility references still present in scripts (`products` top-level collection and `stores[].products` array).

## Deployment-Related Files
- `vite.config.ts`
- `firestore.rules`
- `firebase.json`
- `api/cloudinary-sign-upload.ts`
- `netlify/functions/cloudinary-sign-upload.ts`
- `netlify.toml` (currently empty)

## Immediate Risk Signals
1. `services/storage.ts` is a multi-domain god-module.
2. Large page components mix UI orchestration + domain decisions.
3. Event-driven synchronization (`storage`, `local-storage-update`, custom events) can race.
4. Duplicate Cloudinary handler implementations.
5. Non-routed but large legacy module (`pages/ClassicPOS.tsx`).
6. Migration scripts rely on legacy schema variants.

## Recommended Git Freeze Action
- Suggested freeze branch: `freeze/phase0-system-audit-YYYYMMDD`
- Suggested immutable tag: `phase0-freeze-v1-YYYYMMDD`

## Recommended Backup Checklist (Before Migration Starts)
1. Export full Firestore backup (production and staging).
2. Snapshot current rules and auth config.
3. Export current environment variables for each environment.
4. Archive current scripts and reports into `audit/phase0/`.
5. Capture golden test data snapshots for transactions/customers/products.
6. Record baseline KPI outputs from Finance pages for regression comparison.
7. Save representative PDF/Excel import-export artifacts.
8. Preserve route map and dependency maps (already generated artifacts).
