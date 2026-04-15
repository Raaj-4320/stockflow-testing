# Phase 0 — Final Active vs Legacy Classification

## Classification Method
Evidence used:
- Route wiring (`App.tsx`)
- Local import graph (`dependency-map.json`)
- Entry wiring (`index.tsx`)
- Script invocation from `package.json`
- Deployment context (API/serverless files)

## Definitely Active
### Core runtime
- `index.tsx`, `App.tsx`, `types.ts`
- `services/storage.ts`, `services/auth.ts`, `services/firebase.ts`
- `services/productVariants.ts`, `services/stockBuckets.ts`, `services/numberFormat.ts`
- `services/excel.ts`, `services/importExcel.ts`, `services/pdf.ts`
- `services/behaviorLogger.ts`, `services/financeLogger.ts`
- `components/ui.tsx`, `components/ExportModal.tsx`, `components/UploadImportModal.tsx`

### Routed pages
- `pages/Admin.tsx`
- `pages/Sales.tsx`
- `pages/Transactions.tsx`
- `pages/Customers.tsx`
- `pages/Reports.tsx`
- `pages/Settings.tsx`
- `pages/Finance.tsx`
- `pages/FreightBooking.tsx`
- `pages/PurchasePanel.tsx`
- `pages/Auth.tsx`
- `pages/VerificationRequired.tsx`

### Essential config/security
- `package.json`, `vite.config.ts`, `index.html`, `firestore.rules`, `firebase.json`

## Likely Active (Environment/Deployment dependent)
- `netlify/functions/cloudinary-sign-upload.ts` (Netlify runtime path)
- `scripts/*.js` (manual ops workflows via npm scripts)

## Unclear
- `api/cloudinary-sign-upload.ts` (platform dependent; duplicate logic to Netlify function)
- `services/gemini.ts` (no local imports found in active app graph)
- `netlify.toml` (empty)
- markdown docs not directly consumed by runtime

## Legacy
- `pages/ClassicPOS.tsx` (large alternate POS implementation, not routed/imported)
- legacy schema handling in migration scripts:
  - top-level `products` collection scan
  - `stores/{id}.products` array scan

## Dead Code Candidates (requires confirm before deletion)
1. `pages/ClassicPOS.tsx`
2. `services/gemini.ts` (if product confirms no imminent use)

## Duplicated Implementation Candidates
1. `api/cloudinary-sign-upload.ts`
2. `netlify/functions/cloudinary-sign-upload.ts`

## Deployment-Dependent Code
- Cloudinary signing handler path depends on host platform.
- Firebase rules active only when deployed via firebase tooling.
- Scripts depend on credentialed execution environment (service account / ADC).

## Confidence Notes
- High confidence: route-driven page activity and central service usage.
- Medium confidence: deployment path choice for API vs Netlify function.
- Medium/low confidence: future intent for `services/gemini.ts`.
