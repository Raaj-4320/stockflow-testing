# Customers Baseline Fixture Payloads

Low-risk identity/profile-only customer invariants:
- valid create
- duplicate phone/email rejection in same store
- cross-store duplicate allowance
- tenant isolation read behavior
- archive behavior
- malformed payload validation rejection
- optimistic version conflict handling

No ledger/payment/transaction semantics are included.
