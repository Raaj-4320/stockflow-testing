# Frontend Procurement Page — Micro Functionality Checklist

Date: 2026-05-02  
Scope: Planning/checklist only. No UI wiring, no API wiring, no cutover.

## 1) Page purpose
Create a staged Next.js procurement page blueprint that mirrors core legacy Purchase Panel behavior (parties, orders, receive flows) while keeping the legacy app as source of truth until parity gates are passed.

## 2) User roles/permissions (visible in current app)
Current legacy Purchase Panel does not expose a strict role-matrix at UI level in this migration phase docs. Checklist assumption:
- Access controlled by existing app-level auth/tenant context.
- Procurement page should be treated as authenticated/tenant-scoped surface.
- Any future role restrictions must be introduced using existing authorization conventions (not new auth logic).

## 3) UI sections/components needed
Minimum route-level sections for future implementation:
1. Page header + context summary (store/tenant context when available).
2. Procurement tabs/switcher:
   - Orders
   - Parties
3. Parties panel:
   - list/search
   - create/edit form drawer/modal
4. Orders panel:
   - list/filter/status chips
   - create/edit order flow shell
   - order details panel
5. Receive flow shell:
   - receive method selector
   - confirmation summary
6. Shared shell states:
   - loading, empty, error banners/toasts.

## 4) Micro functionality list
### Parties
- List parties (paginated or simple list first).
- Search/filter parties by name/phone/GST.
- Create party.
- Update party.
- Optional archive toggle visibility.

### Orders
- List orders.
- Filter by status and party.
- Create order with line items.
- Edit order if status allows.
- View order details (including bill metadata and lines).

### Receive
- Trigger receive for eligible orders.
- Select receive method:
  - `avg_method_1`
  - `avg_method_2`
  - `no_change`
  - `latest_purchase`
- Submit receive request with optimistic version.
- Render success/failure outcome and updated order status.

## 5) Backend/API dependency map
From `frontend/services/procurementClient.ts`:
- Parties
  - `listParties`
  - `getPartyById`
  - `createParty`
  - `updateParty`
- Orders
  - `listOrders`
  - `getOrderById`
  - `createOrder`
  - `updateOrder`
- Receive
  - `receiveOrder`

Dependency boundaries:
- No direct import from legacy `services/storage.ts`.
- All future calls should go through typed client wrapper layer.

## 6) Form fields and validations
### Party form
- `name` required
- `phone` optional
- `gst` optional
- `location` optional
- `contactPerson` optional
- `notes` optional

### Order form
- `partyId` required
- `lines[]` required (at least one)
- Each line:
  - `productName` required
  - `sourceType` required (`inventory` or `new`)
  - `quantity` > 0
  - `unitCost` >= 0
  - conditional fields (`productId`, `pendingProductBarcode`, `category`, `variant`, `color`, `image`)
- Optional header fields:
  - `billNumber`
  - `billDate`
  - `gstPercent` >= 0
  - `notes`

### Receive form
- `orderId` required
- `receiveMethod` required
- `expectedVersion` required for conflict-safe path
- `note` optional

## 7) State management needs
Use simple local state first (no new global framework):
- active tab (`orders`/`parties`)
- list query/filter state
- selected entity IDs
- create/edit modal open/close state
- draft form state for party/order/receive
- async request state: idle/loading/success/error
- optimistic version tracking from fetched records

## 8) Error/loading/empty states
Required rendering states:
- Loading skeleton/spinner for list/details panels.
- Empty state for no parties/no orders/no matching search.
- Error banner for failed list/detail fetch.
- Form-level error messages for validation fields.
- API error-code mapping panel/toast for known procurement codes:
  - `PROCUREMENT_PARTY_NOT_FOUND`
  - `PROCUREMENT_ORDER_NOT_FOUND`
  - `PROCUREMENT_ORDER_ALREADY_RECEIVED`
  - `PROCUREMENT_ORDER_VERSION_CONFLICT`
  - `PROCUREMENT_INVALID_SOURCE_TYPE`
  - `PROCUREMENT_PRODUCT_MATERIALIZATION_FAILED`

## 9) Feature flags needed
Planned gates (no cutover in this task):
- `NEXT_PUBLIC_PROCUREMENT_CLIENT_ENABLED` (route-level backend-call enablement)
- optional UI gate for receive action visibility during rollout
- keep default behavior non-invasive while legacy root app remains primary

## 10) Manual QA checklist
1. Open procurement page route in Next.js shell.
2. Verify tabs/sections render with placeholders and no crashes.
3. Verify party form required/optional validations.
4. Verify order form line validation rules.
5. Verify receive method options exactly match backend enum.
6. Verify known API error codes map to readable messages.
7. Verify loading/error/empty states in each major panel.
8. Verify no cross-tenant leakage indicators in UI state.
9. Verify no dependency on legacy `storage.ts`.

## 11) Test checklist
When implementation starts:
- Unit tests (form validation helpers, mappers, error normalization).
- Component tests (tabs, forms, receive method selector, state transitions).
- API client mock tests (method calls + error code handling).
- Smoke route test for `/procurement` shell and section rendering.
- Non-regression check that root legacy app routes remain untouched.

## 12) Claude Code UI generation brief
Provide Claude Code with:
- exact component list from section 3,
- exact micro functions from section 4,
- strict constraints (no legacy file moves, no backend contract changes, no cutover),
- required states from sections 7 and 8,
- required validations from section 6,
- and file boundary: **`frontend/` only**.

Expected output from Claude:
- modular procurement page components,
- typed form models,
- placeholder-safe route behavior,
- no runtime dependency on legacy root code paths.

## 13) Codex integration plan
Codex phase sequence after this checklist:
1. Validate generated file boundaries (`frontend/` only).
2. Run frontend build.
3. Run root + backend regression checks.
4. Review API client usage to ensure no direct legacy storage imports.
5. Produce phase closeout report with parity/risk notes.

---
Checklist confirmation: planning-only artifact; no code wiring or cutover changes in this task.
