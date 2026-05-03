# Product Creation & Materialization — Current State (Post Freight Receive-to-Inventory)

Date: 2026-05-02  
Scope: Legacy root app runtime (`pages/*`, `services/storage.ts`, `types.ts`) only.

## 1) Executive verdict
- **Verdict: PASS with known guardrail risks.**
- Freight **new-product inquiry** still does **not** create an inventory `Product` at inquiry stage.
- Freight confirmed **new-source** orders now support explicit **Receive into Inventory**.
- `receiveFreightPurchaseIntoInventory` now materializes a real inventory `Product` via `addProduct`.
- Freight purchase and confirmed order are linked via `materializedProductId` / `inventoryProductId`.
- Duplicate materialization and barcode collision are explicitly blocked.
- Build validation currently passes (`npm run build`).

---

## 2) Updated product creation/materialization counts

### Inventory product appearance paths (active legacy runtime)
- **Direct product creation paths:** **2**
  1. Admin/manual create flow -> `addProduct`
  2. Import/upsert create branch -> `addProduct`

- **Delayed materialization paths:** **2**
  1. Purchase Panel receive for `sourceType: new` (`receivePurchaseOrder` -> materialize)
  2. Freight confirmed new-source receive (`receiveFreightPurchaseIntoInventory` -> `addProduct`)

- **Stock-add-only (no new product create) paths:** **3**
  1. Purchase receive for inventory-source line(s)
  2. Freight conversion records (inquiry -> confirmed -> purchase) before receive-materialization
  3. Product update/edit operations that only mutate stock fields for existing products

> Net update vs prior audits: delayed materialization count increases from **1** to **2** because Freight now has explicit receive-time materialization.

---

## 3) Direct product creation paths
1. **Admin Add Product**
   - User saves a new inventory product from Admin UI.
   - Writes through canonical product storage path.

2. **Import create path**
   - Import flow creates missing products through the same canonical add path.

**Expectation:** both result in immediate inventory product visibility after save.

---

## 4) Delayed materialization paths
1. **Purchase Panel new-source receive**
   - Order creation does not add inventory product immediately.
   - Product appears only when receive/finalize is executed.

2. **Freight new-source receive into inventory (new behavior)**
   - Freight inquiry/confirmed/purchase records are procurement-domain records.
   - Inventory product appears only after explicit receive action on confirmed new-source order.

**Expectation:** these paths delay product creation until explicit operational receive.

---

## 5) Stock-add-only paths
- Existing product stock increments on receive for inventory-source flows.
- Freight record lifecycle (inquiry/confirm/purchase conversions) is non-inventory until receive-materialization is called.
- Existing-product maintenance/update routines may adjust stock metadata but do not create new products.

**Expectation:** no new `Product` row is introduced in these branches.

---

## 6) Freight receive-to-inventory flow (current)
1. User opens Freight Orders and clicks **Receive into Inventory** on eligible confirmed order (`source === 'new'`).
2. If needed, confirmed order is converted to freight purchase record.
3. `receiveFreightPurchaseIntoInventory(purchaseId)` validates:
   - purchase exists and is not deleted,
   - source is `new`,
   - not already materialized,
   - valid product name and quantity > 0,
   - generated freight barcode is not colliding.
4. Function builds inventory `Product` payload and calls `addProduct`.
5. Function marks freight purchase `status='received'`, sets:
   - `materializedProductId`, `materializedAt`, `receivedAt`, `inventoryProductId`.
6. Linked confirmed order is updated with `inventoryProductId`.
7. UI reflects success and displays linked Product ID.

**Behavior guarantee now present:** explicit receive-time materialization with lineage linkback.

---

## 7) Purchase Panel receive materialization flow (current)
1. Purchase order with new-source line(s) is authored in Purchase Panel.
2. No inventory product is created at draft/order-creation time.
3. On receive, new-source line(s) are materialized into real `Product` entities.
4. Existing shared product semantics apply post-materialization (edit, search, sale, reporting).

**Parity intent:** purchase new-source and freight new-source now both follow receive-time materialization timing.

---

## 8) Behavior parity expectations
After materialization, products from:
- Admin direct create,
- import create,
- Purchase Panel new-source receive,
- Freight new-source receive

should behave equivalently as inventory entities for:
- listing/search,
- stock accounting,
- sales consumption,
- edit/update,
- reporting surfaces.

Freight-specific parity note:
- Freight remains procurement-domain before receive.
- Only receive step promotes the record to inventory product.

---

## 9) Remaining risks
1. **User expectation risk:** Freight “new product inquiry” wording can still imply immediate product creation.
2. **Generated barcode retry risk:** Freight barcode collision currently hard-fails and requires retry.
3. **Validation surface drift:** direct-create vs receive-materialize paths may diverge over time if rules change in one path only.
4. **Lineage visibility risk:** linkage fields exist, but cross-screen audit visibility may remain limited without dedicated history UI.
5. **Repeat-action UX risk:** duplicate materialization blocked functionally, but UX messaging may need stronger operator guidance.

---

## 10) Manual QA checklist
- [ ] Create Freight inquiry with `source=new`; verify no inventory product appears immediately.
- [ ] Convert to confirmed order; verify still no inventory product appears.
- [ ] Click **Receive into Inventory**; verify product appears in inventory.
- [ ] Verify confirmed order row shows linked Product ID after receive.
- [ ] Attempt second receive/materialize on same freight purchase; verify duplicate block error.
- [ ] Simulate/force barcode collision scenario; verify collision block behavior.
- [ ] Create Purchase Panel new-source order; verify no product before receive.
- [ ] Receive Purchase Panel order; verify product appears and is sellable/editable.
- [ ] Confirm stock-only receive path for existing inventory product does not create extra product row.
- [ ] Run `npm run build` and confirm success.

---

## 11) Confirmation: no Next.js/backend migration code changed
- This current-state update is documentation-only and reflects already-landed legacy runtime behavior.
- No additional Next.js shell migration behavior is introduced by this report.
- No backend migration/cutover semantics are modified by this report.
