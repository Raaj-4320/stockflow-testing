# Procurement Phase 5C.3 — Shadow Mode Verification Runbook

Date: 2026-04-30  
Scope: Manual verification for shadow mode only. No cutover.

## 1) Required env flags
Set frontend environment:
- `VITE_PROCUREMENT_BACKEND_ENABLED=false`
- `VITE_PROCUREMENT_SHADOW_COMPARE=true`

Expected behavior with these flags:
- Legacy Purchase Panel storage path remains source of truth.
- Backend procurement calls are comparison-only.
- UI should not render from backend responses.

## 2) Backend requirement
Before running UI verification:
1. Backend service must be running and reachable from frontend.
2. Procurement APIs must be available:
   - `GET /procurement/parties`
   - `GET /procurement/orders`
   - other procurement endpoints present (for readiness confidence).

## 3) Manual test flows
Execute in order:
1. **Load Purchase Panel**
   - Open Purchase Panel page.
   - Confirm page loads normally with no blocking errors.
2. **List parties**
   - Navigate/observe parties list.
   - Confirm legacy data renders.
3. **List orders**
   - Navigate/observe orders list.
   - Confirm legacy data renders.
4. **Create party through legacy UI**
   - Add a new party in UI.
   - Confirm it appears immediately in list.
5. **Create order through legacy UI**
   - Create draft/placed order.
   - Confirm order appears in list.
6. **Edit order through legacy UI**
   - Update notes/bill metadata or lines as allowed.
   - Confirm UI updates successfully.
7. **Receive inventory-source order through legacy UI**
   - Complete receive flow with a buy-price method.
   - Confirm status changes and stock-impact behavior remains unchanged.
8. **Receive new-source order through legacy UI**
   - Complete receive flow for pending new product line.
   - Confirm materialization behavior remains unchanged.

## 4) Logs to watch
Use browser console filters for:
- `[PROCUREMENT][SHADOW][SUCCESS]`
- `[PROCUREMENT][SHADOW][MISMATCH]`
- `[PROCUREMENT][SHADOW][ERROR]`

Interpretation:
- `SUCCESS`: counts and key IDs matched for parties/orders snapshot.
- `MISMATCH`: count drift or missing key IDs detected.
- `ERROR`: backend unavailable/unreachable; legacy UI should continue unaffected.

## 5) NO-GO conditions for cutover
Treat any of the following as NO-GO for cutover execution:
1. Repeated `MISMATCH` logs across stable test data.
2. Repeated `ERROR` logs caused by backend unavailability.
3. Party count drift between legacy and backend snapshots.
4. Order count drift between legacy and backend snapshots.
5. Receive status mismatch (legacy order state vs backend expectation).
6. UI slowdown, freeze, or user-visible errors during shadow runs.

## 6) Rollback
Immediate rollback for shadow verification issues:
- Set `VITE_PROCUREMENT_SHADOW_COMPARE=false`.
- Rebuild/restart frontend.

This disables shadow comparison while preserving existing legacy behavior.

---
Runbook confirmation: this process validates shadow-mode safety only and does not perform frontend cutover.
