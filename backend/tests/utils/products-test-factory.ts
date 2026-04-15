import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateProductDto } from '../../src/contracts/v1/products/create-product.dto';
import { ProductsRepository } from '../../src/modules/products/products.repository';
import { ProductsService } from '../../src/modules/products/products.service';

export const createProductsTestContext = (): {
  repository: ProductsRepository;
  service: ProductsService;
} => {
  const repository = new ProductsRepository();
  const service = new ProductsService(repository);

  return { repository, service };
};

export const validateCreateProductPayload = async (payload: unknown): Promise<number> => {
  const dto = plainToInstance(CreateProductDto, payload);
  const errors = await validate(dto);
  return errors.length;
};
