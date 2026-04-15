import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateProductDto } from '../../contracts/v1/products/create-product.dto';
import { ListProductsQueryDto } from '../../contracts/v1/products/list-products-query.dto';
import { ProductListResponseDto, ProductResponseDto } from '../../contracts/v1/products/product-response.dto';
import { UpdateProductDto } from '../../contracts/v1/products/update-product.dto';
import { CurrentTenantContext } from '../tenancy/decorators/current-tenant-context.decorator';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(AuthGuard, TenantGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Body() payload: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.create(tenantContext.storeId, payload);
    return { product };
  }

  @Get()
  async list(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductListResponseDto> {
    const products = await this.productsService.list(tenantContext.storeId, query);
    return { products };
  }

  @Get(':id')
  async getById(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.getById(tenantContext.storeId, id);
    return { product };
  }

  @Patch(':id')
  async update(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
    @Body() payload: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.update(tenantContext.storeId, id, payload);
    return { product };
  }

  @Post(':id/archive')
  async archive(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Param('id') id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.archive(tenantContext.storeId, id);
    return { product };
  }
}
