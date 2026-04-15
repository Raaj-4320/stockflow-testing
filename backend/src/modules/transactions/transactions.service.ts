import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { CustomersRepository } from '../customers/customers.repository';
import { ProductsRepository } from '../products/products.repository';
import { AuthTenantErrorCode } from '../../contracts/v1/common/error-codes';
import { CreatePaymentTransactionDto } from '../../contracts/v1/transactions/create-payment-transaction.dto';
import { CreateReturnTransactionDto } from '../../contracts/v1/transactions/create-return-transaction.dto';
import { CreateSaleTransactionDto } from '../../contracts/v1/transactions/create-sale-transaction.dto';
import { ListTransactionsQueryDto } from '../../contracts/v1/transactions/list-transactions-query.dto';
import {
  TransactionMutationAcceptedResponseDto,
  TransactionMutationLineItemDto,
  TransactionSettlementPayloadDto,
} from '../../contracts/v1/transactions/mutation-common.dto';
import {
  DeletedTransactionListResponseDto,
  TransactionAuditEventListResponseDto,
  TransactionListResponseDto,
  TransactionResponseDto,
} from '../../contracts/v1/transactions/transaction-response.dto';
import { TransactionLineItemSnapshotDto } from '../../contracts/v1/transactions/transaction.types';
import { TransactionsRepository } from './transactions.repository';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repository: TransactionsRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async list(storeId: string, query: ListTransactionsQueryDto): Promise<TransactionListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const { items, total } = await this.repository.findMany(storeId, query);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: items.slice(start, end),
      page,
      pageSize,
      total,
    };
  }

  async getById(storeId: string, id: string): Promise<TransactionResponseDto> {
    const transaction = await this.repository.findById(storeId, id);
    if (!transaction) {
      throw new NotFoundException({
        code: AuthTenantErrorCode.TRANSACTION_NOT_FOUND,
        message: 'Transaction not found in this store.',
      });
    }

    return { transaction };
  }

  async listDeleted(storeId: string): Promise<DeletedTransactionListResponseDto> {
    return { items: await this.repository.findDeleted(storeId) };
  }

  async listAuditEvents(
    storeId: string,
    transactionId: string,
  ): Promise<TransactionAuditEventListResponseDto> {
    return { items: await this.repository.findAuditEvents(storeId, transactionId) };
  }

  async createSale(
    storeId: string,
    payload: CreateSaleTransactionDto,
    context: { idempotencyKey: string; requestId: string },
  ): Promise<TransactionMutationAcceptedResponseDto> {
    this.ensureIdempotencyKey(context.idempotencyKey);
    this.assertSettlement(payload.settlement, this.computeSubtotal(payload.items));

    return this.withIdempotency('create_sale', storeId, context, payload, async (mutationId) => {
      const lineItems = await this.materializeLineItems(storeId, payload.items, -1);
      const subtotal = this.computeSubtotal(payload.items);

      let customerName: string | null = null;
      let customerPhone: string | null = null;
      if (payload.customerId) {
        const customer = await this.customersRepository.findById(storeId, payload.customerId);
        if (!customer) {
          throw new NotFoundException({
            code: AuthTenantErrorCode.CUSTOMER_NOT_FOUND,
            message: 'Customer not found in this store.',
          });
        }

        const updated = await this.customersRepository.applyBalanceDelta(storeId, customer.id, {
          dueDelta: payload.settlement.creditDue,
          storeCreditDelta: -payload.settlement.storeCreditUsed,
        });

        if (!updated) {
          throw new BadRequestException({
            code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_REQUEST,
            message: 'Customer balance mutation would result in an invalid state.',
          });
        }

        customerName = updated.name;
        customerPhone = updated.phone;
      }

      await this.repository.create(storeId, {
        type: 'sale',
        transactionDate: new Date().toISOString(),
        lineItems,
        settlement: payload.settlement,
        customer: {
          customerId: payload.customerId ?? null,
          customerName,
          customerPhone,
        },
        totals: {
          subtotal,
          discount: 0,
          tax: 0,
          grandTotal: subtotal,
        },
        metadata: {
          source: 'pos',
          note: payload.note ?? null,
          createdBy: null,
        },
      });

      return this.appliedResponse('create_sale', mutationId, context);
    });
  }

  async createPayment(
    storeId: string,
    payload: CreatePaymentTransactionDto,
    context: { idempotencyKey: string; requestId: string },
  ): Promise<TransactionMutationAcceptedResponseDto> {
    this.ensureIdempotencyKey(context.idempotencyKey);
    this.assertSettlement(payload.settlement, payload.amount);

    return this.withIdempotency('create_payment', storeId, context, payload, async (mutationId) => {
      const customer = await this.customersRepository.findById(storeId, payload.customerId);
      if (!customer) {
        throw new NotFoundException({
          code: AuthTenantErrorCode.CUSTOMER_NOT_FOUND,
          message: 'Customer not found in this store.',
        });
      }

      const dueDelta = -Math.min(customer.dueBalance, payload.amount);
      const storeCreditDelta = payload.amount > customer.dueBalance ? payload.amount - customer.dueBalance : 0;

      const updated = await this.customersRepository.applyBalanceDelta(storeId, customer.id, {
        dueDelta,
        storeCreditDelta,
      });

      if (!updated) {
        throw new BadRequestException({
          code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_REQUEST,
          message: 'Customer balance mutation would result in an invalid state.',
        });
      }

      await this.repository.create(storeId, {
        type: 'payment',
        transactionDate: new Date().toISOString(),
        lineItems: [],
        settlement: payload.settlement,
        customer: {
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
        },
        totals: {
          subtotal: payload.amount,
          discount: 0,
          tax: 0,
          grandTotal: payload.amount,
        },
        metadata: {
          source: 'pos',
          note: payload.note ?? null,
          createdBy: null,
        },
      });

      return this.appliedResponse('create_payment', mutationId, context);
    });
  }

  async createReturn(
    storeId: string,
    payload: CreateReturnTransactionDto,
    context: { idempotencyKey: string; requestId: string },
  ): Promise<TransactionMutationAcceptedResponseDto> {
    this.ensureIdempotencyKey(context.idempotencyKey);

    const subtotal = this.computeSubtotal(payload.items);
    this.assertSettlement(payload.settlement, subtotal);

    return this.withIdempotency('create_return', storeId, context, payload, async (mutationId) => {
      const sourceTx = await this.repository.findById(storeId, payload.sourceTransactionId);
      if (!sourceTx) {
        throw new NotFoundException({
          code: AuthTenantErrorCode.TRANSACTION_NOT_FOUND,
          message: 'Source transaction not found in this store.',
        });
      }

      if (
        payload.expectedSourceVersion !== undefined &&
        payload.expectedSourceVersion !== sourceTx.version
      ) {
        throw new ConflictException({
          code: AuthTenantErrorCode.TRANSACTION_MUTATION_VERSION_CONFLICT,
          message: 'Source transaction version conflict detected.',
        });
      }

      const lineItems = await this.materializeLineItems(storeId, payload.items, +1);

      const handlingAmount = payload.returnHandling.amount ?? subtotal;
      let dueDelta = 0;
      let storeCreditDelta = 0;

      if (payload.returnHandling.mode === 'reduce_due') {
        dueDelta = -handlingAmount;
      }
      if (payload.returnHandling.mode === 'store_credit') {
        storeCreditDelta = handlingAmount;
      }

      let customerName: string | null = sourceTx.customer.customerName ?? null;
      let customerPhone: string | null = sourceTx.customer.customerPhone ?? null;

      if (sourceTx.customer.customerId && (dueDelta !== 0 || storeCreditDelta !== 0)) {
        const updated = await this.customersRepository.applyBalanceDelta(
          storeId,
          sourceTx.customer.customerId,
          { dueDelta, storeCreditDelta },
        );

        if (!updated) {
          throw new BadRequestException({
            code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_REQUEST,
            message: 'Customer balance mutation would result in an invalid state.',
          });
        }
        customerName = updated.name;
        customerPhone = updated.phone;
      }

      await this.repository.create(storeId, {
        type: 'return',
        transactionDate: new Date().toISOString(),
        lineItems,
        settlement: payload.settlement,
        customer: {
          customerId: sourceTx.customer.customerId ?? null,
          customerName,
          customerPhone,
        },
        totals: {
          subtotal,
          discount: 0,
          tax: 0,
          grandTotal: subtotal,
        },
        metadata: {
          source: 'pos',
          note: payload.note ?? null,
          createdBy: null,
        },
      });

      return this.appliedResponse('create_return', mutationId, context);
    });
  }

  private ensureIdempotencyKey(idempotencyKey: string): void {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({
        code: AuthTenantErrorCode.TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REQUIRED,
        message: 'X-Idempotency-Key header is required for mutation endpoints.',
      });
    }
  }

  private assertSettlement(settlement: TransactionSettlementPayloadDto, expectedTotal: number): void {
    const sum =
      settlement.cashPaid +
      settlement.onlinePaid +
      settlement.creditDue +
      settlement.storeCreditUsed;

    if (Math.abs(sum - expectedTotal) > 0.0001) {
      throw new BadRequestException({
        code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_SETTLEMENT,
        message: 'Settlement totals do not match transaction total.',
      });
    }
  }

  private computeSubtotal(items: TransactionMutationLineItemDto[]): number {
    return items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  }

  private async materializeLineItems(
    storeId: string,
    items: TransactionMutationLineItemDto[],
    stockDeltaSign: 1 | -1,
  ): Promise<TransactionLineItemSnapshotDto[]> {
    const snapshots: TransactionLineItemSnapshotDto[] = [];

    for (const item of items) {
      const product = await this.productsRepository.findById(storeId, item.productId);
      if (!product) {
        throw new NotFoundException({
          code: AuthTenantErrorCode.PRODUCT_NOT_FOUND,
          message: 'Product not found in this store.',
        });
      }

      const delta = stockDeltaSign * item.quantity;
      const updatedProduct = await this.productsRepository.applyStockDelta(
        storeId,
        product.id,
        delta,
        item.variant ?? null,
        item.color ?? null,
      );

      if (!updatedProduct) {
        throw new ConflictException({
          code: AuthTenantErrorCode.TRANSACTION_MUTATION_INSUFFICIENT_STOCK,
          message: 'Insufficient stock for one or more line items.',
        });
      }

      snapshots.push({
        productId: product.id,
        productName: product.name,
        sku: product.barcode,
        variant: item.variant ?? null,
        color: item.color ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineSubtotal: item.quantity * item.unitPrice,
      });
    }

    return snapshots;
  }

  private async withIdempotency(
    operation: 'create_sale' | 'create_payment' | 'create_return',
    storeId: string,
    context: { idempotencyKey: string; requestId: string },
    payload: unknown,
    execute: (mutationId: string) => Promise<TransactionMutationAcceptedResponseDto>,
  ): Promise<TransactionMutationAcceptedResponseDto> {
    const payloadHash = this.idempotencyService.hashPayload(payload);
    const keyInput = {
      storeId,
      operation,
      idempotencyKey: context.idempotencyKey,
    };

    const matches = this.idempotencyService.payloadMatches(keyInput, payloadHash);
    if (!matches) {
      throw new ConflictException({
        code: AuthTenantErrorCode.TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REUSED_DIFFERENT_PAYLOAD,
        message: 'Idempotency key cannot be reused with a different payload.',
      });
    }

    const begin = this.idempotencyService.begin(keyInput, payloadHash);
    if (begin.type === 'replay') {
      return {
        ...begin.response,
        status: 'replayed',
      };
    }

    const response = await execute(begin.mutationId);
    this.idempotencyService.complete(keyInput, payloadHash, response);
    return response;
  }

  private appliedResponse(
    operation: string,
    mutationId: string,
    context: { idempotencyKey: string; requestId: string },
  ): TransactionMutationAcceptedResponseDto {
    return {
      operation,
      accepted: true,
      mutationId,
      idempotencyKey: context.idempotencyKey,
      requestId: context.requestId,
      status: 'applied',
    };
  }
}
