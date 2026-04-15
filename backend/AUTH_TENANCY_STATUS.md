# Auth/Tenancy Status (Phase 2C)

## Implemented now (real foundation)
- Auth contracts for login request/response and auth context shape are defined.
- Auth service and token validation abstraction are implemented with a safe static-token validator.
- Auth guard now performs real bearer-token parsing and validation-path enforcement.
- Verified-user policy is implemented through `@RequireVerified()` metadata and guard enforcement.
- Tenancy service resolves store context from allowed stores or authenticated default store.
- Tenant guard now enforces tenant context and access denial behavior.
- Auth and tenancy context decorators are available for controller/service usage.

## Deferred intentionally
- External auth provider integration (Firebase/JWT/OIDC final source).
- Multi-membership/role matrix beyond owner-default baseline.
- Domain-specific permission policies.

## Gate impact
- Advances Auth/Tenancy foundation toward Gate G1 readiness.
- Keeps high-risk business domains deferred by design.
