# Procurement Phase 5C.4 — Shadow Mode Results Audit Template

Date: ____________________  
Operator: ____________________  
Environment: ____________________

## 1) Executive verdict template
- **Execution Status:** `PASS` / `FAIL` / `NOT RUN`
- **Summary Note:** ________________________________________________

## 2) Required env flags used
Record exact frontend flags during run:
- `VITE_PROCUREMENT_BACKEND_ENABLED=false`
- `VITE_PROCUREMENT_SHADOW_COMPARE=true`
- Additional env/context notes: ____________________________________

## 3) Manual flow checklist
Mark each as ✅ / ❌ / N/A and add notes.

| Flow | Status | Notes |
|---|---|---|
| Load Purchase Panel |  |  |
| List parties |  |  |
| List orders |  |  |
| Create party (legacy UI) |  |  |
| Create order (legacy UI) |  |  |
| Edit order (legacy UI) |  |  |
| Receive inventory-source order (legacy UI) |  |  |
| Receive new-source order (legacy UI) |  |  |

## 4) Log capture section
Capture and attach representative console outputs.

### `[PROCUREMENT][SHADOW][SUCCESS]`
- Count observed: ______
- Sample payload(s):
  - ________________________________________________
  - ________________________________________________

### `[PROCUREMENT][SHADOW][MISMATCH]`
- Count observed: ______
- Sample payload(s):
  - ________________________________________________
  - ________________________________________________

### `[PROCUREMENT][SHADOW][ERROR]`
- Count observed: ______
- Sample payload(s):
  - ________________________________________________
  - ________________________________________________

## 5) Mismatch table
Fill one row per observed mismatch.

| Flow | Expected legacy count | Backend count | Missing IDs | Severity (Low/Med/High) | Decision (Accept/Investigate/Block) |
|---|---:|---:|---|---|---|
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

## 6) Cutover readiness decision
- **Decision:** `GO` / `NO-GO`
- **Reasoning:** ________________________________________________

## 7) NO-GO conditions
Mark any triggered conditions.

- [ ] Repeated `[PROCUREMENT][SHADOW][MISMATCH]` under stable test data.
- [ ] Repeated `[PROCUREMENT][SHADOW][ERROR]` due to backend unavailability.
- [ ] Party count drift not explainable by test timing.
- [ ] Order count drift not explainable by test timing.
- [ ] Receive state mismatch (legacy vs backend expectation).
- [ ] UI slowdown, freeze, or user-visible errors during shadow run.

Additional NO-GO notes: ____________________________________________

## 8) Rollback confirmation
- `VITE_PROCUREMENT_SHADOW_COMPARE=false` applied after test (if required): `YES / NO`
- Frontend restarted/rebuilt after rollback toggle: `YES / NO`
- Post-rollback legacy UI sanity check completed: `YES / NO`

## 9) Exact next phase recommendation
Choose one and provide details:
1. **Proceed to guarded canary planning** (if GO with clean/acceptable parity).
2. **Repeat shadow run with expanded dataset** (if inconclusive).
3. **Block and remediate parity mismatches** (if NO-GO).

Recommendation detail:
____________________________________________________________________
____________________________________________________________________

---
Template note: This document is for recording shadow verification outcomes only and does not perform or authorize frontend cutover by itself.
