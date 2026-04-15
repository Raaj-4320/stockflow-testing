import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import { TransactionMutationAcceptedResponseDto } from '../../contracts/v1/transactions/mutation-common.dto';

type IdempotencyRecord = {
  payloadHash: string;
  response: TransactionMutationAcceptedResponseDto;
};

@Injectable()
export class IdempotencyService {
  private readonly records = new Map<string, IdempotencyRecord>();

  hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  begin(
    key: { storeId: string; operation: string; idempotencyKey: string },
    payloadHash: string,
  ):
    | { type: 'replay'; response: TransactionMutationAcceptedResponseDto }
    | { type: 'new'; mutationId: string } {
    const storageKey = this.toStorageKey(key.storeId, key.operation, key.idempotencyKey);
    const existing = this.records.get(storageKey);
    if (existing) {
      return {
        type: 'replay',
        response: existing.response,
      };
    }

    return {
      type: 'new',
      mutationId: randomUUID(),
    };
  }

  payloadMatches(
    key: { storeId: string; operation: string; idempotencyKey: string },
    payloadHash: string,
  ): boolean {
    const storageKey = this.toStorageKey(key.storeId, key.operation, key.idempotencyKey);
    const existing = this.records.get(storageKey);
    if (!existing) {
      return true;
    }
    return existing.payloadHash === payloadHash;
  }

  complete(
    key: { storeId: string; operation: string; idempotencyKey: string },
    payloadHash: string,
    response: TransactionMutationAcceptedResponseDto,
  ): void {
    const storageKey = this.toStorageKey(key.storeId, key.operation, key.idempotencyKey);
    this.records.set(storageKey, {
      payloadHash,
      response,
    });
  }

  private toStorageKey(storeId: string, operation: string, idempotencyKey: string): string {
    return `${storeId}::${operation}::${idempotencyKey}`;
  }
}
