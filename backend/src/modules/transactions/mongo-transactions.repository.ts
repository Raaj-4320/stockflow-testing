import { Injectable } from '@nestjs/common';

import { MongoDbService } from '../../infrastructure/mongodb/mongodb.service';
import { TransactionDto } from '../../contracts/v1/transactions/transaction.types';

@Injectable()
export class MongoTransactionsRepository {
  constructor(private readonly mongo: MongoDbService) {}

  async findAll(storeId: string): Promise<TransactionDto[]> {
    const docs = await this.mongo
      .getDb()
      .collection('transactions')
      .find({ storeId })
      .sort({ transactionDate: -1 })
      .toArray();

    return docs.map((doc) => this.normalize(doc));
  }

  async findById(storeId: string, id: string): Promise<TransactionDto | null> {
    const doc = await this.mongo.getDb().collection('transactions').findOne({ storeId, id });
    if (!doc) return null;
    return this.normalize(doc);
  }

  private normalize(doc: any): TransactionDto {
    return { ...doc, id: String(doc.id ?? doc._id) } as TransactionDto;
  }
}
