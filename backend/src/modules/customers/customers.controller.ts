import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateCustomerDto } from '../../contracts/v1/customers/create-customer.dto';
import { CustomerListResponseDto, CustomerResponseDto } from '../../contracts/v1/customers/customer-response.dto';
import { ListCustomersQueryDto } from '../../contracts/v1/customers/list-customers-query.dto';
import { UpdateCustomerDto } from '../../contracts/v1/customers/update-customer.dto';
import { CurrentTenantContext } from '../tenancy/decorators/current-tenant-context.decorator';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(AuthGuard, TenantGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async create(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Body() payload: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.create(tenantContext.storeId, payload);
    return { customer };
  }

  @Get()
  async list(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: ListCustomersQueryDto,
  ): Promise<CustomerListResponseDto> {
    const customers = await this.customersService.list(tenantContext.storeId, query);
    return { customers };
  }

  @Get(':id')
  async getById(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.getById(tenantContext.storeId, id);
    return { customer };
  }

  @Patch(':id')
  async update(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
    @Body() payload: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.update(tenantContext.storeId, id, payload);
    return { customer };
  }

  @Post(':id/archive')
  async archive(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.archive(tenantContext.storeId, id);
    return { customer };
  }
}
