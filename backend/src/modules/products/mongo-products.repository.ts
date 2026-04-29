import { Injectable } from '@nestjs/common';

import { ProductDto } from '../../contracts/v1/products/product.types';
import { MongoDbService } from '../../infrastructure/mongodb/mongodb.service';

@Injectable()
export class MongoProductsRepository {
  constructor(private readonly mongo: MongoDbService) {}

  async findAll(storeId: string): Promise<ProductDto[]> {
    const docs = await this.mongo
      .getDb()
      .collection('products')
      .find({ storeId })
      .sort({ updatedAt: -1 })
      .toArray();

    return docs.map((doc) => this.normalize(doc));
  }

  async findById(storeId: string, id: string): Promise<ProductDto | null> {
    const doc = await this.mongo.getDb().collection('products').findOne({ storeId, id });
    if (!doc) return null;
    return this.normalize(doc);
  }

  private normalize(doc: any): ProductDto {
    return { ...doc, id: String(doc.id ?? doc._id) } as ProductDto;
  }
}
