import { CustomerDto } from '../../../contracts/v1/customers/customer.types';

export type CustomerDocument = CustomerDto;

export const customerSchemaDefinition = {
  id: 'string',
  storeId: 'string',
  name: 'string',
  phone: 'string',
  email: 'string|null',
  notes: 'string|null',
  isArchived: 'boolean',
  archivedAt: 'string|null',
  version: 'number',
  createdAt: 'string',
  updatedAt: 'string',
} as const;
