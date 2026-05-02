# Frontend Page Analysis — Purchase Panel (`/purchase-panel`)

## 1) Executive summary
- **What the page does:** Manages supplier parties, creates/edits purchase orders via a multi-step wizard, imports purchase data, and receives orders into stock with buy-price strategy selection and preview.
- **Current complexity level:** **High** (single file with many responsibilities: list management, wizard flow, calculations, modal orchestration, and mutation actions).
- **Migration risk level:** **High** (inventory valuation and stock mutations are triggered from this UI path).
- **Safe to redesign UI separately from business logic?** **Yes, with caution.** UI can be regenerated component-wise with mock data first, while preserving exact interaction contracts and calculation semantics for later integration.

## 2) Current route/page identity
- **Legacy file path:** `pages/PurchasePanel.tsx`
- **Current page/component name:** `PurchasePanel`
- **Route/tab/menu location:** Route is `/purchase-panel`, mounted in app routing and protected route wrapper.
- **Main user role/use case:** Operator/admin managing procurement orders, supplier party records, and inventory receiving.

## 3) Visual/design structure
- **Header area**
  - Title: “Purchase Panel”
  - Subtitle: “Create and manage purchase orders and reusable parties.”
- **Top tab switch**
  - `Purchase Orders` and `Parties`.
- **Orders tab layout**
  - Filter/search toolbar (search, status filter, sort select, CTA buttons).
  - Orders list card with result count.
  - Row cards per order with summary metrics and actions (Edit/Receive).
  - Pagination footer when results exceed page size.
- **Parties tab layout**
  - Two-column grid:
    - Create Party form card.
    - Saved Parties list card.
- **Modals**
  - Generic `Modal` wrapper.
  - Create/Edit Purchase Order wizard modal:
    - `source` → `product`/`newProduct` → `variants` → `pricing` → `review`.
  - Create Party popup modal (quick create from pricing step).
  - Receive Order modal (pricing method + preview table + confirm).
  - Import modal (`UploadImportModal`).
- **Tables/lists/cards**
  - Card list for orders.
  - Table in review step for line validation.
  - Table in receive modal for buy-price projections.
- **Empty states**
  - Orders: “No purchase orders yet.”
  - Parties: “No parties yet.”
  - Receive preview: message for orders with only new-product lines.
- **Responsive behavior**
  - Uses `md`, `lg`, `xl` grid/flex breakpoints.
  - Dense controls collapse into stacked layout on smaller widths.

## 4) Current UI sections/components
| Section/component | Purpose | Inputs/data | User actions | Current problems | Suggested Next.js component name |
|---|---|---|---|---|---|
| Page header + tab bar | Entry and context switch | `activeTab` | Switch tab | Coupled inside large page | `PurchasePanelHeader` |
| Orders toolbar | Search/filter/sort/CTAs | `homeSearch`, `filterBy`, `sortBy` | Filter/sort/open create/import/download | Inline logic and style-heavy markup | `PurchaseOrdersToolbar` |
| Orders list rows | Show order summaries and actions | `paginatedOrderList` | Edit, Receive | Row rendering + actions tightly coupled | `PurchaseOrderList` + `PurchaseOrderCard` |
| Parties create form | Add supplier party | party draft fields | Save Party | Duplicate fields also appear in modal | `PurchasePartyForm` |
| Saved parties list | Display parties | `parties` | None | No pagination/search | `PurchasePartyList` |
| Create/edit order wizard | End-to-end order drafting | many wizard states | navigate steps, select product/variant, pricing, review, save | Oversized orchestrator; business rules embedded | `PurchaseOrderWizard` |
| Quick create party modal | Create party in context | party fields | Save/cancel | duplicates primary form | `CreatePartyDialog` |
| Receive modal | Receive order and pick price method | `receiveTargetOrder`, `receivePriceMethod`, preview rows | select method, confirm receive | High-risk logic co-located in UI | `ReceiveOrderDialog` |
| Import modal bridge | Excel import flow | upload callbacks | download template, upload file | Hidden dependency on service contract | `PurchaseImportDialog` |

## 5) Full micro-functionality list
| Functionality | Trigger | Input | Output | Side effects | Risk | Future component/function |
|---|---|---|---|---|---|---|
| Refresh page data | mount + `local-storage-update` event | none | sets products/orders/parties | calls shadow compare | Medium | `usePurchasePanelData.refresh()` |
| Switch tab | tab buttons | tab key | changes visible section | none | Low | `PurchasePanelHeader` |
| Search orders | search input | query string | filtered list | resets page to 1 | Low | `PurchaseOrdersToolbar` |
| Filter orders by status | status select | status enum | filtered list | resets page to 1 | Low | `PurchaseOrdersToolbar` |
| Sort orders | sort select | latest/amount/party | sorted list | resets page to 1 | Low | `PurchaseOrdersToolbar` |
| Paginate orders | previous/next | page delta | page slice | none | Low | `PurchaseOrderPagination` |
| Download purchase data | button | none | file download | I/O | Low | `onDownloadPurchaseData` |
| Open import modal | button | none | modal open | none | Low | `PurchaseImportDialog` |
| Import purchase file | modal submit | file | import result | writes storage, refreshes data | High | `onImportPurchaseFile` |
| Open create order wizard | CTA | none | modal open/reset | clears wizard state | Medium | `PurchaseOrderWizard.openCreate()` |
| Select source mode | source step | inventory/new | sets step path | affects downstream flow | Medium | `SourceModeStep` |
| Search/select inventory product | product step | query/product | selected product | clears variant/pricing state | Medium | `InventoryProductPicker` |
| Build new product draft | new product step | text/file/tokens | draft object | FileReader base64 conversion | Medium | `NewProductDraftStep` |
| Add/remove variant/color tokens | buttons | token strings | updated arrays | affects generated pricing rows | Medium | `VariantColorTokensEditor` |
| Select inventory variants | variant tiles | variant keys | selected keys array | gates next-step access | Medium | `VariantSelectorStep` |
| Seed pricing lines | next to pricing | selected rows/draft rows | pricing entries map | overrides draft map | Medium | `PricingMatrixStep.initFromSelection()` |
| Edit line qty/unit cost | inputs | numeric text | line totals update | recalculates totals | High | `PricingMatrixEditor` |
| Create party (main or popup) | save party | party form fields | party persisted + selected id | writes storage, refreshes | Medium | `CreatePartyForm.submit()` |
| Compute draft totals | memo calc | pricing entries, GST | qty/amount/grand total | UI-only derived | High (financial display) | `usePurchaseTotals` |
| Save purchase order | review submit | full order payload | created/updated order | writes storage, closes modal, refresh | High | `savePurchaseOrderDraft()` |
| Edit existing order | edit button | order object | wizard prefilled | maps lines to product variant keys | High | `PurchaseOrderWizard.openEdit(order)` |
| Open receive modal | receive button | order | modal open/default method | none | Medium | `ReceiveOrderDialog.open(order)` |
| Change receive price method | radio group | method enum | selected method/preview highlight | none | Medium | `ReceiveMethodSelector` |
| Preview projected buy prices | receive modal render | order lines + products | matrix of projected prices | none | High | `useReceivePreviewRows` |
| Confirm receive | confirm button | orderId + method | order status updated | stock/buy price/product creation side effects | **Critical** | `confirmReceiveOrder` |

## 6) Data dependencies
| Data item | Source today | Used for | Future source in Next.js | Notes |
|---|---|---|---|---|
| `products` | `loadData()` | product picker, variant stock, receive preview | mock data now; later procurement/products API adapter | Includes variant-color stock shape |
| `orders` | `getPurchaseOrders()` | list, edit prefill, receive target | mock orders store, later `/procurement/orders` | Status drives actions |
| `parties` | `getPurchaseParties()` | party select/list/create | mock parties store, later `/procurement/parties` | Required for save order |
| wizard local state | `useState` in page | all step transitions | local feature state | Should move into wizard hook/context |
| computed lists/totals | `useMemo` | UI projections and gating | local derived selectors | ensure deterministic math |
| route context | app routing | navigation identity | Next.js route segment | currently no route params |
| shadow compare flags/data | `runProcurementShadowCompare` | diagnostics only | defer wiring | keep out of initial UI-only migration |

## 7) Write/mutation dependencies
| Mutation | Current function/service | Payload shape | Side effects | Risk | Future backend/API target |
|---|---|---|---|---|---|
| Create party | `createPurchaseParty` | name + optional contact fields | persists party, refresh | Medium | `POST /procurement/parties` |
| Create order | `createPurchaseOrder` | full `PurchaseOrder` object | persists order | High | `POST /procurement/orders` |
| Update order | `updatePurchaseOrder` | full `PurchaseOrder` object | overwrites existing order | High | `PATCH /procurement/orders/:id` |
| Receive order | `receivePurchaseOrder(orderId, method)` | orderId + method enum | updates stock, buy price, status | **Critical** | `POST /procurement/orders/:id/receive` |
| Import purchase file | `importPurchaseFromFile` | file | bulk writes orders/related | High | future adapter/batch endpoint TBD |

## 8) Forms and validation map
| Form | Field | Required? | Type | Validation | Default | Notes |
|---|---|---|---|---|---|---|
| Create Party (tab/modal) | Name | Yes | text | trimmed non-empty | `''` | save blocked if empty |
| Create Party | Phone/GST/Location/Contact/Notes | No | text | trim only | `''` | optional persisted fields |
| New Product Draft | name, category | Yes to continue | text | must be non-empty to continue | `''` | gating only, no inline error copy |
| New Product Draft | barcode | Effectively yes | text | defaults generated pending barcode | generated | user-editable |
| New Product Draft | image | No | file/url | FileReader for upload | `''` | accepts base64 or URL |
| New Product Draft | description, hsn | No | text | none | `''` | passed in pending draft |
| New Product Draft | sellPrice | No | number | numeric/non-negative coercion | `''` | optional |
| Pricing step | partyId | Yes for review | select | must select party | `''` | blocks Next |
| Pricing step | quantity/unitCost (per line) | Yes | number | each > 0 | `''` | blocks Next |
| Pricing step | GST % | No | number | coerced to >=0 | `''` | affects totals |
| Pricing step | billNumber/billDate/notes | No | text/date | none | `''` | metadata |
| Receive modal | receive method | Yes | radio enum | one selected | `no_change` | required before confirm |

## 9) Business rules hidden in UI
- Weighted buy-price projection formulas for 4 receive methods are implemented locally.
- Step gating rules:
  - Inventory flow requires at least one variant selected.
  - Review step requires party + positive qty/unit cost on all active lines.
- New-product variant/color matrix generation creates implied line items.
- `saveOrder` assembles pending new-product metadata into each line and computes tax/totals.
- Edit flow reconstructs wizard state from saved order lines with variant-key remapping.
- Receive preview excludes non-inventory lines and only previews resolvable products.
- Received orders disable edit/receive actions.

## 10) Design problems / simplification opportunities
- Single monolithic page component mixes read/write orchestration, view rendering, and business math.
- Duplicate party creation UI (tab form + modal) should be unified.
- Hard-coded styling and repeated card chunks should become reusable presentation components.
- Wizard step components should be split and driven by typed step contracts.
- Validation feedback is mostly implicit (disabled buttons) with minimal explicit error text.
- Receive logic and pricing projection should move to dedicated utility/hook for testability.

## 11) Proposed Next.js component breakdown
```text
frontend/features/procurement/purchase-panel/
  components/
    PurchasePanelHeader.tsx
    PurchaseOrdersToolbar.tsx
    PurchaseOrderList.tsx
    PurchaseOrderCard.tsx
    PurchaseOrderPagination.tsx
    PurchasePartySection.tsx
    PurchasePartyForm.tsx
    PurchasePartyList.tsx
    PurchaseImportDialog.tsx
    PurchaseOrderWizard/
      PurchaseOrderWizard.tsx
      SourceModeStep.tsx
      InventoryProductStep.tsx
      NewProductDraftStep.tsx
      VariantSelectorStep.tsx
      PricingMatrixStep.tsx
      ReviewStep.tsx
    ReceiveOrderDialog.tsx
    ReceivePricePreviewTable.tsx
  hooks/
    usePurchasePanelData.ts
    usePurchaseOrderDraft.ts
    useReceivePricePreview.ts
  utils/
    purchaseCalculations.ts
    purchaseMappers.ts
  types.ts
  mockData.ts
```

| Component | Responsibility | Props | State owned? | Notes |
|---|---|---|---|---|
| `PurchasePanelHeader` | title + tab switching | `activeTab,onTabChange` | No | pure presentational |
| `PurchaseOrdersToolbar` | search/filter/sort/CTA actions | controlled values and callbacks | No | reusable controls |
| `PurchaseOrderList` | render paginated order cards | orders/actions | No | delegates card rows |
| `PurchasePartySection` | party tab composition | parties + callbacks | Minimal | combines form/list |
| `PurchaseOrderWizard` | step routing + draft orchestration | open/order data/handlers | Yes | primary local complex state |
| `ReceiveOrderDialog` | method selection + confirm action | open/order/method callbacks | Yes (local method) | critical workflow |
| `ReceivePricePreviewTable` | projection matrix view | preview rows + selected method | No | isolated visual table |

## 12) Theme requirements
- Must support both light and dark mode using existing design tokens/CSS variables.
- Avoid hard-coded low-contrast slate shades; map states to semantic tokens (`surface`, `border`, `muted`, `accent`, `danger`, `success`).
- Status chips for order status should have theme-safe color pairs.
- Tables/cards/modals require consistent elevated surfaces and readable borders in dark mode.
- Disabled and hover states need explicit tokenized classes for accessibility contrast.

## 13) Mock data requirements for Claude
Create mock sets for:
- **Parties**: with/without phone, GST, location, contact person.
- **Products**:
  - simple no-variant product,
  - multi-variant and multi-color product with `stockByVariantColor`,
  - product with missing image.
- **Orders**:
  - `ordered`, `partially_received`, `received`, `cancelled` statuses,
  - inventory-source lines and new-source lines,
  - edge case with large qty/amount,
  - edge case with zero results.
- **Receive preview rows** with all 4 methods and differing outcomes.
- **Wizard draft defaults** for create/edit flows.

## 14) Claude Code generation brief
Use this prompt:

> Build only the **Purchase Panel UI page** for a Next.js App Router app using **TypeScript**.
> 
> Requirements:
> - Component-wise architecture (split into small components).
> - Use **mock data only** (no backend wiring, no API calls, no legacy imports).
> - Recreate the legacy behavior structure: Orders/Parties tabs, orders toolbar (search/filter/sort), order cards, pagination, create/edit order wizard (source/product/variants/pricing/review), create-party modal, import dialog shell, receive dialog with price-method preview table.
> - Preserve key interaction behavior (step gating, totals calculation, line item editing, method selection state).
> - Add UI improvements: clearer validation messages, cleaner spacing hierarchy, less duplication, and better responsiveness.
> - Support **light/dark theme** with semantic tokens/classes.
> - Output file tree first, then code for all files.
> - Do not modify or reference legacy runtime/services.

## 15) Codex integration plan after Claude
1. Place generated files under `frontend/features/procurement/purchase-panel/` and route entry under `frontend/app/procurement/page.tsx` (UI-only swap in isolated frontend workspace).
2. Keep all data mocked locally in the feature folder.
3. Run build-only checks in frontend workspace (`npm run build`) when integration phase starts.
4. Do **not** touch legacy app runtime (`pages/`, `services/storage.ts`, backend wiring) during this UI-only phase.
5. Verify no backend/legacy imports by searching for forbidden paths (`../services/storage`, `../../pages`, etc.).

## 16) Migration readiness verdict
- **Ready for Claude UI generation?** **YES**
- **Blockers:** None for UI-only generation.
- **Warnings:** Receiving/business math is high risk and must remain behaviorally equivalent during later wiring.
- **Recommended next action:** Generate modular Next.js UI with mock data first, then run a separate contract-mapping/wiring pass.
