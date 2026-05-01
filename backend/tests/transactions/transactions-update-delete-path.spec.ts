import { readFileSync } from 'fs';
import * as path from 'path';

import { AuthTenantErrorCode } from '../../src/contracts/v1/common/error-codes';
import { createTransactionsTestContext } from '../utils/transactions-test-factory';

type JsonFixture = Record<string, any>;

const loadFixture = (name: string): JsonFixture => {
  const filePath = path.resolve(__dirname, '..', 'invariants', 'transactions', `${name}.json`);
  return JSON.parse(readFileSync(filePath, 'utf8')) as JsonFixture;
};

const createSaleFromFixture = async (fixture: JsonFixture) => {
  const ctx = createTransactionsTestContext();
  const customer = fixture.setup.customer
    ? await ctx.customersService.create(fixture.storeId, fixture.setup.customer)
    : null;
  const customerA = fixture.setup.customerA
    ? await ctx.customersService.create(fixture.storeId, fixture.setup.customerA)
    : null;
  const customerB = fixture.setup.customerB
    ? await ctx.customersService.create(fixture.storeId, fixture.setup.customerB)
    : null;

  const product = fixture.setup.product
    ? await ctx.productsService.create(fixture.storeId, fixture.setup.product)
    : null;
  const productA = fixture.setup.productA
    ? await ctx.productsService.create(fixture.storeId, fixture.setup.productA)
    : null;
  const productB = fixture.setup.productB
    ? await ctx.productsService.create(fixture.storeId, fixture.setup.productB)
    : null;

  const saleItems = fixture.setup.sale.items.map((item: any) => {
    const target = item.product === 'A'
      ? productA
      : item.product === 'B'
        ? productB
        : product;
    return {
      productId: target!.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      variant: item.variant,
      color: item.color,
    };
  });

  const ownerCustomer = customer ?? customerA;
  const sale = await ctx.transactionsService.createSale(
    fixture.storeId,
    {
      items: saleItems,
      settlement: fixture.setup.sale.settlement,
      customerId: ownerCustomer?.id,
    },
    { idempotencyKey: `${fixture.name}-sale`, requestId: `${fixture.name}-sale` },
  );

  const list = await ctx.transactionsService.list(fixture.storeId, {});
  const tx = list.items[0];

  return {
    ctx,
    sale,
    tx,
    customer,
    customerA,
    customerB,
    product,
    productA,
    productB
  };
};

describe('Transactions update/delete path invariants', () => {
  test('update sale quantity change', async () => {
    const fixture = loadFixture('transactions_update_sale_quantity_change_v1');
    const { ctx, tx, product, customer } = await createSaleFromFixture(fixture);

    const res = await ctx.transactionsService.updateTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        patch: {
          items: fixture.update.patch.items.map((x: any) => ({ ...x, productId: product!.id })),
          settlement: fixture.update.patch.settlement,
        },
      },
      { idempotencyKey: `${fixture.name}-update`, requestId: `${fixture.name}-update` },
    );

    expect(res.status).toBe(fixture.expected.status);
    expect((await ctx.productsService.getById(fixture.storeId, product!.id)).stock).toBe(fixture.expected.stock);
    expect((await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance).toBe(
      fixture.expected.dueBalance,
    );
  });

  test('update settlement change', async () => {
    const fixture = loadFixture('transactions_update_settlement_change_v1');
    const { ctx, tx, customer } = await createSaleFromFixture(fixture);

    const res = await ctx.transactionsService.updateTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        patch: fixture.update.patch,
      },
      { idempotencyKey: `${fixture.name}-update`, requestId: `${fixture.name}-update` },
    );

    expect(res.status).toBe(fixture.expected.status);
    expect((await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance).toBe(
      fixture.expected.dueBalance,
    );
  });

  test('update customer change', async () => {
    const fixture = loadFixture('transactions_update_customer_change_v1');
    const { ctx, tx, customerA, customerB } = await createSaleFromFixture(fixture);

    await ctx.transactionsService.updateTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        patch: { customerId: customerB!.id },
      },
      { idempotencyKey: `${fixture.name}-update`, requestId: `${fixture.name}-update` },
    );

    expect((await ctx.customersService.getById(fixture.storeId, customerA!.id)).dueBalance).toBe(
      fixture.expected.customerADue,
    );
    expect((await ctx.customersService.getById(fixture.storeId, customerB!.id)).dueBalance).toBe(
      fixture.expected.customerBDue,
    );
  });

  test('update line-item identity change', async () => {
    const fixture = loadFixture('transactions_update_line_identity_change_v1');
    const { ctx, tx, productA, productB } = await createSaleFromFixture(fixture);

    const res = await ctx.transactionsService.updateTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        patch: {
          items: fixture.update.patch.items.map((x: any) => ({
            quantity: x.quantity,
            unitPrice: x.unitPrice,
            productId: x.product === 'A' ? productA!.id : productB!.id,
          })),
          settlement: fixture.update.patch.settlement,
        },
      },
      { idempotencyKey: `${fixture.name}-update`, requestId: `${fixture.name}-update` },
    );

    expect(res.status).toBe(fixture.expected.status);
    expect((await ctx.productsService.getById(fixture.storeId, productA!.id)).stock).toBe(fixture.expected.stockA);
    expect((await ctx.productsService.getById(fixture.storeId, productB!.id)).stock).toBe(fixture.expected.stockB);
  });

  test('update insufficient stock', async () => {
    const fixture = loadFixture('transactions_update_insufficient_stock_v1');
    const { ctx, tx, product } = await createSaleFromFixture(fixture);

    await expect(
      ctx.transactionsService.updateTransaction(
        fixture.storeId,
        {
          transactionId: tx.id,
          expectedVersion: tx.version,
          patch: {
            items: fixture.update.patch.items.map((x: any) => ({ ...x, productId: product!.id })),
            settlement: fixture.update.patch.settlement,
          },
        },
        { idempotencyKey: `${fixture.name}-update`, requestId: `${fixture.name}-update` },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: fixture.expectedErrorCode }) });
  });

  test('update version conflict', async () => {
    const fixture = loadFixture('transactions_update_version_conflict_v1');
    const { ctx, tx } = await createSaleFromFixture(fixture);

    await expect(
      ctx.transactionsService.updateTransaction(
        fixture.storeId,
        {
          transactionId: tx.id,
          expectedVersion: tx.version + fixture.update.expectedVersionOffset,
          patch: fixture.update.patch,
        },
        { idempotencyKey: `${fixture.name}-update`, requestId: `${fixture.name}-update` },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: fixture.expectedErrorCode }) });
  });

  test('delete no compensation', async () => {
    const fixture = loadFixture('transactions_delete_no_compensation_v1');
    const { ctx, tx, product, customer } = await createSaleFromFixture(fixture);

    const res = await ctx.transactionsService.deleteTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        reason: 'fixture-delete-none',
        compensation: fixture.delete.compensation,
      },
      { idempotencyKey: `${fixture.name}-delete`, requestId: `${fixture.name}-delete` },
    );

    expect(res.status).toBe('applied');
    expect((await ctx.transactionsService.list(fixture.storeId, {})).total).toBe(fixture.expected.remainingTransactions);
    expect((await ctx.transactionsService.listDeleted(fixture.storeId)).items.length).toBe(
      fixture.expected.deletedCount,
    );
    expect((await ctx.productsService.getById(fixture.storeId, product!.id)).stock).toBe(fixture.expected.stock);
    expect((await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance).toBe(
      fixture.expected.dueBalance,
    );
  });

  test('delete with compensation', async () => {
    const fixture = loadFixture('transactions_delete_with_compensation_v1');
    const { ctx, tx, customer } = await createSaleFromFixture(fixture);

    await ctx.transactionsService.deleteTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        reason: 'fixture-delete-comp',
        compensation: fixture.delete.compensation,
      },
      { idempotencyKey: `${fixture.name}-delete`, requestId: `${fixture.name}-delete` },
    );

    const customerAfter = await ctx.customersService.getById(fixture.storeId, customer!.id);
    expect(customerAfter.storeCreditBalance).toBe(fixture.expected.storeCreditBalance);
    expect(customerAfter.dueBalance).toBe(fixture.expected.dueBalance);
  });

  test('delete customer balance effect', async () => {
    const fixture = loadFixture('transactions_delete_customer_balance_effect_v1');
    const { ctx, tx, customer } = await createSaleFromFixture(fixture);

    await ctx.transactionsService.deleteTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        reason: 'fixture-delete-customer-fx',
        compensation: fixture.delete.compensation,
      },
      { idempotencyKey: `${fixture.name}-delete`, requestId: `${fixture.name}-delete` },
    );

    expect((await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance).toBe(
      fixture.expected.dueBalance,
    );
  });

  test('delete finance preview effect baseline', async () => {
    const fixture = loadFixture('transactions_delete_finance_effect_preview_v1');
    const { ctx, tx, product } = await createSaleFromFixture(fixture);

    const res = await ctx.transactionsService.deleteTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        reason: 'fixture-delete-finance-fx',
        compensation: fixture.delete.compensation,
      },
      { idempotencyKey: `${fixture.name}-delete`, requestId: `${fixture.name}-delete` },
    );

    expect(res.status).toBe('applied');
    expect((await ctx.transactionsService.listDeleted(fixture.storeId)).items.length).toBe(
      fixture.expected.deletedCount,
    );
    expect((await ctx.productsService.getById(fixture.storeId, product!.id)).stock).toBe(fixture.expected.stock);
  });

  test('archive/deleted snapshot integrity', async () => {
    const fixture = loadFixture('transactions_archive_deleted_snapshot_integrity_v1');
    const { ctx, tx } = await createSaleFromFixture(fixture);

    await ctx.transactionsService.deleteTransaction(
      fixture.storeId,
      {
        transactionId: tx.id,
        expectedVersion: tx.version,
        reason: fixture.delete.reason,
        compensation: fixture.delete.compensation,
      },
      { idempotencyKey: `${fixture.name}-delete`, requestId: `${fixture.name}-delete` },
    );

    const deleted = (await ctx.transactionsService.listDeleted(fixture.storeId)).items[0];
    expect(deleted.originalTransactionId).toBe(tx.id);
    expect(deleted.reason).toBe(fixture.expected.reason);
    expect(deleted.snapshot.type).toBe(fixture.expected.snapshotType);
  });

  test('delete version conflict', async () => {
    const fixture = loadFixture('transactions_delete_no_compensation_v1');
    const { ctx, tx } = await createSaleFromFixture(fixture);

    await expect(
      ctx.transactionsService.deleteTransaction(
        fixture.storeId,
        {
          transactionId: tx.id,
          expectedVersion: tx.version + 1,
          reason: 'stale-delete',
          compensation: fixture.delete.compensation,
        },
        { idempotencyKey: `${fixture.name}-delete-stale`, requestId: `${fixture.name}-delete-stale` },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: AuthTenantErrorCode.TRANSACTION_MUTATION_VERSION_CONFLICT,
      }),
    });
  });

  test('update rejects payment transaction type before side effects', async () => {
    const ctx = createTransactionsTestContext();
    const storeId = 'store-update-reject-payment';
    const customer = await ctx.customersService.create(storeId, {
      name: 'Reject Payment Customer',
      phone: '+1-555-7010',
    });

    await ctx.transactionsService.createPayment(
      storeId,
      {
        customerId: customer.id,
        amount: 50,
        settlement: { cashPaid: 50, onlinePaid: 0, creditDue: 0, storeCreditUsed: 0, paymentMethod: 'cash' },
      },
      { idempotencyKey: 'reject-payment-create', requestId: 'reject-payment-create' },
    );

    const tx = (await ctx.transactionsService.list(storeId, {})).items[0];
    const beforeDue = (await ctx.customersService.getById(storeId, customer.id)).dueBalance;

    await expect(
      ctx.transactionsService.updateTransaction(
        storeId,
        { transactionId: tx.id, expectedVersion: tx.version, patch: { note: 'blocked-update' } },
        { idempotencyKey: 'reject-payment-update', requestId: 'reject-payment-update' },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_OPERATION }) });

    const afterDue = (await ctx.customersService.getById(storeId, customer.id)).dueBalance;
    expect(afterDue).toBe(beforeDue);
  });

  test('update rejects return transaction type before side effects', async () => {
    const ctx = createTransactionsTestContext();
    const storeId = 'store-update-reject-return';
    const customer = await ctx.customersService.create(storeId, {
      name: 'Reject Return Customer',
      phone: '+1-555-7020',
    });
    const product = await ctx.productsService.create(storeId, {
      name: 'Reject Return Product',
      barcode: 'REJECT-RETURN-001',
      category: 'test',
      stock: 10,
      buyPrice: 10,
      sellPrice: 20,
    });

    await ctx.transactionsService.createSale(
      storeId,
      {
        items: [{ productId: product.id, quantity: 2, unitPrice: 20 }],
        settlement: { cashPaid: 20, onlinePaid: 0, creditDue: 20, storeCreditUsed: 0, paymentMethod: 'mixed' },
        customerId: customer.id,
      },
      { idempotencyKey: 'reject-return-sale', requestId: 'reject-return-sale' },
    );
    const sourceTx = (await ctx.transactionsService.list(storeId, { type: 'sale' })).items[0];

    await ctx.transactionsService.createReturn(
      storeId,
      {
        sourceTransactionId: sourceTx.id,
        expectedSourceVersion: sourceTx.version,
        items: [{ productId: product.id, quantity: 1, unitPrice: 20 }],
        returnHandling: { mode: 'reduce_due', amount: 20 },
        settlement: { cashPaid: 0, onlinePaid: 0, creditDue: 20, storeCreditUsed: 0, paymentMethod: 'credit' },
      },
      { idempotencyKey: 'reject-return-create', requestId: 'reject-return-create' },
    );

    const returnTx = (await ctx.transactionsService.list(storeId, { type: 'return' })).items[0];
    const beforeStock = (await ctx.productsService.getById(storeId, product.id)).stock;

    await expect(
      ctx.transactionsService.updateTransaction(
        storeId,
        { transactionId: returnTx.id, expectedVersion: returnTx.version, patch: { note: 'blocked-return-update' } },
        { idempotencyKey: 'reject-return-update', requestId: 'reject-return-update' },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_OPERATION }) });

    expect((await ctx.productsService.getById(storeId, product.id)).stock).toBe(beforeStock);
  });

  test('delete rejects payment and return types before side effects', async () => {
    const ctx = createTransactionsTestContext();
    const paymentStoreId = 'store-delete-reject-payment';
    const returnStoreId = 'store-delete-reject-return';

    const paymentCustomer = await ctx.customersService.create(paymentStoreId, {
      name: 'Delete Reject Payment Customer',
      phone: '+1-555-7030',
    });
    await ctx.transactionsService.createPayment(
      paymentStoreId,
      { customerId: paymentCustomer.id, amount: 40, settlement: { cashPaid: 40, onlinePaid: 0, creditDue: 0, storeCreditUsed: 0, paymentMethod: 'cash' } },
      { idempotencyKey: 'delete-reject-payment-create', requestId: 'delete-reject-payment-create' },
    );
    const paymentTx = (await ctx.transactionsService.list(paymentStoreId, { type: 'payment' })).items[0];

    await expect(
      ctx.transactionsService.deleteTransaction(
        paymentStoreId,
        { transactionId: paymentTx.id, expectedVersion: paymentTx.version, reason: 'blocked-payment-delete', compensation: { mode: 'none' } },
        { idempotencyKey: 'delete-reject-payment', requestId: 'delete-reject-payment' },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_OPERATION }) });

    const customer = await ctx.customersService.create(returnStoreId, {
      name: 'Delete Reject Return Customer',
      phone: '+1-555-7040',
    });
    const product = await ctx.productsService.create(returnStoreId, {
      name: 'Delete Reject Return Product',
      barcode: 'REJECT-DELETE-RETURN-001',
      category: 'test',
      stock: 10,
      buyPrice: 10,
      sellPrice: 20,
    });
    await ctx.transactionsService.createSale(
      returnStoreId,
      {
        items: [{ productId: product.id, quantity: 2, unitPrice: 20 }],
        settlement: { cashPaid: 20, onlinePaid: 0, creditDue: 20, storeCreditUsed: 0, paymentMethod: 'mixed' },
        customerId: customer.id,
      },
      { idempotencyKey: 'delete-reject-return-sale', requestId: 'delete-reject-return-sale' },
    );
    const sourceTx = (await ctx.transactionsService.list(returnStoreId, { type: 'sale' })).items[0];
    await ctx.transactionsService.createReturn(
      returnStoreId,
      {
        sourceTransactionId: sourceTx.id,
        expectedSourceVersion: sourceTx.version,
        items: [{ productId: product.id, quantity: 1, unitPrice: 20 }],
        returnHandling: { mode: 'store_credit', amount: 20 },
        settlement: { cashPaid: 0, onlinePaid: 0, creditDue: 20, storeCreditUsed: 0, paymentMethod: 'credit' },
      },
      { idempotencyKey: 'delete-reject-return-create', requestId: 'delete-reject-return-create' },
    );
    const returnTx = (await ctx.transactionsService.list(returnStoreId, { type: 'return' })).items[0];

    await expect(
      ctx.transactionsService.deleteTransaction(
        returnStoreId,
        { transactionId: returnTx.id, expectedVersion: returnTx.version, reason: 'blocked-return-delete', compensation: { mode: 'none' } },
        { idempotencyKey: 'delete-reject-return', requestId: 'delete-reject-return' },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.TRANSACTION_MUTATION_INVALID_OPERATION }) });
  });

  test('update idempotency replay and conflict preserve state', async () => {
    const fixture = loadFixture('transactions_update_settlement_change_v1');
    const { ctx, tx, customer } = await createSaleFromFixture(fixture);

    const payload = { transactionId: tx.id, expectedVersion: tx.version, patch: fixture.update.patch };
    const key = `${fixture.name}-idem-update`;

    const first = await ctx.transactionsService.updateTransaction(fixture.storeId, payload, { idempotencyKey: key, requestId: key });
    expect(first.status).toBe('applied');
    const dueAfterFirst = (await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance;

    const replay = await ctx.transactionsService.updateTransaction(fixture.storeId, payload, { idempotencyKey: key, requestId: `${key}-replay` });
    expect(replay.status).toBe('replayed');
    expect((await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance).toBe(dueAfterFirst);

    await expect(
      ctx.transactionsService.updateTransaction(
        fixture.storeId,
        { ...payload, patch: { ...fixture.update.patch, note: 'different-payload' } },
        { idempotencyKey: key, requestId: `${key}-conflict` },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REUSED_DIFFERENT_PAYLOAD }) });
  });

  test('delete idempotency replay/conflict and repeated delete behavior are stable', async () => {
    const fixture = loadFixture('transactions_delete_no_compensation_v1');
    const { ctx, tx, product, customer } = await createSaleFromFixture(fixture);

    const payload = {
      transactionId: tx.id,
      expectedVersion: tx.version,
      reason: 'idem-delete',
      compensation: fixture.delete.compensation,
    };
    const key = `${fixture.name}-idempotent-delete`;

    const first = await ctx.transactionsService.deleteTransaction(fixture.storeId, payload, { idempotencyKey: key, requestId: key });
    expect(first.status).toBe('applied');
    const stockAfterFirst = (await ctx.productsService.getById(fixture.storeId, product!.id)).stock;
    const dueAfterFirst = (await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance;
    const deletedCountAfterFirst = (await ctx.transactionsService.listDeleted(fixture.storeId)).items.length;

    const replay = await ctx.transactionsService.deleteTransaction(fixture.storeId, payload, { idempotencyKey: key, requestId: `${key}-replay` });
    expect(replay.status).toBe('replayed');
    expect((await ctx.productsService.getById(fixture.storeId, product!.id)).stock).toBe(stockAfterFirst);
    expect((await ctx.customersService.getById(fixture.storeId, customer!.id)).dueBalance).toBe(dueAfterFirst);
    expect((await ctx.transactionsService.listDeleted(fixture.storeId)).items.length).toBe(deletedCountAfterFirst);

    await expect(
      ctx.transactionsService.deleteTransaction(
        fixture.storeId,
        { ...payload, compensation: { mode: 'cash_refund', amount: 1, note: 'different-comp' } },
        { idempotencyKey: key, requestId: `${key}-conflict` },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.TRANSACTION_MUTATION_IDEMPOTENCY_KEY_REUSED_DIFFERENT_PAYLOAD }) });

    await expect(
      ctx.transactionsService.deleteTransaction(
        fixture.storeId,
        { ...payload, expectedVersion: tx.version + 1 },
        { idempotencyKey: `${key}-fresh-second-delete`, requestId: `${key}-fresh-second-delete` },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.TRANSACTION_NOT_FOUND }) });
  });

});
