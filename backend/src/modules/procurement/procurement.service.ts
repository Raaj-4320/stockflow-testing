import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AuthTenantErrorCode } from '../../contracts/v1/common/error-codes';
import { CreatePurchaseOrderDto, ListPurchaseOrdersQueryDto, PurchaseOrderDto, UpdatePurchaseOrderDto } from '../../contracts/v1/procurement/purchase-order.dto';
import { CreatePurchasePartyDto, ListPurchasePartiesQueryDto, PurchasePartyDto, UpdatePurchasePartyDto } from '../../contracts/v1/procurement/purchase-party.dto';
import { ReceivePurchaseOrderRequestDto, ReceivePurchaseOrderResponseDto } from '../../contracts/v1/procurement/receive-purchase-order.dto';
import { ProductsRepository } from '../products/products.repository';
import { ProcurementRepository } from './procurement.repository';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly repository: ProcurementRepository,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async listParties(storeId: string, query: ListPurchasePartiesQueryDto): Promise<PurchasePartyDto[]> {
    const search = query.q?.trim().toLowerCase();
    const includeArchived = Boolean(query.includeArchived);
    const parties = await this.repository.findParties(storeId);

    return parties
      .filter((p) => includeArchived || !p.isArchived)
      .filter((p) => {
        if (!search) return true;
        return (
          p.name.toLowerCase().includes(search) ||
          (p.phone ?? '').toLowerCase().includes(search) ||
          (p.gst ?? '').toLowerCase().includes(search)
        );
      });
  }

  async getPartyById(storeId: string, id: string): Promise<PurchasePartyDto> {
    const party = await this.repository.findPartyById(storeId, id);
    if (!party) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_PARTY_NOT_FOUND,
        message: 'Purchase party not found in this store.',
      });
    }
    return party;
  }

  async listOrders(storeId: string, query: ListPurchaseOrdersQueryDto): Promise<PurchaseOrderDto[]> {
    const search = query.q?.trim().toLowerCase();
    const orders = await this.repository.findOrders(storeId);

    return orders
      .filter((o) => (query.status ? o.status === query.status : true))
      .filter((o) => (query.partyId ? o.partyId === query.partyId : true))
      .filter((o) => {
        if (!search) return true;
        return (
          o.id.toLowerCase().includes(search) ||
          o.partyName.toLowerCase().includes(search) ||
          (o.billNumber ?? '').toLowerCase().includes(search)
        );
      });
  }

  async getOrderById(storeId: string, id: string): Promise<PurchaseOrderDto> {
    const order = await this.repository.findOrderById(storeId, id);
    if (!order) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_ORDER_NOT_FOUND,
        message: 'Purchase order not found in this store.',
      });
    }
    return order;
  }

  async createParty(storeId: string, payload: CreatePurchasePartyDto): Promise<PurchasePartyDto> {
    const existing = await this.repository.findParties(storeId);
    const normalizedName = payload.name.trim().toLowerCase();
    const normalizedPhone = (payload.phone ?? '').trim();
    const duplicate = existing.find(
      (party) =>
        !party.isArchived &&
        party.name.trim().toLowerCase() === normalizedName &&
        (party.phone ?? '') === normalizedPhone,
    );
    if (duplicate) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_PARTY_DUPLICATE,
        message: 'Purchase party already exists in this store.',
      });
    }

    return this.repository.createParty(storeId, {
      name: payload.name.trim(),
      phone: payload.phone?.trim() || null,
      gst: payload.gst?.trim() || null,
      location: payload.location?.trim() || null,
      contactPerson: payload.contactPerson?.trim() || null,
      notes: payload.notes?.trim() || null,
      isArchived: false,
      archivedAt: null,
    });
  }

  async updateParty(storeId: string, id: string, payload: UpdatePurchasePartyDto): Promise<PurchasePartyDto> {
    const existing = await this.repository.findPartyById(storeId, id);
    if (!existing) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_PARTY_NOT_FOUND,
        message: 'Purchase party not found in this store.',
      });
    }
    if (payload.expectedVersion !== undefined && payload.expectedVersion !== existing.version) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_ORDER_VERSION_CONFLICT,
        message: 'Purchase party version conflict detected.',
      });
    }
    const next = await this.repository.updateParty(storeId, id, {
      name: payload.name?.trim(),
      phone: payload.phone?.trim(),
      gst: payload.gst?.trim(),
      location: payload.location?.trim(),
      contactPerson: payload.contactPerson?.trim(),
      notes: payload.notes?.trim(),
      isArchived: payload.archive === undefined ? undefined : payload.archive,
      archivedAt: payload.archive === true ? new Date().toISOString() : payload.archive === false ? null : undefined,
    });
    if (!next) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_PARTY_NOT_FOUND,
        message: 'Purchase party not found in this store.',
      });
    }
    return next;
  }

  async createOrder(storeId: string, payload: CreatePurchaseOrderDto): Promise<PurchaseOrderDto> {
    const party = await this.repository.findPartyById(storeId, payload.partyId);
    if (!party) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_PARTY_NOT_FOUND,
        message: 'Purchase party not found in this store.',
      });
    }
    const lines = payload.lines.map((line) => ({ ...line }));
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalAmount = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);

    return this.repository.createOrder(storeId, {
      partyId: party.id,
      partyName: party.name,
      status: 'draft',
      orderDate: new Date().toISOString(),
      billNumber: payload.billNumber?.trim() || null,
      billDate: payload.billDate?.trim() || null,
      gstPercent: payload.gstPercent ?? 0,
      lines,
      totalQuantity,
      totalAmount,
      notes: payload.notes?.trim() || null,
      receivedQuantity: 0,
    });
  }

  async updateOrder(storeId: string, id: string, payload: UpdatePurchaseOrderDto): Promise<PurchaseOrderDto> {
    const existing = await this.repository.findOrderById(storeId, id);
    if (!existing) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_ORDER_NOT_FOUND,
        message: 'Purchase order not found in this store.',
      });
    }
    if (payload.expectedVersion !== undefined && payload.expectedVersion !== existing.version) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_ORDER_VERSION_CONFLICT,
        message: 'Purchase order version conflict detected.',
      });
    }
    if (existing.status === 'received') {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_ORDER_ALREADY_RECEIVED,
        message: 'Received purchase orders cannot be updated.',
      });
    }

    const nextLines = payload.lines ? payload.lines.map((line) => ({ ...line })) : existing.lines;
    const totalQuantity = nextLines.reduce((sum, line) => sum + line.quantity, 0);
    const totalAmount = nextLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);

    const next = await this.repository.updateOrder(storeId, id, {
      partyId: payload.partyId ?? existing.partyId,
      partyName: existing.partyName,
      lines: nextLines,
      totalQuantity,
      totalAmount,
      billNumber: payload.billNumber === undefined ? existing.billNumber : payload.billNumber?.trim() || null,
      billDate: payload.billDate === undefined ? existing.billDate : payload.billDate?.trim() || null,
      gstPercent: payload.gstPercent ?? existing.gstPercent,
      notes: payload.notes === undefined ? existing.notes : payload.notes?.trim() || null,
    });
    if (!next) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.PROCUREMENT_ORDER_NOT_FOUND,
        message: 'Purchase order not found in this store.',
      });
    }
    return next;
  }

  async receiveOrder(
    storeId: string,
    id: string,
    payload: ReceivePurchaseOrderRequestDto,
  ): Promise<ReceivePurchaseOrderResponseDto> {
    const order = await this.repository.findOrderById(storeId, id);
    if (!order) {
      throw new NotFoundException({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_NOT_FOUND, message: 'Purchase order not found in this store.' });
    }
    if (payload.orderId !== id) {
      throw new ConflictException({ code: AuthTenantErrorCode.PROCUREMENT_INVALID_ORDER_STATE, message: 'Receive orderId does not match path id.' });
    }
    if (payload.expectedVersion !== undefined && payload.expectedVersion !== order.version) {
      throw new ConflictException({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_VERSION_CONFLICT, message: 'Purchase order version conflict detected.' });
    }
    if (order.status === 'received') {
      throw new ConflictException({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_ALREADY_RECEIVED, message: 'Purchase order already received.' });
    }
    for (const line of order.lines) {
      let product = null as Awaited<ReturnType<ProductsRepository['findById']>>;
      if (line.sourceType === 'inventory') {
        if (!line.productId) {
          throw new NotFoundException({ code: AuthTenantErrorCode.PRODUCT_NOT_FOUND, message: 'Inventory-source line requires productId.' });
        }
        product = await this.productsRepository.findById(storeId, line.productId);
        if (!product) {
          throw new NotFoundException({ code: AuthTenantErrorCode.PRODUCT_NOT_FOUND, message: 'Product not found in this store.' });
        }
      } else if (line.sourceType === 'new') {
        const name = line.productName?.trim();
        const barcode = line.pendingProductBarcode?.trim();
        if (!name || !barcode) {
          throw new ConflictException({ code: AuthTenantErrorCode.PROCUREMENT_PRODUCT_MATERIALIZATION_FAILED, message: 'New-source receive requires productName and pendingProductBarcode.' });
        }
        const existingByBarcode = await this.productsRepository.findByBarcode(storeId, barcode);
        if (existingByBarcode && !existingByBarcode.isArchived) {
          throw new ConflictException({ code: AuthTenantErrorCode.PRODUCT_DUPLICATE_BARCODE, message: 'Barcode already exists in this store.' });
        }
        const variant = line.variant?.trim() || 'Default';
        const color = line.color?.trim() || 'Default';
        const created = await this.productsRepository.create(storeId, {
          name,
          barcode,
          category: line.category?.trim() || 'Uncategorized',
          imageUrl: line.image?.trim() || null,
          buyPrice: line.unitCost,
          sellPrice: line.unitCost,
          stock: 0,
          variants: [variant],
          colors: [color],
          stockByVariantColor: [{ variant, color, stock: 0 }],
        });
        product = await this.productsRepository.update(storeId, created.id, {
          ...( { purchaseHistory: [] } as any),
        } as any);
      } else {
        throw new ConflictException({ code: AuthTenantErrorCode.PROCUREMENT_INVALID_SOURCE_TYPE, message: 'Unsupported source type.' });
      }
      if (!product) {
        throw new ConflictException({ code: AuthTenantErrorCode.PROCUREMENT_PRODUCT_MATERIALIZATION_FAILED, message: 'Unable to resolve product for receive line.' });
      }
      const previousStock = product.stock;
      const previousBuyPrice = product.buyPrice;
      const nextBuyPrice =
        payload.receiveMethod === 'no_change'
          ? previousBuyPrice
          : payload.receiveMethod === 'latest_purchase'
            ? line.unitCost
            : this.round2(((previousStock * previousBuyPrice) + (line.quantity * line.unitCost)) / (previousStock + line.quantity));
      const targetVariant = line.variant?.trim() || 'Default';
      const targetColor = line.color?.trim() || 'Default';
      const nextRows = product.stockByVariantColor.map((row) => {
        if (row.variant === targetVariant && row.color === targetColor) {
          return { ...row, stock: row.stock + line.quantity };
        }
        return row;
      });
      const hasRow = nextRows.some((row) => row.variant === targetVariant && row.color === targetColor);
      const stockByVariantColor = hasRow
        ? nextRows
        : [...nextRows, { variant: targetVariant, color: targetColor, stock: line.quantity }];

      const history = [
        {
          date: new Date().toISOString(),
          variant: targetVariant,
          color: targetColor,
          quantity: line.quantity,
          unitPrice: line.unitCost,
          previousStock,
          nextStock: previousStock + line.quantity,
          previousBuyPrice,
          nextBuyPrice,
          receiveMethod: payload.receiveMethod,
          reference: `PO:${order.id}`,
          notes: payload.note ?? order.notes ?? null,
        },
        ...((product as any).purchaseHistory ?? []),
      ];

      await this.productsRepository.update(storeId, product.id, {
        stock: previousStock + line.quantity,
        buyPrice: nextBuyPrice,
        stockByVariantColor,
        ...( { purchaseHistory: history } as any),
      } as any);
    }

    const nextOrder = await this.repository.updateOrder(storeId, order.id, {
      status: 'received',
      receivedQuantity: order.totalQuantity,
    });
    return {
      status: 'applied',
      mutationId: `receive-${nextOrder?.id ?? order.id}-${Date.now()}`,
      requestId: `receive-${order.id}`,
      idempotencyKey: payload.orderId,
      orderId: order.id,
    };
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
