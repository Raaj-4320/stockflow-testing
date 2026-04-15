# Phase 2A — NestJS Project Structure Blueprint

## 1) Target Foundation Structure
```text
backend/
  package.json
  tsconfig.json
  nest-cli.json
  .env.example

  src/
    main.ts
    app.module.ts

    config/
      config.module.ts
      config.service.ts
      env.schema.ts

    common/
      constants/
      types/
      dto/
      errors/
      middleware/
        request-id.middleware.ts
      guards/
        auth.guard.ts
        tenant.guard.ts
        permissions.guard.ts
      filters/
        global-exception.filter.ts
      interceptors/
        audit.interceptor.ts
      pipes/
        global-validation.pipe.ts
      logger/
        logger.module.ts
        logger.service.ts

    infrastructure/
      mongodb/
        mongodb.module.ts
        mongodb.service.ts
        schema-registry.ts
        index-manager.ts
        repositories/
          base.repository.ts
      idempotency/
        idempotency.module.ts
        idempotency.service.ts
      storage/
        uploads.provider.ts

    modules/
      health/
        health.module.ts
        health.controller.ts

      auth/
        auth.module.ts
        auth.controller.ts
        auth.service.ts
        dto/

      tenancy/
        tenancy.module.ts
        tenancy.service.ts
        tenant-context.ts

      audit/
        audit.module.ts
        audit.service.ts

      products/
      customers/
      transactions/
      finance/
      procurement/
      reports/
      uploads/

    contracts/
      v1/
        common/
        auth/
        products/
        customers/
        transactions/
        finance/
        procurement/
        reports/
        uploads/

  tests/
    unit/
    integration/
    fixtures/
      invariants/
```

## 2) Module Scaffolding Timeline

### Scaffold Now (Phase 2A)
- `health`
- `auth` (skeleton only)
- `tenancy` (skeleton only)
- `audit` (event envelope only)
- `config`
- `common` (guards/filter/pipe/middleware skeletons)
- `infrastructure/mongodb` (connection + registry skeleton)
- `infrastructure/idempotency` (header parsing + store interface skeleton)

### Stub Now, Implement Later (Phase 2B+)
- `products`
- `customers`
- `transactions`
- `finance`
- `procurement`
- `reports`
- `uploads`

## 3) AppModule Import Order (Foundation)
1. `ConfigModule`
2. `LoggerModule`
3. `MongoDbModule`
4. `IdempotencyModule`
5. `AuditModule`
6. `AuthModule`
7. `TenancyModule`
8. `HealthModule`
9. Domain stubs (products/customers/transactions/finance/procurement/reports/uploads)

## 4) Main Bootstrap Responsibilities (`src/main.ts`)
- Load validated env config.
- Set global request ID middleware.
- Set global validation pipe (reject unknown fields).
- Set global exception filter (locked envelope).
- Register structured logger.
- Register versioned global prefix (`/api/v1`).
- Enable CORS/security baselines.
