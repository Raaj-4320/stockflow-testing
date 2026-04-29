import { Injectable } from '@nestjs/common';

import { CustomerDto } from '../../contracts/v1/customers/customer.types';
import { MongoDbService } from '../../infrastructure/mongodb/mongodb.service';

@Injectable()
export class MongoCustomersRepository {
  constructor(private readonly mongo: MongoDbService) {}

  async findAll(storeId: string): Promise<CustomerDto[]> {
    const docs = await this.mongo
      .getDb()
      .collection('customers')
      .find({ storeId })
      .sort({ updatedAt: -1 })
      .toArray();

    return docs.map((doc) => this.normalize(doc));
  }

  async findById(storeId: string, id: string): Promise<CustomerDto | null> {
    const doc = await this.mongo.getDb().collection('customers').findOne({ storeId, id });
    if (!doc) return null;
    return this.normalize(doc);
  }

  private normalize(doc: any): CustomerDto {
    return { ...doc, id: String(doc.id ?? doc._id) } as CustomerDto;
  }
}
