# UI Page Blueprint

> Purpose: page-by-page structural blueprint for UI/UX rebuild and AI-assisted frontend implementation.

## `/` -> `pages/Admin.tsx` (Inventory)
- **Page purpose:** Product/inventory master management.
- **Major sections:**
  - Header + toolbar
  - Product table/grid with search/filter/sort
  - Low-stock insights and export triggers
  - Category + variant/color management dialogs
  - Product create/edit modal
  - Purchase history/purchase add modal
- **Core UI elements:** cards, tables, form fields, batch selection controls, barcode preview canvas.
- **Filters/search/sort:** search term, category filter, sort option, low-stock filters.
- **Primary actions:** add/edit/delete product, batch edit/delete, add category, rename/delete category, import/export inventory.
- **Key UI state:** modal states, selection arrays, formData, purchase modal state, preview image state.
- **Repeated patterns:** shared `ExportModal`, `UploadImportModal`, same-tab and cross-tab refresh listeners.
- **Tight coupling points:** direct calls to storage mutation functions and product normalization inside component.

## `/sales` -> `pages/Sales.tsx` (POS)
- **Page purpose:** Real-time sale and return processing.
- **Major sections:**
  - Product browsing panel (cards)
  - Cart/checkout panel
  - Customer search/create modal
  - Return transaction picker modal
  - Checkout completion modal/export options
- **Core UI elements:** product cards, quantity controls, payment method controls, return mode controls, receipt/export actions.
- **Filters/search/sort:** product search; return search/date/sort controls.
- **Primary actions:** add/remove cart lines, adjust quantity/price/discount, checkout, process return, print/export receipt.
- **Key UI state:** cart, customer selection, payment values, return mode, pending checkout refs, transaction completion state.
- **Repeated patterns:** `ExportModal`, `local-storage-update` + `storage` listeners, op-status event listener.
- **Tight coupling points:** transaction construction/validation logic in page and service both.

## `/transactions` -> `pages/Transactions.tsx`
- **Page purpose:** Transaction history management and corrective operations.
- **Major sections:**
  - Filters/date range controls
  - Transaction list/cards/table
  - Transaction detail drawer/modal
  - Edit transaction modal
  - Delete confirmation modal with reason
  - Deleted transactions bin view
  - Import/export controls
- **Filters/search/sort:** time windows, custom dates, excel export filters (payment/type/amount/search).
- **Primary actions:** view, edit, delete, batch edit/delete, export PDF/Excel, historical import.
- **Key UI state:** selectedTx, editingTx and line edits, delete target and reason, bin selection.
- **Tight coupling points:** heavy audit preview and settlement correction logic bound to UI actions.

## `/customers` -> `pages/Customers.tsx`
- **Page purpose:** Customer ledger, dues, payments, and upfront order management.
- **Major sections:**
  - Customer summary and filters
  - Customer list/table/cards
  - Customer detail panel with history
  - Record payment modal
  - Add/edit customer modal
  - Upfront order create/edit/collect modal
  - Export/import controls
- **Filters/search/sort:** name/phone search, due/high-value filter, spend/due/visit sort.
- **Primary actions:** add/edit/delete customer, record payment, create/collect upfront orders, export statements.
- **Key UI state:** viewingCustomer, payment form state, upfront order form state, edit form state, selection arrays.
- **Tight coupling points:** canonical due/store-credit recomputation in page with service calls.

## `/pdf` -> `pages/Reports.tsx`
- **Page purpose:** Product reporting and printable/exportable catalogs.
- **Major sections:**
  - Report mode controls
  - Export action controls
  - PDF generation flow (internal/customer)
- **Filters/search/sort:** report type selection.
- **Primary actions:** generate/download PDF, trigger Excel exports.
- **Key UI state:** report type, export modal open state.
- **Tight coupling points:** direct PDF layout logic in page function.

## `/settings` -> `pages/Settings.tsx`
- **Page purpose:** Store profile, tax, invoice, signature, and manager PIN configuration.
- **Major sections:**
  - Business info form
  - Tax config card
  - Contact/address card
  - Signature upload card
  - Invoice mode card
  - Security/PIN card
  - Bank details card
- **Primary actions:** save profile, upload/remove signature, set tax and invoice defaults, set manager PIN.
- **Key UI state:** profile object, admin pin touched flag, save success indicator.
- **Tight coupling points:** direct persistence through `updateStoreProfile` and auth actions.

## `/finance` -> `pages/Finance.tsx`
- **Page purpose:** Financial operations dashboard and reconciliation workspace.
- **Major sections:**
  - Tabbed finance workspace (`dashboard`, `cashbook`, `cash`, `expense`, `credit`, `profit`)
  - KPI cards and rollup summaries
  - Cashbook filter/diagnostics panel
  - Shift open/close controls
  - Opening balance unlock modal
  - Expense management and export controls
- **Filters/search/sort:** date ranges, type/audit filters, customer query, reporting layer mode.
- **Primary actions:** start shift, close shift, unlock/edit opening balance, add/remove expense/category, export cashbook/expense reports.
- **Key UI state:** large set of tab/form/filter/session fields.
- **Repeated patterns:** global event listeners (`storage`, `local-storage-update`, `cloud-sync-status`), CSV/XLSX export helpers.
- **Tight coupling points:** heavy finance derivations and persistence logic co-located with UI rendering.

## `/freight-booking` -> `pages/FreightBooking.tsx`
- **Page purpose:** Freight inquiry lifecycle authoring and conversion to confirmed orders.
- **Major sections:**
  - Inquiry list + confirmed orders overview
  - Multi-step wizard (`source`, `line_setup`, `distribution`, `cbm`, `review`)
  - Broker/category quick-create controls
  - Variant and carton assignment UI
- **Filters/search/sort:** home search, sort (`latest/amount/product`), status filter.
- **Primary actions:** create/edit inquiry, set pricing/carton/cbm allocations, convert inquiry to confirmed order.
- **Key UI state:** wizard step, source mode, selected product/variants, pricing entries, carton assignments, CBM drafts.
- **Tight coupling points:** line-level calculations and conversion semantics embedded in page.

## `/purchase-panel` -> `pages/PurchasePanel.tsx`
- **Page purpose:** Purchase order management and inventory receipt posting.
- **Major sections:**
  - Purchase order list/dashboard
  - Create order wizard (`source`, `line_setup`, `pricing`, `review`)
  - Supplier party create modal
  - Receive order modal with buy-price method preview
  - Import modal
- **Filters/search/sort:** search, sort (`latest/amount/party`), status filter.
- **Primary actions:** create party, create order, import purchase data, receive order into stock.
- **Key UI state:** wizard data, line drafts, selected party, receive target and price method.
- **Tight coupling points:** projected buy-price calculations and receiving side effects interwoven with UI.

## `/verify-email` -> `pages/VerificationRequired.tsx`
- **Page purpose:** Block app use until email verification.
- **Major sections:** message card with resend + back to login actions.
- **Primary actions:** resend verification email, sign out and reload.
- **Key UI state:** sending flag, message text.
- **Tight coupling points:** direct firebase auth operations in UI.

## Auth shell (`pages/Auth.tsx`, pre-router condition)
- **Purpose:** login/register/forgot-password entry state.
- **Major sections:** mode-driven auth form, status banners, resend verification CTA.
- **Key UI state:** mode flags, form fields, loading/resend cooldown/errors.
- **Tight coupling points:** direct invocation of auth service and branching UX logic.

## Repeated UI Patterns Across Pages
1. Event-driven refresh (`storage` + `local-storage-update`) in `useEffect`.
2. Shared primitives from `components/ui.tsx`.
3. Reusable export/import modals.
4. Heavy local state objects for complex modal workflows.
5. Direct service calls from page handlers (minimal abstraction layer).

