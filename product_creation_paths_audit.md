# Product Creation Paths Audit (Legacy Root App)

## 1. Executive verdict
- **Active direct product-creation paths:** **2**
- **Active indirect/materialization paths:** **1**
- **Active stock-add-only paths:** **3**
- **Key risky/duplicate areas:**
  - Admin “Add Purchase” immediately updates product stock and also creates a purchase order record (status now `received`)—safe but dual-write complexity remains.
  - Inventory import can both create and update products in bulk, with a different validation surface than manual Admin creation.

---

## 2. Active product creation path table

| Path # | UI/page | User action | Function called | Data written | Creates product? | Adds stock? | Risk | Notes |
|---|---|---|---|---|---|---|---|---|
| D1 | `pages/Admin.tsx` | Save in Add New Product modal | `saveProduct` -> `addProduct` | `products[]` + optional category master checks | Yes | Depends on entered stock | Medium | Canonical manual product creation flow in legacy UI. |
| D2 | `pages/Admin.tsx` via import modal | Upload inventory Excel | `importInventoryFromFile` -> `addProduct` for unmatched barcode rows | `products[]` bulk writes | Yes | Yes if stock in sheet | High | Bulk path bypasses some UI-level progressive checks, relies on import validation rules. |

---

## 3. Indirect materialization path table

| Path # | Trigger | Function called | When product appears in inventory | Required fields | Risk | Notes |
|---|---|---|---|---|---|---|
| I1 | Purchase Panel new-source order received | `receivePurchaseOrder` -> `applyPurchaseLineToProduct` -> `addProduct` | At **receive/finalize** time, not at order draft time | pending barcode/name/category/line qty/unitCost (plus optional draft fields) | High | This is the procurement materialization path; creation deferred until receive. |

---

## 4. Stock-add-only path table

| Path # | UI/page | User action | Function called | Product created? | Stock changed? | Buy price changed? | Purchase history changed? |
|---|---|---|---|---|---|---|---|
| S1 | `pages/Admin.tsx` | Inventory **Add Purchase** for existing product/variant | `handleAddPurchase` -> `updateProduct` | No | Yes | Yes (weighted/manual next buy price) | Yes (`product.purchaseHistory`) |
| S2 | `pages/PurchasePanel.tsx` | Receive inventory-source purchase order | `receivePurchaseOrder` -> `applyPurchaseLineToProduct` -> `updateProduct` | No (inventory lines) | Yes | Yes (method-based) | Yes (`product.purchaseHistory`) |
| S3 | `pages/Admin.tsx` import modal | Import inventory rows matching existing barcode | `importInventoryFromFile` -> `updateProduct` | No | Possibly (if imported stock differs) | Possibly | Possibly |

---

## 5. Import / bulk creation paths
- **Inventory import:** `importInventoryFromFile` supports upsert behavior:
  - existing barcode -> `updateProduct`
  - missing barcode -> `addProduct`
- **Purchase import:** purchase-order import path creates/updates purchase orders; new products are still only materialized later through receive path.
- **Generic upload UI:** `UploadImportModal` is presentational; actual create/update behavior lives in import service callbacks.

---

## 6. Function-level inventory

| Function | File | Called by | Creates product? | Adds stock? | Active UI? | Notes |
|---|---|---|---|---|---|---|
| `addProduct` | `services/storage.ts` | Admin save new product; inventory import; receive new-source materialization | Yes | Can (if stock > 0) | Yes | Core creation primitive in legacy path. |
| `updateProduct` | `services/storage.ts` | Admin edit; Admin add-purchase; inventory import updates; receive inventory-source | No | Yes/No | Yes | Core update primitive; stock/buy-price/purchaseHistory updates here. |
| `saveProduct` | `pages/Admin.tsx` | Admin Save / Save & Next | Yes (new mode) | Yes/No | Yes | Direct manual creation UI wrapper. |
| `handleAddPurchase` | `pages/Admin.tsx` | Admin Add Purchase modal | No | Yes | Yes | Existing-product stock increment path; also creates purchase order record. |
| `createPurchaseOrder` | `services/storage.ts` | PurchasePanel save order; Admin add-purchase parity; purchase import | No direct product create | No direct | Yes | Drives later receive/materialization paths. |
| `receivePurchaseOrder` | `services/storage.ts` | PurchasePanel receive action | Indirect yes (new-source) | Yes | Yes | Central receive path for both stock-only and materialization branches. |
| `applyPurchaseLineToProduct` | `services/storage.ts` | Internal from `receivePurchaseOrder` | Indirect yes | Yes | Indirect | Branches inventory update vs new product add. |
| `importInventoryFromFile` | `services/importExcel.ts` | Admin UploadImportModal callback | Yes (unmatched rows) | Yes/No | Yes | Bulk upsert path. |

---

## 7. Data model comparison
Common fields across creation/materialization:
- `name`, `barcode`, `category`, `stock`, `buyPrice`, `sellPrice`, `image`, `purchaseHistory`, `hsn`

Path differences:
- **Admin direct create (`saveProduct`):** full explicit product form, optional variant/color matrix.
- **Inventory import:** row-driven upsert; field availability depends on template content.
- **PurchasePanel new-source receive materialization:** derives product from pending draft + receive line (`pendingProductDraft`, barcode fallback, qty/unitCost, optional variants/colors/hsn/description/sellPrice).
- **Supplier context:** captured in purchase-party/order layer, not embedded in product entity.

---

## 8. Risk analysis
1. **Multiple creation entry points** (manual, import, receive-materialization) can drift in validation behavior.
2. **Barcode uniqueness surface differs** between manual create/import/materialization timing.
3. **Variant/color normalization** differs by source (manual matrix vs receive draft fallback).
4. **Dual history systems** (`product.purchaseHistory` and purchase-order/payment histories) require careful KPI boundaries.
5. **Bulk import update path** may bypass some interactive safeguards from Admin form.

---

## 9. Simplification recommendation
Future target model:
1. **One canonical direct creation flow** (Admin form) using shared validation helpers.
2. **One canonical import flow** (inventory import) reusing same validators/transforms.
3. **One canonical procurement materialization flow** (new-source receive only).
4. **Stock additions should never create products** except explicit new-source receive path.
5. Centralize barcode + variant/color normalization + purchase-history append policies in shared helpers.

---

## 10. Final answer
- **There are 2 active ways to directly create a product** in the legacy system.
- **There is 1 active indirect/materialization way** for products to appear in inventory.
- **There are 3 active ways to add stock to existing products (without creating new products).**

Exact active paths:
1. Admin manual Add New Product (`saveProduct` -> `addProduct`).
2. Admin Inventory Excel import unmatched rows (`importInventoryFromFile` -> `addProduct`).
3. Indirect materialization via Purchase Panel new-source receive (`receivePurchaseOrder` -> `applyPurchaseLineToProduct` -> `addProduct`).
4. Stock-only: Admin Add Purchase (`updateProduct`), Purchase receive inventory-source (`updateProduct`), Import matched rows (`updateProduct`).

---

**Audit scope confirmation:** legacy root app analyzed; no code/runtime behavior modified.
