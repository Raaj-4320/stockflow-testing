import { Injectable } from '@nestjs/common';

import { MongoDbService } from '../../infrastructure/mongodb/mongodb.service';
import { DeletedTransactionDto } from '../../contracts/v1/transactions/transaction.types';

@Injectable()
export class MongoDeletedTransactionsRepository {
  constructor(private readonly mongo: MongoDbService) {}

  async findAll(storeId: string): Promise<DeletedTransactionDto[]> {
    const docs = await this.mongo
      .getDb()
      .collection('deletedTransactions')
      .find({ storeId })
      .sort({ deletedAt: -1 })
      .toArray();

    return docs.map((doc) => ({ ...doc, id: String(doc.id ?? doc._id) })) as unknown as DeletedTransactionDto[];
  }
}
