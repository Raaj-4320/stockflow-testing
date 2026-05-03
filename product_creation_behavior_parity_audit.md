# Product Creation Behavior Parity Audit (Legacy Root App)

## 1. Executive verdict
- **Purchase Panel materialized products vs Admin products:** **Mostly equivalent with minor normalization gap fixed** (timestamp normalization at add/update).
- **Freight-created records vs Admin products:** **Not inventory-equivalent**; freight creates freight-domain entities, not `Product` records.
- **Import-created products vs Admin products:** **Mostly equivalent** via shared `addProduct`/`updateProduct` paths, with importer-specific validation surface.
- **GO / NO-GO:** **GO (with minor fix applied)** for parity between Admin/Purchase/Import inventory-product paths.

---

## 2. Baseline canonical product shape (Admin Add Product)
Admin direct create builds a `Product` with:
- identity: `id`, `barcode`, `name`
- classification: `category`, optional `hsn`
- pricing: `buyPrice`, `sellPrice`
- inventory: `stock`, optional `variants/colors`, optional `stockByVariantColor`
- media/details: `image`, `description`
- counters/history: optional `totalPurchase`, `totalSold`, optional `purchaseHistory`
- now normalized through storage add/update path for timestamp consistency (`createdAt` defaults in add, `updatedAt` on update).

---

## 3. Purchase Panel materialized product shape (field comparison)

| Field | Admin Add Product | Purchase Panel Materialization | Same? | Risk | Fix needed? |
|---|---|---|---|---|---|
| id | explicit UI-generated | generated in receive materialization | Yes | Low | No |
| name | required input | from pending line `productName` | Yes | Medium (depends on draft quality) | No |
| barcode | explicit/generated | pending barcode fallback generated | Yes | Medium (dup risk by path timing) | No |
| category | required in Admin | from line/pending, fallback `Uncategorized` | Mostly | Medium | No |
| hsn | optional | from pending draft | Yes | Low | No |
| description | optional | from pending draft | Yes | Low | No |
| image | optional image | line image/pending carried | Yes | Low | No |
| stock | explicit initial | set from receive qty | Yes | Low | No |
| variants/colors | form matrix | pending arrays or line fallback | Mostly | Medium normalization risk | No |
| stockByVariantColor | form-driven matrix | created for variant lines | Mostly | Medium | No |
| buyPrice | explicit | from receive line unit cost / method context | Compatible | Low | No |
| sellPrice | explicit | pending/default derivation | Compatible | Medium | No |
| purchaseHistory | optional at create | initialized at receive | Yes | Low | No |
| createdAt/updatedAt | set in admin payload or now storage default | now normalized by storage add/update | Yes | Low | **Fixed** |

---

## 4. Import-created product shape (field comparison)

| Field | Admin Add Product | Import Create | Same? | Risk | Fix needed? |
|---|---|---|---|---|---|
| Core identity/name/barcode | UI validated | file-validated then `addProduct` | Yes | Medium (source file quality) | No |
| category/hsn | UI fields | row fields | Yes | Medium | No |
| pricing/stock | UI fields | row numeric parse/validation | Yes | Medium | No |
| variants/colors buckets | UI matrix | row-driven payload | Mostly | Medium | No |
| image | upload/url with helper | import image resolution helper | Yes | Medium | No |
| purchaseHistory | not required | generally absent at import create | Acceptable | Low | No |
| timestamps | via UI payload / storage | now storage normalized | Yes | Low | **Fixed** |

---

## 5. Freight flow product shape
- **Does Freight ever create inventory `Product` directly?** **No (in active legacy UI/storage flow).**
- Freight creates/updates freight-domain records (`FreightInquiry`, `FreightConfirmedOrder`, `FreightPurchase`) and references product-like fields there.
- Therefore freight records are **not inventory products** and do not require inventory-product parity unless a future explicit freight-to-inventory conversion is introduced.

---

## 6. Behavior parity matrix

| Behavior | Admin-created | Purchase-created (new-source receive) | Import-created | Freight-created | Verdict |
|---|---|---|---|---|---|
| Inventory visibility | Yes immediate | Yes after receive | Yes after import | No | Expected |
| Search/filter | Yes | Yes | Yes | N/A | Parity OK |
| Editability in Admin | Yes | Yes | Yes | No (not product) | Parity OK |
| POS/Sales compatibility | Yes | Yes | Yes | No | Parity OK |
| Barcode compatibility | Yes | Yes (pending/fallback) | Yes | No | Mostly OK |
| Variant/color stock compatibility | Yes | Mostly yes | Mostly yes | No | Acceptable |
| Add Purchase compatibility | Yes | Yes | Yes | No | Parity OK |
| purchaseHistory compatibility | Yes (when purchases happen) | Yes at receive | May start empty | No | Parity OK |
| Reports/analytics compatibility | Yes | Yes | Yes | No | Parity OK |
| Image compatibility | Yes | Yes | Yes | Freight photo only | Parity OK |
| Import/export compatibility | Yes | Yes | Yes | N/A | Parity OK |

---

## 7. Flow breakers / parity gaps found
1. **Freight expectation gap:** “new product inquiry” is not inventory product creation.
2. **Normalization gap (fixed):** products created through some paths could miss consistent timestamp metadata defaults.
3. **Validation surface differences:** Admin vs Purchase receive vs Import have different timing and strictness (not a blocker, but a parity risk).

---

## 8. Minimal fixes applied
Applied minimal storage normalization only:
- `addProduct`: default `createdAt` when absent.
- `updateProduct`: set `updatedAt` on writes.

No UI redesign, no flow rewrites, no finance/transaction logic changes.

---

## 9. Tests/manual validation checklist
1. Create product in Admin; verify inventory visibility/search/edit/POS sale.
2. Create new-source order in Purchase Panel; receive; verify product appears and is editable/sellable.
3. Import product file with a new barcode; verify create path behavior.
4. For all three created products: run Add Purchase and verify stock/purchaseHistory updates.
5. Check Product Analytics/Reports visibility for all three.
6. Verify barcode/image/variant behavior consistency by product source.
7. Confirm Freight “new product inquiry” does not show in inventory products unless explicitly converted by future feature.

---

## 10. Final answer
- **Purchase Panel-created products are equivalent enough for active legacy operations** because they are materialized into normal `Product` entities at receive and then flow through the same update/sell/report paths.
- **Freight-created records are not inventory products** because FreightBooking writes freight-domain entities, not `Product` rows.
- **Import-created products are mostly equivalent** because they ultimately use `addProduct`/`updateProduct`, with importer-specific validation.
- **Fixes applied:** timestamp normalization in `addProduct`/`updateProduct` for consistent product metadata across creation/materialization paths.
