# Phase 2A — Backend Bootstrap Checklist

## Status Legend
- **Mandatory now**: required to complete Phase 2A.
- **Can wait**: safe to defer to Phase 2B.
- **Blocked by domain**: requires domain logic decisions later.

| Checklist Item | Status | Notes |
|---|---|---|
| Create backend folder/workspace | Mandatory now | Isolate backend from current runtime.
| Initialize NestJS project + TypeScript baseline | Mandatory now | Keep minimal dependencies.
| Package scripts (`start:dev`, `build`, `test`, `lint`) | Mandatory now | Foundation CI hooks.
| Env schema file (`env.schema.ts`) | Mandatory now | Fail-fast startup.
| Config module + typed config service | Mandatory now | Single config access path.
| Structured logger bootstrap | Mandatory now | Include request correlation fields.
| Request ID middleware scaffold | Mandatory now | Required for auditing and traceability.
| Global validation pipe scaffold | Mandatory now | Unknown field rejection baseline.
| Global exception filter scaffold | Mandatory now | Locked error envelope.
| Auth guard scaffold | Mandatory now | Skeleton only; no business auth migration.
| Tenant guard scaffold | Mandatory now | Enforce store-scoped request contract.
| Permissions guard scaffold | Can wait | Optional until role granularity needed.
| Idempotency middleware scaffold | Mandatory now | Header parsing + key store interface only.
| Health module/controller scaffold | Mandatory now | Liveness/readiness path.
| MongoDB connection scaffold | Mandatory now | Connection + lifecycle + health probe.
| Schema registry skeleton | Mandatory now | Domain schema registration contract.
| Index manager skeleton | Can wait | Start with dry-run logging mode.
| Base repository abstraction | Can wait | Add once first domain starts.
| Audit interceptor scaffold | Mandatory now | Event envelope and request metadata only.
| Upload provider abstraction | Can wait | Needed before upload module.
| Test harness scaffold (unit + integration) | Mandatory now | Include bootstrap tests.
| Invariant fixtures directory structure | Mandatory now | Data-only fixtures in repo.
| Domain module stubs (products/customers/...) | Mandatory now | Empty modules only.
| Domain service implementation | Blocked by domain | Phase 2B+ after gates.
| Transaction/finance/procurement business logic | Blocked by domain | Must wait for invariant fixtures.

## Exit Checklist (All required)
- All “Mandatory now” items complete.
- No blocked domain logic accidentally implemented.
- CI can run bootstrap tests and contract checks.
