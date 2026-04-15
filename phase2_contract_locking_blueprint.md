# Phase 2A — Contract Locking Blueprint

## 1) Objective
Lock API contracts before domain implementation to prevent drift during migration.

## 2) Contract Ownership Model
- Backend owns runtime validation and canonical DTO contracts.
- Frontend consumes generated/mirrored types; must not invent payload fields.
- Contract changes require versioned review and compatibility classification.

## 3) DTO Folder Strategy
```text
src/contracts/v1/
  common/
    error-envelope.dto.ts
    pagination.dto.ts
    idempotency.dto.ts
    request-context.dto.ts
  auth/
  products/
  customers/
  transactions/
  finance/
  procurement/
  reports/
  uploads/
```

## 4) Versioning Strategy
- Base path versioning: `/api/v1`.
- Backward-compatible additions: optional fields only.
- Breaking changes: new endpoint version or explicit opt-in header.
- Deprecation requires migration note + sunset date.

## 5) Error Envelope Lock
Required response shape (all errors):
```json
{
  "code": "STRING_CODE",
  "message": "Human-readable summary",
  "fieldErrors": [{ "field": "string", "message": "string" }],
  "requestId": "uuid",
  "timestamp": "ISO-8601"
}
```

## 6) Unknown-Field Rejection Policy
- Validation pipe runs in whitelist + forbid-non-whitelisted mode.
- Unknown payload fields return `400` with locked envelope.
- Prevent silent acceptance of typo/legacy fields.

## 7) Enum and Compatibility Policy
- Enums are append-only for minor revisions.
- Enum removal/rename is breaking and requires new version.
- Return-mode and payment-method enums are contract-critical.

## 8) Idempotency Header Contract
- Header: `Idempotency-Key` (required on high-impact mutation endpoints).
- Optional: `Idempotency-Window-Seconds` for controlled replay windows.
- Duplicate key + same payload -> same semantic result.
- Duplicate key + different payload -> conflict error code.

## 9) Correlation/Request ID Contract
- Header accepted: `X-Request-Id` (optional client-supplied).
- Backend always emits canonical `requestId` in response and error envelope.
- Audit and logs must include the same `requestId`.

## 10) Frontend/Backend Type Sharing Strategy (Safe)
Recommended order:
1. Backend-first DTO definitions.
2. Generate OpenAPI and derive TS client types.
3. Frontend consumes generated client/types.
4. If shared package is used, treat backend schema as source-of-truth and publish versioned artifacts.

## 11) Contract Lock Acceptance Criteria
- Core v1 DTO folders created.
- Error envelope finalized.
- Unknown field rejection enabled.
- Idempotency and request-ID contracts documented per endpoint group.
