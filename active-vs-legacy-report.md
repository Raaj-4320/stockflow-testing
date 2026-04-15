# Active vs Legacy Report

## Definitely Active
(Confirmed by route usage, imports, or entry wiring)

- Entry/shell: `index.tsx`, `App.tsx`
- Routed pages: `pages/Admin.tsx`, `pages/Sales.tsx`, `pages/Transactions.tsx`, `pages/Customers.tsx`, `pages/Reports.tsx`, `pages/Settings.tsx`, `pages/Finance.tsx`, `pages/FreightBooking.tsx`, `pages/PurchasePanel.tsx`, `pages/Auth.tsx`, `pages/VerificationRequired.tsx`
- Core services: `services/storage.ts`, `services/auth.ts`, `services/firebase.ts`, `services/productVariants.ts`, `services/stockBuckets.ts`, `services/numberFormat.ts`, `services/excel.ts`, `services/importExcel.ts`, `services/pdf.ts`, `services/behaviorLogger.ts`, `services/financeLogger.ts`
- Shared components: `components/ui.tsx`, `components/ExportModal.tsx`, `components/UploadImportModal.tsx`
- Core config: `package.json`, `vite.config.ts`, `index.html`, `firestore.rules`, `firebase.json`

## Likely Active (Deployment/Feature dependent)

- `netlify/functions/cloudinary-sign-upload.ts` (Netlify deployments)
- `api/cloudinary-sign-upload.ts` (platforms routing `/api/*` directly)
- `scripts/*.js` (manual operational flows, not runtime app paths)

## Unclear

- `services/gemini.ts` (no local imports found in current route/page graph; appears prepared for future use)
- `netlify.toml` (empty file, no configuration content)

## Legacy (Still Present)

- `pages/ClassicPOS.tsx` (full alternate POS implementation; not imported by `App.tsx` route tree)
- Legacy migration compatibility code in scripts checking:
  - top-level `products` collection
  - embedded `stores/{uid}.products` arrays

## Dead Code Candidates (evidence-based)

1. `pages/ClassicPOS.tsx` (or move to demos/legacy folder)
2. `services/gemini.ts` if no near-term feature plans

## Duplicated Code Candidates

1. Cloudinary signature handlers:
   - `api/cloudinary-sign-upload.ts`
   - `netlify/functions/cloudinary-sign-upload.ts`

## Notes

- Classification is based on route map, import graph, and explicit runtime wiring.
- “Likely active” and “unclear” categories are intentionally conservative where deployment topology is not fully visible.
