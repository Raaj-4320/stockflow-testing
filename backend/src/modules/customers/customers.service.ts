import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AuthTenantErrorCode } from '../../contracts/v1/common/error-codes';
import { CreateCustomerDto } from '../../contracts/v1/customers/create-customer.dto';
import { CustomerDto } from '../../contracts/v1/customers/customer.types';
import { ListCustomersQueryDto } from '../../contracts/v1/customers/list-customers-query.dto';
import { UpdateCustomerDto } from '../../contracts/v1/customers/update-customer.dto';
import { normalizeCreateCustomerPayload, normalizeUpdateCustomerPayload } from './helpers/customer-normalizer';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(private readonly repository: CustomersRepository) {}

  async create(storeId: string, payload: CreateCustomerDto): Promise<CustomerDto> {
    const normalized = normalizeCreateCustomerPayload(payload);

    await this.ensureUniqueness(storeId, normalized.phone, normalized.email ?? null, null);

    return this.repository.create(storeId, {
      name: normalized.name,
      phone: normalized.phone,
      email: normalized.email ?? null,
      notes: normalized.notes ?? null,
      dueBalance: 0,
      storeCreditBalance: 0,
    });
  }

  async list(storeId: string, query: ListCustomersQueryDto): Promise<CustomerDto[]> {
    return this.repository.findMany(storeId, query);
  }

  async getById(storeId: string, id: string): Promise<CustomerDto> {
    const customer = await this.repository.findById(storeId, id);
    if (!customer) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.CUSTOMER_NOT_FOUND,
        message: 'Customer not found in this store.',
      });
    }

    return customer;
  }

  async update(storeId: string, id: string, payload: UpdateCustomerDto): Promise<CustomerDto> {
    const existing = await this.repository.findById(storeId, id);
    if (!existing) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.CUSTOMER_NOT_FOUND,
        message: 'Customer not found in this store.',
      });
    }

    if (payload.expectedVersion !== undefined && payload.expectedVersion !== existing.version) {
      throw new ConflictException({
        code: AuthTenantErrorCode.CUSTOMER_VERSION_CONFLICT,
        message: 'Customer version conflict detected.',
      });
    }

    const normalized = normalizeUpdateCustomerPayload(payload);
    await this.ensureUniqueness(
      storeId,
      normalized.phone ?? null,
      normalized.email ?? null,
      existing.id,
    );

    const updateInput: Partial<CustomerDto> = {};
    if (normalized.name !== undefined) updateInput.name = normalized.name;
    if (normalized.phone !== undefined) updateInput.phone = normalized.phone;
    if (normalized.email !== undefined) updateInput.email = normalized.email;
    if (normalized.notes !== undefined) updateInput.notes = normalized.notes;

    if (normalized.archive === true) {
      updateInput.isArchived = true;
      updateInput.archivedAt = new Date().toISOString();
    }

    if (normalized.archive === false) {
      updateInput.isArchived = false;
      updateInput.archivedAt = null;
    }

    const next = await this.repository.update(storeId, id, updateInput);
    if (!next) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.CUSTOMER_NOT_FOUND,
        message: 'Customer not found in this store.',
      });
    }

    return next;
  }

  async archive(storeId: string, id: string): Promise<CustomerDto> {
    const customer = await this.repository.archive(storeId, id);
    if (!customer) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.CUSTOMER_NOT_FOUND,
        message: 'Customer not found in this store.',
      });
    }

    return customer;
  }

  private async ensureUniqueness(
    storeId: string,
    phone: string | null,
    email: string | null,
    ignoreCustomerId: string | null,
  ): Promise<void> {
    if (phone) {
      const phoneMatch = await this.repository.findByPhone(storeId, phone);
      if (phoneMatch && phoneMatch.id !== ignoreCustomerId && !phoneMatch.isArchived) {
        throw new ConflictException({
          code: AuthTenantErrorCode.CUSTOMER_DUPLICATE_PHONE,
          message: 'Phone already exists in this store.',
        });
      }
    }

    if (email) {
      const emailMatch = await this.repository.findByEmail(storeId, email);
      if (emailMatch && emailMatch.id !== ignoreCustomerId && !emailMatch.isArchived) {
        throw new ConflictException({
          code: AuthTenantErrorCode.CUSTOMER_DUPLICATE_EMAIL,
          message: 'Email already exists in this store.',
        });
      }
    }
  }
}
