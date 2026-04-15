import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AuthTenantErrorCode } from '../../contracts/v1/common/error-codes';
import { CreateProductDto } from '../../contracts/v1/products/create-product.dto';
import { ListProductsQueryDto } from '../../contracts/v1/products/list-products-query.dto';
import { ProductDto } from '../../contracts/v1/products/product.types';
import { UpdateProductDto } from '../../contracts/v1/products/update-product.dto';
import { normalizeCreatePayload, normalizeUpdatePayload } from './helpers/product-normalizer';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  async create(storeId: string, payload: CreateProductDto): Promise<ProductDto> {
    const normalized = normalizeCreatePayload(payload);

    const existing = await this.repository.findByBarcode(storeId, normalized.barcode);
    if (existing && !existing.isArchived) {
      throw new ConflictException({
        code: AuthTenantErrorCode.PRODUCT_DUPLICATE_BARCODE,
        message: 'Barcode already exists in this store.',
      });
    }

    this.validateStockRows(normalized.stockByVariantColor ?? []);

    return this.repository.create(storeId, {
      name: normalized.name,
      barcode: normalized.barcode,
      category: normalized.category,
      imageUrl: normalized.imageUrl ?? null,
      buyPrice: normalized.buyPrice,
      sellPrice: normalized.sellPrice,
      stock: normalized.stock,
      variants: normalized.variants ?? [],
      colors: normalized.colors ?? [],
      stockByVariantColor: normalized.stockByVariantColor ?? [],
    });
  }

  async list(storeId: string, query: ListProductsQueryDto): Promise<ProductDto[]> {
    return this.repository.findMany(storeId, query);
  }

  async getById(storeId: string, id: string): Promise<ProductDto> {
    const product = await this.repository.findById(storeId, id);
    if (!product) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PRODUCT_NOT_FOUND,
        message: 'Product not found in this store.',
      });
    }

    return product;
  }

  async update(storeId: string, id: string, payload: UpdateProductDto): Promise<ProductDto> {
    const existing = await this.repository.findById(storeId, id);
    if (!existing) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PRODUCT_NOT_FOUND,
        message: 'Product not found in this store.',
      });
    }

    if (payload.expectedVersion !== undefined && payload.expectedVersion !== existing.version) {
      throw new ConflictException({
        code: AuthTenantErrorCode.PRODUCT_VERSION_CONFLICT,
        message: 'Product version conflict detected.',
      });
    }

    const normalized = normalizeUpdatePayload(payload);

    if (normalized.barcode && normalized.barcode.toLowerCase() !== existing.barcode.toLowerCase()) {
      const duplicate = await this.repository.findByBarcode(storeId, normalized.barcode);
      if (duplicate && duplicate.id !== existing.id && !duplicate.isArchived) {
        throw new ConflictException({
          code: AuthTenantErrorCode.PRODUCT_DUPLICATE_BARCODE,
          message: 'Barcode already exists in this store.',
        });
      }
    }

    if (normalized.stockByVariantColor) {
      this.validateStockRows(normalized.stockByVariantColor);
    }

    const updateInput: Partial<ProductDto> = {};
    if (normalized.name !== undefined) updateInput.name = normalized.name;
    if (normalized.barcode !== undefined) updateInput.barcode = normalized.barcode;
    if (normalized.category !== undefined) updateInput.category = normalized.category;
    if (normalized.imageUrl !== undefined) updateInput.imageUrl = normalized.imageUrl;
    if (normalized.buyPrice !== undefined) updateInput.buyPrice = normalized.buyPrice;
    if (normalized.sellPrice !== undefined) updateInput.sellPrice = normalized.sellPrice;
    if (normalized.stock !== undefined) updateInput.stock = normalized.stock;
    if (normalized.variants !== undefined) updateInput.variants = normalized.variants;
    if (normalized.colors !== undefined) updateInput.colors = normalized.colors;
    if (normalized.stockByVariantColor !== undefined) {
      updateInput.stockByVariantColor = normalized.stockByVariantColor;
    }

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
        code: AuthTenantErrorCode.PRODUCT_NOT_FOUND,
        message: 'Product not found in this store.',
      });
    }

    return next;
  }

  async archive(storeId: string, id: string): Promise<ProductDto> {
    const product = await this.repository.archive(storeId, id);

    if (!product) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PRODUCT_NOT_FOUND,
        message: 'Product not found in this store.',
      });
    }

    return product;
  }

  private validateStockRows(rows: Array<{ variant: string; color: string; stock: number }>): void {
    for (const row of rows) {
      if (row.stock < 0) {
        throw new BadRequestException({
          code: AuthTenantErrorCode.PRODUCT_INVALID_STOCK_ROWS,
          message: 'stockByVariantColor rows must contain non-negative stock values.',
          fieldErrors: [
            {
              field: 'stockByVariantColor.stock',
              message: 'Stock must be >= 0.',
            },
          ],
        });
      }
    }
  }
}
