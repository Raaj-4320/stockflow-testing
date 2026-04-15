import { CreateCustomerDto } from '../../../contracts/v1/customers/create-customer.dto';
import { UpdateCustomerDto } from '../../../contracts/v1/customers/update-customer.dto';

const normalizeText = (value: string): string => value.trim();

const normalizePhone = (phone: string): string => normalizeText(phone).replace(/\s+/g, ' ');

const normalizeEmail = (email: string): string => normalizeText(email).toLowerCase();

export const normalizeCreateCustomerPayload = (payload: CreateCustomerDto): CreateCustomerDto => ({
  ...payload,
  name: normalizeText(payload.name),
  phone: normalizePhone(payload.phone),
  email: payload.email ? normalizeEmail(payload.email) : undefined,
  notes: payload.notes ? normalizeText(payload.notes) : undefined,
});

export const normalizeUpdateCustomerPayload = (payload: UpdateCustomerDto): UpdateCustomerDto => {
  const next: UpdateCustomerDto = { ...payload };

  if (next.name !== undefined) next.name = normalizeText(next.name);
  if (next.phone !== undefined) next.phone = normalizePhone(next.phone);
  if (next.email !== undefined) next.email = normalizeEmail(next.email);
  if (next.notes !== undefined) next.notes = normalizeText(next.notes);

  return next;
};
