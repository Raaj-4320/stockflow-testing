import { NotFoundException } from '@nestjs/common';

import { AuthTenantErrorCode } from '../../src/contracts/v1/common/error-codes';
import { ProductsRepository } from '../../src/modules/products/products.repository';
import { ProcurementRepository } from '../../src/modules/procurement/procurement.repository';
import { ProcurementService } from '../../src/modules/procurement/procurement.service';

describe('Procurement read baseline', () => {
  const createContext = () => {
    const repository = new ProcurementRepository();
    const productsRepository = new ProductsRepository();
    const service = new ProcurementService(repository, productsRepository);
    return { repository, service, productsRepository };
  };

  test('list parties returns store-scoped parties', async () => {
    const { repository, service } = createContext();

    await repository.seedParty('store-a', { id: 'p1', name: 'Alpha Traders', phone: '+1-555-1111' });
    await repository.seedParty('store-b', { id: 'p2', name: 'Other Store Party', phone: '+1-555-2222' });

    const parties = await service.listParties('store-a', {});
    expect(parties).toHaveLength(1);
    expect(parties[0].name).toBe('Alpha Traders');
  });

  test('get party by id returns party in same store', async () => {
    const { repository, service } = createContext();

    await repository.seedParty('store-a', { id: 'party-1', name: 'Prime Supplier' });
    const party = await service.getPartyById('store-a', 'party-1');

    expect(party.id).toBe('party-1');
    expect(party.name).toBe('Prime Supplier');
  });

  test('get party by id enforces tenant isolation and not found behavior', async () => {
    const { repository, service } = createContext();

    await repository.seedParty('store-a', { id: 'party-iso', name: 'Iso Party' });

    await expect(service.getPartyById('store-b', 'party-iso')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getPartyById('store-b', 'party-iso')).rejects.toMatchObject({
      response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_PARTY_NOT_FOUND }),
    });
  });

  test('list orders returns store-scoped orders', async () => {
    const { repository, service } = createContext();

    await repository.seedOrder('store-a', {
      id: 'o1',
      partyId: 'p1',
      partyName: 'Alpha Traders',
      status: 'draft',
      lines: [{ productName: 'Cotton Shirt', sourceType: 'inventory', quantity: 5, unitCost: 100 }],
    });
    await repository.seedOrder('store-b', {
      id: 'o2',
      partyId: 'p2',
      partyName: 'Other Store',
      status: 'placed',
      lines: [{ productName: 'Jeans', sourceType: 'inventory', quantity: 3, unitCost: 200 }],
    });

    const orders = await service.listOrders('store-a', {});
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('o1');
  });

  test('get order by id returns order in same store', async () => {
    const { repository, service } = createContext();

    await repository.seedOrder('store-a', {
      id: 'order-1',
      partyId: 'party-1',
      partyName: 'Prime Supplier',
      status: 'placed',
      lines: [{ productName: 'Sneakers', sourceType: 'new', quantity: 2, unitCost: 500 }],
    });

    const order = await service.getOrderById('store-a', 'order-1');
    expect(order.id).toBe('order-1');
    expect(order.partyName).toBe('Prime Supplier');
  });

  test('get order by id enforces tenant isolation and not found behavior', async () => {
    const { repository, service } = createContext();

    await repository.seedOrder('store-a', {
      id: 'order-iso',
      partyId: 'party-iso',
      partyName: 'Iso Supplier',
      status: 'draft',
      lines: [{ productName: 'Cap', sourceType: 'inventory', quantity: 1, unitCost: 50 }],
    });

    await expect(service.getOrderById('store-b', 'order-iso')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getOrderById('store-b', 'order-iso')).rejects.toMatchObject({
      response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_NOT_FOUND }),
    });
  });

  test('create party and reject duplicate party in same store', async () => {
    const { service } = createContext();
    const created = await service.createParty('store-a', { name: 'Unique Party', phone: '+1-555-1000' });
    expect(created.name).toBe('Unique Party');

    await expect(
      service.createParty('store-a', { name: 'Unique Party', phone: '+1-555-1000' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_PARTY_DUPLICATE }),
    });
  });

  test('update party with optimistic version check', async () => {
    const { service, repository } = createContext();
    const created = await repository.seedParty('store-a', { id: 'party-v', name: 'Version Party' });

    await expect(
      service.updateParty('store-a', created.id, { id: created.id, expectedVersion: created.version + 1, name: 'Changed' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_VERSION_CONFLICT }),
    });

    const updated = await service.updateParty('store-a', created.id, { id: created.id, expectedVersion: created.version, name: 'Changed' });
    expect(updated.name).toBe('Changed');
    expect(updated.version).toBe(created.version + 1);
  });

  test('create order supports inventory-source and new-source lines and preserves sourceType', async () => {
    const { service, repository } = createContext();
    const party = await repository.seedParty('store-a', { id: 'party-order', name: 'Order Party' });

    const orderInventory = await service.createOrder('store-a', {
      partyId: party.id,
      lines: [{ productName: 'Existing Product', productId: 'prod-1', sourceType: 'inventory', quantity: 2, unitCost: 100 }],
      billNumber: 'BILL-100',
      billDate: '2026-04-30',
      gstPercent: 5,
    });
    expect(orderInventory.lines[0].sourceType).toBe('inventory');

    const orderNew = await service.createOrder('store-a', {
      partyId: party.id,
      lines: [{ productName: 'Pending New Product', sourceType: 'new', quantity: 1, unitCost: 200, pendingProductBarcode: 'PEND-1' }],
      gstPercent: 12,
    });
    expect(orderNew.lines[0].sourceType).toBe('new');
  });

  test('update order before received succeeds and update on received is rejected', async () => {
    const { service, repository } = createContext();
    const party = await repository.seedParty('store-a', { id: 'party-uo', name: 'Party UO' });
    const order = await repository.seedOrder('store-a', {
      id: 'order-uo',
      partyId: party.id,
      partyName: party.name,
      status: 'draft',
      lines: [{ productName: 'Line A', sourceType: 'inventory', quantity: 1, unitCost: 50 }],
      version: 1,
    });

    const updated = await service.updateOrder('store-a', order.id, {
      id: order.id,
      expectedVersion: order.version,
      lines: [{ productName: 'Line B', sourceType: 'new', quantity: 2, unitCost: 60 }],
      gstPercent: 18,
    });
    expect(updated.lines[0].productName).toBe('Line B');
    expect(updated.gstPercent).toBe(18);

    const received = await repository.seedOrder('store-a', {
      id: 'order-received',
      partyId: party.id,
      partyName: party.name,
      status: 'received',
      lines: [{ productName: 'Locked', sourceType: 'inventory', quantity: 1, unitCost: 10 }],
      version: 1,
    });
    await expect(
      service.updateOrder('store-a', received.id, { id: received.id, expectedVersion: 1, notes: 'should-fail' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AuthTenantErrorCode.PROCUREMENT_ORDER_ALREADY_RECEIVED }),
    });
  });

  test('create/update procurement do not mutate products inventory', async () => {
    const { service, repository, productsRepository } = createContext();
    const party = await repository.seedParty('store-a', { id: 'party-safe', name: 'Safe Party' });
    const product = await productsRepository.create('store-a', {
      name: 'Inventory Baseline',
      barcode: 'INV-BASE-1',
      category: 'test',
      buyPrice: 20,
      sellPrice: 40,
      stock: 15,
      variants: [],
      colors: [],
      stockByVariantColor: [],
      imageUrl: null,
    });

    const created = await service.createOrder('store-a', {
      partyId: party.id,
      lines: [{ productName: 'Inventory Baseline', productId: product.id, sourceType: 'inventory', quantity: 3, unitCost: 25 }],
    });
    await service.updateOrder('store-a', created.id, {
      id: created.id,
      expectedVersion: created.version,
      notes: 'update without inventory mutation',
    });

    const productAfter = await productsRepository.findById('store-a', product.id);
    expect(productAfter?.stock).toBe(15);
    expect(productAfter?.buyPrice).toBe(20);
  });
});
