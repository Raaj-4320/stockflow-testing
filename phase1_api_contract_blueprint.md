# Phase 1 — API Contract Blueprint

## Global API Conventions
- Base path: `/api/v1`
- Auth: Bearer JWT (or httpOnly session cookie)
- Tenant: derived from token claim (`storeId`) and/or explicit header validated server-side
- Standard error envelope:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable",
    "details": [{"field":"...","message":"..."}],
    "requestId": "uuid"
  }
}
```

- Pagination/filter/sort query pattern:
  - `page`, `limit`, `sortBy`, `sortDir`, `q`, `from`, `to`, domain filters.

## 1) Auth

### Endpoint Groups
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/resend-verification`
- `POST /auth/reset-password`

### DTOs
- `LoginRequestDto`: `{ email, password }`
- `AuthResponseDto`: `{ accessToken, refreshToken?, user: { id, email, verified, storeId } }`
- `RegisterRequestDto`: `{ name, email, password }`

### Validation
- email format, password min length, normalized email lowercase.

## 2) Products

### Endpoint Groups
- `GET /products`
- `POST /products`
- `GET /products/:id`
- `PATCH /products/:id`
- `DELETE /products/:id`
- `POST /products/categories`
- `PATCH /products/categories/:id`
- `DELETE /products/categories/:id`

### Core DTOs
- `CreateProductDto`:
  - `name`, `barcode`, `category`, `buyPrice`, `sellPrice`, `stock`,
  - `variants[]`, `colors[]`, `stockByVariantColor[]`, `imageUrl?`
- `UpdateProductDto`: partial of create + optimistic concurrency field `version?`.
- `ProductResponseDto`: canonical product payload + timestamps.

### Idempotency
- Optional on create/import operations using `Idempotency-Key`.

## 3) Customers

### Endpoint Groups
- `GET /customers`
- `POST /customers`
- `GET /customers/:id`
- `PATCH /customers/:id`
- `DELETE /customers/:id`
- `POST /customers/:id/payments`
- `POST /customers/:id/upfront-orders`

### Core DTOs
- `CreateCustomerDto`: `{ name, phone }`
- `CustomerPaymentDto`: `{ amount, method, note? }`
- `CustomerResponseDto`: includes `totalSpend`, `totalDue`, `storeCredit`, `visitCount`.

## 4) Transactions

### Endpoint Groups
- `GET /transactions`
- `POST /transactions`
- `GET /transactions/:id`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`
- `GET /transactions/deleted`

### Core DTOs
- `CreateTransactionDto`:
  - `type: sale|return|payment`
  - `items[]`
  - `paymentMethod`
  - `storeCreditUsed?`
  - `returnHandlingMode?`
  - `saleSettlement?`
  - `customerId?`, `notes?`, `date?`
- `UpdateTransactionDto`: editable subset + reconciliation intent metadata.
- `DeleteTransactionDto`: `{ reason, reasonNote?, compensationMode?, compensationAmount? }`

### Validation Rules
- type/payment compatibility
- positive quantities/amounts
- stock availability for sale
- return mode constraints

### Idempotency
- Required for POST/PATCH/DELETE mutation endpoints.

## 5) Finance

### Endpoint Groups
- `GET /finance/cashbook`
- `GET /finance/summary`
- `POST /finance/shifts/open`
- `POST /finance/shifts/:id/close`
- `PATCH /finance/shifts/:id/opening-balance`
- `POST /finance/expenses`
- `DELETE /finance/expenses/:id`

### DTOs
- `OpenShiftDto`: `{ openingBalance }`
- `CloseShiftDto`: `{ closingBalance, denominationCounts? }`
- `CreateExpenseDto`: `{ title, amount, category, note?, createdAt? }`

## 6) Procurement

### Endpoint Groups
- Freight inquiry:
  - `GET /procurement/freight-inquiries`
  - `POST /procurement/freight-inquiries`
  - `PATCH /procurement/freight-inquiries/:id`
  - `POST /procurement/freight-inquiries/:id/convert-confirmed`
- Confirmed order/purchase:
  - `GET /procurement/confirmed-orders`
  - `GET /procurement/purchases`
  - `POST /procurement/purchases/:id/receive`
- Parties/orders:
  - `GET/POST/PATCH /procurement/parties`
  - `GET/POST/PATCH /procurement/purchase-orders`

### DTO Notes
- Must include immutable lineage references (`sourceInquiryId`, `sourceConfirmedOrderId`, `sourceProductId`).

## 7) Reports

### Endpoint Groups
- `GET /reports/transactions/export`
- `GET /reports/customers/export`
- `GET /reports/inventory/export`
- `GET /reports/cashbook/export`

### Response Strategy
- Async export job for large datasets (`202 Accepted` + `jobId`) optionally.
- Small exports can return direct file stream.

## 8) Uploads

### Endpoint Groups
- `POST /uploads/sign` (Cloudinary or storage provider signature)
- `POST /uploads/complete` (optional metadata finalize callback)

### DTOs
- `SignUploadRequestDto`: `{ resourceType, folder, mimeType, checksum? }`
- `SignUploadResponseDto`: provider-specific signature payload.

## Contract Preservation Notes
- Preserve existing settlement/return semantics in transaction DTOs.
- Include explicit fields for audit and reconciliation context.
- Keep response DTOs stable and versioned to avoid frontend drift.
