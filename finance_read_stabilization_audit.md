# Finance Read Stabilization Audit

Date: 2026-04-30  
Phase Context: Post-Phase-4C (Mongo read rollout readiness validated)

## 1. Executive verdict

The current finance read model is **serviceable and intentionally conservative**, with explicit separation between:
- read-only summary/mix/reconciliation surfaces,
- source-domain activation visibility, and
- deferred formula integration areas.

This is a healthy state for stabilization: the system is not trying to do full accounting truth prematurely, and it exposes assumptions/exclusions directly in response contracts.

**Verdict:** GO for finance read stabilization audit/hardening work (documentation/tests/observability), with strict freeze on write-path or formula rewrites.

---

## 2. Finance endpoints inventory

Controller base: `GET/POST finance/*` under auth + tenant guards.

### Read endpoints
- `GET /finance/summary`
  - Returns v1-style settlement-window summary and customer balance snapshot semantics.
- `GET /finance/v2/summary`
  - Returns pilot v2 summary with rollout/diagnostic metadata.
- `GET /finance/payment-mix`
  - Channel inflow/outflow composition (cash/online).
- `GET /finance/reconciliation-overview`
  - Reconciliation-oriented rollup view.
- `GET /finance/expenses`
- `GET /finance/expenses/summary`
- `GET /finance/sessions`
- `GET /finance/sessions/:id`
- `GET /finance/delete-compensations`
- `GET /finance/delete-compensations/summary`
- `GET /finance/delete-compensations/:id`
- `GET /finance/update-corrections`
- `GET /finance/update-corrections/summary`
- `GET /finance/update-corrections/:id`
- `GET /finance/corrections/artifacts`
- `GET /finance/corrections/overview`

### Write-adjacent endpoints present but out-of-scope for this phase
- `POST /finance/expenses`
- `POST /finance/sessions`

These exist in controller, but this audit keeps finance **read stabilization only**.

---

## 3. Source-domain dependency map

`FinanceModule` imports the following domains:
- `TransactionsModule`
- `CustomersModule`
- `ExpensesModule`
- `CashSessionsModule`
- `FinanceArtifactsModule`
- auth/tenancy wrappers

### Service-level data dependencies (finance summary path)
- Transactions: window-filtered transaction stream
- Customers: full snapshot (including archived for balance aggregate context)
- Expenses: window-filtered expense set

### Artifact dependencies
- Delete compensation artifacts
- Update correction artifacts

### Boundary observation
Finance read currently consumes these domains primarily via repository/services as source inputs, but **selectively applies** them in formulas depending on endpoint/version.

---

## 4. Formula/component map

## `getSummary` (v1-like)
Primary components:
- Transaction counts by type (`sale`, `payment`, `return`, `other`)
- Settlement-driven totals:
  - gross sales
  - returns
  - net sales
  - cash/online in/out
  - provisional `creditDueNet`
- Customer balances snapshot aggregate

Semantics are explicit that this is not full ledger replay.

## `getSummaryV2` (pilot)
Primary components:
- gross sales, returns, net sales
- payment inflow
- customer due/store credit snapshots
- expenses total
- operating net before corrections
- differential diagnostics vs v1 behavior (feature-flag/threshold aware)

V2 includes rollout metadata and warnings indicating pilot status.

## `getPaymentMix`
Primary components:
- inflow cash/online from sale+payment
- outflow cash/online from return
- net channel deltas

---

## 5. Included vs excluded finance logic

## Included now
- Transaction settlement read aggregation
- Customer due/store-credit **snapshot** aggregation
- Expense totals (in v2)
- Artifact retrieval/summaries as source surfaces
- Guarded/tenant-scoped finance read endpoints

## Explicitly excluded/deferred in formulas
- Cash-session opening/closing blending into summary truth
- Delete-compensation formula integration
- Update-correction delta integration into base formulas
- Canonical ledger replay for due/store-credit movements
- Full accounting truth claims

This explicit exclusion posture is correct for staged migration safety.

---

## 6. Transaction-to-finance dependency boundary

Current boundary is mostly healthy:
- Transactions remain the primary movement source for sales/returns/payments in finance summaries.
- Finance does **not** mutate transaction state in read endpoints.
- Finance formulas consume transaction settlement snapshots with clearly documented interpretation limits.
- Artifacts (delete compensation/update corrections) are source-visible but not blindly merged into core formulas yet.

This avoids premature coupling and keeps migration reversible.

---

## 7. Risks and unknowns

1. **Semantic drift risk (v1 vs v2):**
   V2 intentionally differs in treatment of certain flows; requires strict communication and controlled consumer rollout.

2. **Snapshot-vs-ledger confusion risk:**
   Customer balances are snapshot aggregates, not window movement replay. Can be misinterpreted without dashboard labeling.

3. **Partial integration risk:**
   Source domains (cash sessions, compensation artifacts, update corrections) are available but not fully blended in formulas; users may assume they are fully accounted for.

4. **Operational visibility dependency:**
   Continued reliance on Phase 4C observability discipline is important when finance consumers increase.

5. **Boundary erosion risk:**
   Pressure to “just include everything” can cause unsafe formula changes before invariants/tests are frozen.

---

## 8. What must remain frozen

- No frontend changes.
- No finance write-path migration in this step.
- No API contract changes for finance endpoints.
- No widening of payment/return update-delete scope.
- No procurement cutover.
- No formula rewrite.
- No generic abstraction layer expansion.

---

## 9. Simplification recommendations

1. **Keep formula surfaces explicit, not clever.**
   Maintain endpoint-level semantics and exclusions in response payloads.

2. **Prefer additive diagnostics over formula mutation.**
   If uncertainty exists, add flags/diagnostics docs/tests first rather than changing math.

3. **Stabilize naming and sign conventions before any blend expansion.**
   Preserve current sign-policy and window-policy declarations.

4. **Test fixtures before scope expansion.**
   Add/refresh finance read invariants for included/excluded behavior expectations.

5. **Avoid cross-domain orchestration engine work.**
   Do not introduce a generic “finance aggregator framework” now.

---

## 10. Next safest Codex task

Create a **finance read invariants hardening pack** (tests + fixture refresh only) that:
- validates current v1 and v2 semantics exactly as documented,
- validates included/excluded domain behavior remains unchanged,
- validates transaction/customer/expense/artifact source-status fields,
- does not alter formulas,
- does not touch frontend or write paths.

This is the safest bridge from Phase 4C rollout stability into finance implementation planning.

---

## Alignment with Phase 4C runbook

This audit remains compliant with Phase 4C operational constraints:
- read-path focus,
- no frontend/write/API-contract changes,
- operational discipline over feature expansion.
