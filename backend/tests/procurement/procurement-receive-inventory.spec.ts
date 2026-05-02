import { AuthTenantErrorCode } from '../../src/contracts/v1/common/error-codes';
import { ProductsRepository } from '../../src/modules/products/products.repository';
import { ProcurementRepository } from '../../src/modules/procurement/procurement.repository';
import { ProcurementService } from '../../src/modules/procurement/procurement.service';

describe('Procurement receive inventory-only phase', () => {
  const setup = async () => {
    const procurementRepository = new ProcurementRepository();
    const productsRepository = new ProductsRepository();
    const service = new ProcurementService(procurementRepository, productsRepository);

    const party = await procurementRepository.seedParty('store-a', { id: 'party-1', name: 'Supplier A' });
    const product = await productsRepository.create('store-a', {
      name: 'Classic Tee',
      barcode: 'TEE-1',
      category: 'apparel',
      imageUrl: null,
      buyPrice: 100,
      sellPrice: 200,
      stock: 10,
      variants: ['M'],
      colors: ['Blue'],
      stockByVariantColor: [{ variant: 'M', color: 'Blue', stock: 10 }],
    });

    const order = await procurementRepository.seedOrder('store-a', {
      id: 'po-1',
      partyId: party.id,
      partyName: party.name,
      status: 'placed',
      version: 1,
      lines: [{ productName: product.name, productId: product.id, sourceType: 'inventory', variant: 'M', color: 'Blue', quantity: 6, unitCost: 120 }],
    });

    return { service, productsRepository, procurementRepository, product, order, party };
  };

  test('receive applies stock/buy-price/history and marks order received', async () => {
    const { service, productsRepository, procurementRepository, order, product } = await setup();
    const response = await service.receiveOrder('store-a', order.id, {
      orderId: order.id,
      expectedVersion: 1,
      receiveMethod: 'avg_method_1',
      note: 'received-ok',
    });

    expect(response.status).toBe('applied');

    const nextProduct = await productsRepository.findById('store-a', product.id);
    expect(nextProduct?.stock).toBe(16);
    expect(nextProduct?.buyPrice).toBe(107.5);
    expect(nextProduct?.stockByVariantColor[0].stock).toBe(16);
    expect((nextProduct as any)?.purchaseHistory?.[0]).toMatchObject({
      reference: `PO:${order.id}`,
      previousStock: 10,
      nextStock: 16,
      previousBuyPrice: 100,
      nextBuyPrice: 107.5,
      receiveMethod: 'avg_method_1',
    });

    const nextOrder = await procurementRepository.findOrderById('store-a', order.id);
    expect(nextOrder?.status).toBe('received');
    expect(nextOrder?.receivedQuantity).toBe(order.totalQuantity);
  });

  test.each([
    ['no_change', 100],
    ['latest_purchase', 120],
    ['avg_method_1', 107.5],
    ['avg_method_2', 107.5],
  ] as const)('buy-price method %s is applied correctly', async (receiveMethod, expectedBuyPrice) => {
    const { service, productsRepository, procurementRepository, party, product } = await setup();
    const order = await procurementRepository.seedOrder('store-a', {
      id: `po-${receiveMethod}`,
      partyId: party.id,
      partyName: party.name,
      status: 'placed',
      version: 1,
      lines: [{ productName: product.name, productId: product.id, sourceType: 'inventory', variant: 'M', color: 'Blue', quantity: 6, unitCost: 120 }],
    });
    await service.receiveOrder('store-a', order.id, { orderId: order.id, expectedVersion: 1, receiveMethod });

    const nextProduct = await productsRepository.findById('store-a', product.id);
    expect(nextProduct?.buyPrice).toBe(expectedBuyPrice);
  });

  test('path/body order id mismatch is rejected', async () => {
    const { service, order } = await setup();
    await expect(
      service.receiveOrder('store-a', order.id, { orderId: 'other-id', expectedVersion: 1, receiveMethod: 'no_change' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_INVALID_ORDER_STATE }) });
  });

  test('version conflict is rejected', async () => {
    const { service, order } = await setup();
    await expect(
      service.receiveOrder('store-a', order.id, { orderId: order.id, expectedVersion: 999, receiveMethod: 'no_change' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_VERSION_CONFLICT }) });
  });

  test('duplicate receive is rejected and non-destructive', async () => {
    const { service, productsRepository, order, product } = await setup();
    await service.receiveOrder('store-a', order.id, { orderId: order.id, expectedVersion: 1, receiveMethod: 'latest_purchase' });

    await expect(
      service.receiveOrder('store-a', order.id, { orderId: order.id, expectedVersion: 2, receiveMethod: 'latest_purchase' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_ALREADY_RECEIVED }) });

    const nextProduct = await productsRepository.findById('store-a', product.id);
    expect(nextProduct?.stock).toBe(16);
  });

  test('tenant isolation', async () => {
    const { service, procurementRepository, productsRepository, party } = await setup();
    await expect(
      service.receiveOrder('store-b', 'po-1', { orderId: 'po-1', receiveMethod: 'no_change' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_NOT_FOUND }) });
    expect((await productsRepository.findMany('store-a', {})).length).toBeGreaterThan(0);
  });

  test('new-source product is materialized only on receive and mapped correctly', async () => {
    const { service, procurementRepository, productsRepository, party } = await setup();
    const beforeCount = (await productsRepository.findMany('store-a', {})).length;
    const order = await procurementRepository.seedOrder('store-a', {
      id: 'po-new-materialize',
      partyId: party.id,
      partyName: party.name,
      status: 'placed',
      version: 1,
      lines: [{ productName: 'Premium Hoodie', pendingProductBarcode: 'PEND-HOOD-001', sourceType: 'new', variant: 'L', color: 'Black', category: 'Apparel', image: '', quantity: 4, unitCost: 250 }],
    });
    expect((await productsRepository.findMany('store-a', {})).length).toBe(beforeCount);

    await service.receiveOrder('store-a', order.id, { orderId: order.id, expectedVersion: 1, receiveMethod: 'latest_purchase' });
    const all = await productsRepository.findMany('store-a', {});
    expect(all.length).toBe(beforeCount + 1);
    const materialized = all.find((p) => p.barcode === 'PEND-HOOD-001');
    expect(materialized).toBeDefined();
    expect(materialized).toMatchObject({
      name: 'Premium Hoodie',
      category: 'Apparel',
      buyPrice: 250,
      sellPrice: 250,
      stock: 4,
      imageUrl: null,
    });
    expect(materialized?.stockByVariantColor).toEqual([{ variant: 'L', color: 'Black', stock: 4 }]);
    expect((materialized as any)?.purchaseHistory?.[0]).toMatchObject({
      previousStock: 0,
      nextStock: 4,
      previousBuyPrice: 250,
      nextBuyPrice: 250,
      reference: `PO:${order.id}`,
    });
  });

  test('new-source duplicate barcode is rejected safely', async () => {
    const { service, procurementRepository, party } = await setup();
    const order = await procurementRepository.seedOrder('store-a', {
      id: 'po-new-dup',
      partyId: party.id,
      partyName: party.name,
      status: 'placed',
      lines: [{ productName: 'Dup', pendingProductBarcode: 'TEE-1', sourceType: 'new', quantity: 1, unitCost: 50 }],
    });
    await expect(
      service.receiveOrder('store-a', order.id, { orderId: order.id, receiveMethod: 'no_change' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: AuthTenantErrorCode.PRODUCT_DUPLICATE_BARCODE }) });
  });

  test('mixed inventory + new-source order applies both branches', async () => {
    const { service, procurementRepository, productsRepository, party, product } = await setup();
    const order = await procurementRepository.seedOrder('store-a', {
      id: 'po-mixed',
      partyId: party.id,
      partyName: party.name,
      status: 'placed',
      version: 1,
      lines: [
        { productName: product.name, productId: product.id, sourceType: 'inventory', variant: 'M', color: 'Blue', quantity: 2, unitCost: 120 },
        { productName: 'Joggers', pendingProductBarcode: 'PEND-JOG-1', sourceType: 'new', variant: 'XL', color: 'Gray', quantity: 3, unitCost: 140 },
      ],
    });
    await service.receiveOrder('store-a', order.id, { orderId: order.id, expectedVersion: 1, receiveMethod: 'no_change' });
    const inventoryUpdated = await productsRepository.findById('store-a', product.id);
    expect(inventoryUpdated?.stock).toBe(12);
    const materialized = await productsRepository.findByBarcode('store-a', 'PEND-JOG-1');
    expect(materialized?.stock).toBe(3);
  });
});
