import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreatePurchaseOrderDto, ListPurchaseOrdersQueryDto, PurchaseOrderListResponseDto, PurchaseOrderResponseDto, UpdatePurchaseOrderDto } from '../../contracts/v1/procurement/purchase-order.dto';
import { CreatePurchasePartyDto, ListPurchasePartiesQueryDto, PurchasePartyListResponseDto, PurchasePartyResponseDto, UpdatePurchasePartyDto } from '../../contracts/v1/procurement/purchase-party.dto';
import { ReceivePurchaseOrderRequestDto, ReceivePurchaseOrderResponseDto } from '../../contracts/v1/procurement/receive-purchase-order.dto';
import { CurrentTenantContext } from '../tenancy/decorators/current-tenant-context.decorator';
import { ProcurementService } from './procurement.service';

@Controller('procurement')
@UseGuards(AuthGuard, TenantGuard)
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('parties')
  async listParties(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: ListPurchasePartiesQueryDto,
  ): Promise<PurchasePartyListResponseDto> {
    const items = await this.procurementService.listParties(tenantContext.storeId, query);
    return { items };
  }

  @Get('parties/:id')
  async getPartyById(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
  ): Promise<PurchasePartyResponseDto> {
    const party = await this.procurementService.getPartyById(tenantContext.storeId, id);
    return { party };
  }

  @Post('parties')
  async createParty(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Body() payload: CreatePurchasePartyDto,
  ): Promise<PurchasePartyResponseDto> {
    const party = await this.procurementService.createParty(tenantContext.storeId, payload);
    return { party };
  }

  @Patch('parties/:id')
  async updateParty(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
    @Body() payload: UpdatePurchasePartyDto,
  ): Promise<PurchasePartyResponseDto> {
    const party = await this.procurementService.updateParty(tenantContext.storeId, id, payload);
    return { party };
  }

  @Get('orders')
  async listOrders(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: ListPurchaseOrdersQueryDto,
  ): Promise<PurchaseOrderListResponseDto> {
    const items = await this.procurementService.listOrders(tenantContext.storeId, query);
    return { items };
  }

  @Get('orders/:id')
  async getOrderById(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
  ): Promise<PurchaseOrderResponseDto> {
    const order = await this.procurementService.getOrderById(tenantContext.storeId, id);
    return { order };
  }

  @Post('orders')
  async createOrder(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Body() payload: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const order = await this.procurementService.createOrder(tenantContext.storeId, payload);
    return { order };
  }

  @Patch('orders/:id')
  async updateOrder(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
    @Body() payload: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const order = await this.procurementService.updateOrder(tenantContext.storeId, id, payload);
    return { order };
  }

  @Post('orders/:id/receive')
  async receiveOrder(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
    @Body() payload: ReceivePurchaseOrderRequestDto,
  ): Promise<ReceivePurchaseOrderResponseDto> {
    return this.procurementService.receiveOrder(tenantContext.storeId, id, payload);
  }
}
