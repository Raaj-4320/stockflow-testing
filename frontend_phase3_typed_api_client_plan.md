# Frontend Phase 3 — Typed API Client Plan

Date: 2026-05-01  
Scope: Planning-only. No runtime/frontend/backend contract changes.

## 1) Executive verdict
**GO** for a narrow typed API client foundation phase in `frontend/` before any real domain page wiring.

## 2) API client goals
- Create a small, typed HTTP client baseline for the Next.js workspace.
- Normalize auth/tenant headers and error envelope handling in one place.
- Keep domain clients explicit (procurement first, then others).
- Preserve the current rule: no cutover and no replacement of legacy root app behavior.

## 3) What not to do
- Do **not** build a generic SDK framework.
- Do **not** wire UI pages to backend in this planning phase.
- Do **not** import legacy `services/storage.ts` into `frontend/`.
- Do **not** change backend endpoints/contracts.
- Do **not** couple client internals to page state or routing.

## 4) Proposed frontend service structure
Target minimal structure:

```text
frontend/
  services/
    apiClient.ts
    procurementClient.ts
  lib/
    env.ts
    errors.ts
```

Responsibilities:
- `lib/env.ts`: strict env parsing, defaults, and required/optional flags.
- `lib/errors.ts`: typed error helpers for standard envelope + network failures.
- `services/apiClient.ts`: low-level fetch wrapper (headers, parsing, request id extraction).
- `services/procurementClient.ts`: explicit procurement endpoint functions.

## 5) Auth/token handling plan
- Phase 3 implementation should support token injection strategy without switching auth flows:
  - `getAccessToken?: () => string | null` provided at client creation time.
- Token header pattern (future implementation):
  - `Authorization: Bearer <token>` only when token exists.
- No silent token refresh logic in this phase; keep failure explicit.

## 6) Tenant/store context plan
- Client should accept store context provider:
  - `getStoreId?: () => string | null`.
- Header plan (aligned with backend tenancy guard expectations):
  - include tenant/store header only when present.
- Missing store context should fail fast at client boundary for tenant-required calls.

## 7) Request ID / error envelope plan
- Capture request id from response headers when present and attach to thrown client errors.
- Parse backend standard error envelope safely:
  - `code`
  - `message`
  - `fieldErrors`
  - `requestId`
  - `timestamp`
- Provide two typed error classes:
  1. `ApiHttpError` (non-2xx with parsed envelope)
  2. `ApiNetworkError` (fetch/network/runtime issues)

## 8) Procurement API client plan
`services/procurementClient.ts` (future implementation phase) should expose explicit methods:
- `listParties`
- `getPartyById`
- `createParty`
- `updateParty`
- `listOrders`
- `getOrderById`
- `createOrder`
- `updateOrder`
- `receiveOrder`

Design constraints:
- direct mapping to backend procurement routes,
- no side-effect logging framework,
- no UI state mutation inside client.

## 9) Products/customers/transactions/finance future client plan
After procurement client baseline stabilizes:
1. Add parallel typed clients by domain (`productsClient`, `customersClient`, etc.).
2. Reuse shared `apiClient.ts` only for transport concerns.
3. Keep domain-specific request/response mapping in each domain client file.
4. Preserve phase gates: no transaction/finance behavior changes in frontend client phase.

## 10) DTO sharing/import strategy
- Near-term: define lightweight frontend-side interfaces aligned to backend DTO shapes.
- Mid-term option: generate shared contract package only if duplication pain becomes real.
- Do not directly import Nest module internals from `backend/src/modules/*`.
- If importing backend contracts is attempted later, restrict to stable DTO-only boundary and avoid server-only dependencies.

## 11) Environment variable plan
Planned frontend env entries (Next.js shell scope):
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_TIMEOUT_MS` (optional, defaulted in `env.ts`)
- `NEXT_PUBLIC_PROCUREMENT_CLIENT_ENABLED` (feature gate for future wiring)

Rules:
- all env reads through `lib/env.ts`,
- fail-fast messages for malformed required values,
- conservative defaults for optional values.

## 12) Testing strategy
Phase 3 implementation testing plan:
1. Unit tests for `env.ts` parsing/defaulting.
2. Unit tests for `errors.ts` envelope parsing behavior.
3. Unit tests for `apiClient.ts` request/response/error mapping using mocked fetch.
4. Unit tests for `procurementClient.ts` endpoint path + payload mapping.
5. No UI integration tests required until page wiring phase.

If no frontend test harness is introduced immediately, document manual smoke checks and keep typed client code minimal.

## 13) Simplification rules
1. One transport client + one domain client at a time.
2. No interceptors/plugin architecture.
3. No automatic retries in initial version.
4. No hidden global mutable state.
5. Explicit function signatures over dynamic request builders.

## 14) Recommended next implementation phase
**Frontend Phase 3.1 — Typed Client Foundation (No Page Wiring)**
- Implement `lib/env.ts`, `lib/errors.ts`, `services/apiClient.ts`, `services/procurementClient.ts`.
- Add focused unit tests (or documented manual verification if harness deferred).
- Keep all Next.js routes placeholder-only.
- Do not wire procurement UI routes to live backend yet.

---
Planning confirmation: this document adds no runtime behavior and no backend/contract changes.
