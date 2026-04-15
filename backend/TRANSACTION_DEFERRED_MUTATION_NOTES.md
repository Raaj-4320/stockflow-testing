# Transaction Deferred Mutation Notes (Phase 3A)

The following remain intentionally unsafe/deferred and are NOT implemented:

1. Transaction create path
2. Transaction update path
3. Transaction delete path
4. Settlement computation logic
5. Return allocation logic
6. Stock mutation side effects
7. Customer due/store-credit side effects
8. Update/delete reconciliation engine
9. Delete compensation behavior
10. Finance/cashbook downstream impacts

## Read-model boundary
Current transaction module is read-only and should not be interpreted as mutation behavior parity.

## Entry criteria for next transaction phase
- Explicit mutation contracts designed and reviewed.
- Fixture plan for create + reconciliation + delete compensation approved.
- Cross-domain boundary check with products/customers/finance owners completed.
