import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PurchaseOrderDto } from '../../contracts/v1/procurement/purchase-order.dto';
import { PurchasePartyDto } from '../../contracts/v1/procurement/purchase-party.dto';

@Injectable()
export class ProcurementRepository {
  private readonly parties = new Map<string, PurchasePartyDto>();
  private readonly orders = new Map<string, PurchaseOrderDto>();

  async findParties(storeId: string): Promise<PurchasePartyDto[]> {
    return [...this.parties.values()]
      .filter((p) => p.storeId === storeId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findPartyById(storeId: string, id: string): Promise<PurchasePartyDto | null> {
    const party = this.parties.get(this.key(storeId, id));
    return party ?? null;
  }

  async findOrders(storeId: string): Promise<PurchaseOrderDto[]> {
    return [...this.orders.values()]
      .filter((o) => o.storeId === storeId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findOrderById(storeId: string, id: string): Promise<PurchaseOrderDto | null> {
    const order = this.orders.get(this.key(storeId, id));
    return order ?? null;
  }

  async createParty(
    storeId: string,
    input: Omit<PurchasePartyDto, 'id' | 'storeId' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<PurchasePartyDto> {
    const now = new Date().toISOString();
    const party: PurchasePartyDto = {
      ...input,
      id: randomUUID(),
      storeId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.parties.set(this.key(storeId, party.id), party);
    return party;
  }

  async updateParty(
    storeId: string,
    id: string,
    input: Partial<Omit<PurchasePartyDto, 'id' | 'storeId' | 'createdAt' | 'version'>>,
  ): Promise<PurchasePartyDto | null> {
    const existing = await this.findPartyById(storeId, id);
    if (!existing) return null;
    const next: PurchasePartyDto = {
      ...existing,
      ...input,
      id: existing.id,
      storeId: existing.storeId,
      createdAt: existing.createdAt,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.parties.set(this.key(storeId, id), next);
    return next;
  }

  async createOrder(
    storeId: string,
    input: Omit<PurchaseOrderDto, 'id' | 'storeId' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<PurchaseOrderDto> {
    const now = new Date().toISOString();
    const order: PurchaseOrderDto = {
      ...input,
      id: randomUUID(),
      storeId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.orders.set(this.key(storeId, order.id), order);
    return order;
  }

  async updateOrder(
    storeId: string,
    id: string,
    input: Partial<Omit<PurchaseOrderDto, 'id' | 'storeId' | 'createdAt' | 'version'>>,
  ): Promise<PurchaseOrderDto | null> {
    const existing = await this.findOrderById(storeId, id);
    if (!existing) return null;
    const next: PurchaseOrderDto = {
      ...existing,
      ...input,
      id: existing.id,
      storeId: existing.storeId,
      createdAt: existing.createdAt,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(this.key(storeId, id), next);
    return next;
  }

  // Test seeding only
  async seedParty(storeId: string, input: Partial<PurchasePartyDto> & { name: string }): Promise<PurchasePartyDto> {
    const now = new Date().toISOString();
    const party: PurchasePartyDto = {
      id: input.id ?? randomUUID(),
      storeId,
      name: input.name,
      phone: input.phone ?? null,
      gst: input.gst ?? null,
      location: input.location ?? null,
      contactPerson: input.contactPerson ?? null,
      notes: input.notes ?? null,
      isArchived: input.isArchived ?? false,
      archivedAt: input.archivedAt ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      version: input.version ?? 1,
    };
    this.parties.set(this.key(storeId, party.id), party);
    return party;
  }

  // Test seeding only
  async seedOrder(storeId: string, input: Partial<PurchaseOrderDto> & { partyId: string; partyName: string; lines: PurchaseOrderDto['lines'] }): Promise<PurchaseOrderDto> {
    const now = new Date().toISOString();
    const totalQuantity = input.totalQuantity ?? input.lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalAmount = input.totalAmount ?? input.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const order: PurchaseOrderDto = {
      id: input.id ?? randomUUID(),
      storeId,
      partyId: input.partyId,
      partyName: input.partyName,
      status: input.status ?? 'draft',
      orderDate: input.orderDate ?? now,
      billNumber: input.billNumber ?? null,
      billDate: input.billDate ?? null,
      gstPercent: input.gstPercent ?? 0,
      lines: input.lines,
      totalQuantity,
      totalAmount,
      notes: input.notes ?? null,
      receivedQuantity: input.receivedQuantity ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      version: input.version ?? 1,
    };
    this.orders.set(this.key(storeId, order.id), order);
    return order;
  }

  private key(storeId: string, id: string): string {
    return `${storeId}::${id}`;
  }
}
