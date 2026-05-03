# Transaction Phase 3E.1 Final Hardening Review

Date: 2026-04-30
Scope: Sale-only update/delete hardening verification (no scope widening)

## Verdict

## GO / NO-GO for closing Phase 3E.1

**Verdict: NO-GO (close to GO, but missing hardening tests).**

Core sale-only update/delete implementation is present and major invariants are covered, but a few must-have behavior locks are still not explicitly tested in the current suite.

---

## What is verified as implemented and covered

1. **Sale-only guardrails in implementation**
   - `updateTransaction` rejects non-sale transactions.
   - `deleteTransaction` rejects non-sale transactions.

2. **Version conflict behavior**
   - Update and delete conflict paths are implemented and tested.

3. **Stock reapply/reversal behavior**
   - Update reconciliation and delete reversal effects are covered by fixtures/tests.

4. **Customer balance reapply/reversal behavior**
   - Update settlement/customer changes and delete compensation effects are covered.

5. **Deleted snapshot / audit integrity**
   - Archive-delete snapshot integrity test exists and passes.

6. **Idempotency mechanism exists in service**
   - Key-required check, replay handling, and different-payload conflict logic are implemented centrally.

---

## What is missing (must add before closure)

1. **Unsupported payment/return update-delete rejection tests**
   - Implementation guardrails exist, but there are no direct tests proving payment/return update/delete are rejected with the expected error code.

2. **Idempotency replay tests for update/delete**
   - Need explicit tests proving second identical request with same key returns `status: replayed` and does not apply side effects twice.

3. **Idempotency conflict tests for update/delete**
   - Need explicit tests proving same key + different payload returns idempotency key reuse conflict.

4. **Repeated delete behavior tests**
   - Need explicit test for second delete attempt after successful delete (same key replay and/or fresh key not-found path) to lock expected semantics.

5. **Preview/apply parity execution test (if preview execution path is active)**
   - Contracts exist, but no executable parity check observed in current update/delete path tests.

---

## Risk list

1. **Regression risk on idempotency semantics** if replay/conflict behavior is not explicitly test-locked for update/delete.
2. **Boundary erosion risk** if payment/return rejection is not test-locked, allowing future accidental widening.
3. **Operational ambiguity risk** for repeated delete behavior without deterministic test coverage.
4. **Parity drift risk** between preview contracts and apply behavior if preview is introduced/used without parity checks.

---

## Exact next action

Add a narrow **Phase 3E.1 hardening test pack** (tests + fixtures only), no logic rewrite:

1. `update rejects payment type`
2. `update rejects return type`
3. `delete rejects payment type`
4. `delete rejects return type`
5. `update idempotency replay returns replayed and no additional stock/customer mutation`
6. `delete idempotency replay returns replayed and no additional stock/customer/deleted-snapshot mutation`
7. `update idempotency same-key different-payload conflict`
8. `delete idempotency same-key different-payload conflict`
9. `delete repeated with fresh key after archive -> transaction not found`
10. (If applicable) `preview vs apply parity baseline fixture`

After these pass with current behavior preserved, re-run full backend test + build and then mark Phase 3E.1 as GO.

---

## Deferred boundaries confirmed unchanged

- No payment/return update-delete widening.
- No frontend changes.
- No finance formula changes.
- No procurement cutover.
- No API contract changes.
