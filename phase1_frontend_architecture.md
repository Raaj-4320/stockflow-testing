# Phase 1 — Frontend Architecture (Next.js)

## Goals
- Use Next.js App Router for scalable domain routing.
- Keep business-critical rules out of client runtime.
- Consume backend via typed DTO contract client.

## Recommended Structure

```text
app/
  (auth)/
    login/page.tsx
    verify/page.tsx
  (dashboard)/
    layout.tsx
    inventory/page.tsx
    sales/page.tsx
    transactions/page.tsx
    customers/page.tsx
    finance/page.tsx
    reports/page.tsx
    settings/page.tsx
    procurement/
      freight/page.tsx
      purchase/page.tsx

features/
  auth/
  inventory/
  sales/
  transactions/
  customers/
  finance/
  procurement/
  reports/
  settings/

shared/
  ui/
  components/
  forms/
  tables/

lib/
  api/
    client.ts
    endpoints.ts
    dto/
  validation/
  utils/

providers/
  query-provider.tsx
  session-provider.tsx

hooks/
  use-auth.ts
  use-tenant.ts
  use-export.ts
```

## Component Strategy
- **Container components** orchestrate data fetching/mutations.
- **Presentational components** render views and remain stateless where possible.
- Shared UI primitives live in `shared/ui`.

## State Strategy
- Server state: TanStack Query (or equivalent) with store-scoped keys.
- UI-local state: local React state (or lightweight store).
- Replace browser custom-event synchronization with query invalidation + mutation lifecycle.

## Validation Strategy
- Frontend schema validation for UX only.
- Backend DTO validation is source of truth.
- Error envelopes normalized for all mutations.

## Route Mapping from Current Pages
- `pages/Admin.tsx` -> `features/inventory`
- `pages/Sales.tsx` -> `features/sales`
- `pages/Transactions.tsx` -> `features/transactions`
- `pages/Customers.tsx` -> `features/customers`
- `pages/Finance.tsx` -> `features/finance`
- `pages/FreightBooking.tsx` + `pages/PurchasePanel.tsx` -> `features/procurement`
- `pages/Reports.tsx` -> `features/reports`
- `pages/Settings.tsx` -> `features/settings`
- `pages/Auth.tsx` + `pages/VerificationRequired.tsx` -> `features/auth`

## Frontend Guardrails
- Never compute final settlement/reconciliation values as client source of truth.
- Never trust client store scope; backend must enforce tenant boundaries.
- Keep all destructive operations behind explicit confirmation + backend idempotency key.
