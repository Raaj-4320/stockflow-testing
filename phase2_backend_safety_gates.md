# Phase 2A — Backend Safety Gate Matrix

## Gate Definitions

| Gate | Prerequisites | Blocking Risks | Pass Conditions | Evidence Required |
|---|---|---|---|---|
| G0: Bootstrap Gate | backend scaffold + config/logger/health + validation/filter | unstable startup, no observability | app boots in all envs; health endpoint works; error envelope stable | bootstrap test logs, health checks, CI pass |
| G1: Auth/Tenant Gate | auth guard + tenant guard + tenant context contract | auth/rules parity loss, cross-tenant leak | protected route rejects unauth; tenant mismatch blocked; verified policy enforced | integration tests for auth+tenant failures/success |
| G2: Contract Lock Gate | v1 DTOs + unknown-field rejection + error code catalog | payload drift, frontend/backend mismatch | contracts frozen and published; unknown fields rejected deterministically | OpenAPI snapshot + validation tests |
| G3: Invariant Fixture Gate | fixture suites defined + harness runnable | blind logic regression | required fixture groups run and baseline snapshots approved | fixture run artifacts and signed baseline |
| G4: Transaction Create Gate | G1/G2/G3 + settlement/stock fixtures green | settlement and stock corruption | create-path fixtures pass with parity to baseline | tx fixture report + parity matrix |
| G5: Transaction Update/Delete Gate | G4 + update/delete fixtures + audit envelope | reconciliation drift, forensic gaps | update/delete fixtures pass incl archive/compensation | reconciliation diff reports + audit tests |
| G6: Finance Gate | G5 + shift/cashbook fixtures | formula drift and close mismatch | shift close and cashbook fixtures pass | finance fixture outputs + reviewer signoff |
| G7: Procurement Gate | G5 + lineage/receive fixtures | lineage break, stock/cost drift | lineage immutability and receive effects fixtures pass | procurement fixture report |
| G8: Migration Adapter Gate | G1-G7 + compatibility endpoints + rollback toggles | unsafe cutover and recovery failure | adapter contract tests pass; rollback tested | adapter test run + rollback drill notes |

## Gate Policy
- No bypass for G1, G2, G3.
- High-risk domains cannot start before prerequisite gates pass.
- Gate evidence must be stored in CI artifacts and linked in release notes.
