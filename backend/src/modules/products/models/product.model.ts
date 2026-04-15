import { ProductDto } from '../../../contracts/v1/products/product.types';

export type ProductDocument = ProductDto;

// Baseline schema descriptor for migration-safe Mongo alignment.
// Real mongoose schema wiring is deferred to a dedicated infra phase.
export const productSchemaDefinition = {
  id: 'string',
  storeId: 'string',
  name: 'string',
  barcode: 'string',
  category: 'string',
  imageUrl: 'string|null',
  buyPrice: 'number',
  sellPrice: 'number',
  stock: 'number',
  variants: 'string[]',
  colors: 'string[]',
  stockByVariantColor: 'array<{variant:string,color:string,stock:number}>',
  isArchived: 'boolean',
  archivedAt: 'string|null',
  version: 'number',
  createdAt: 'string',
  updatedAt: 'string',
} as const;
