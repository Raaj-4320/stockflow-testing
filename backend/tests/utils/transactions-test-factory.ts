import { CustomersRepository } from '../../src/modules/customers/customers.repository';
import { CustomersService } from '../../src/modules/customers/customers.service';
import { IdempotencyService } from '../../src/infrastructure/idempotency/idempotency.service';
import { ProductsRepository } from '../../src/modules/products/products.repository';
import { ProductsService } from '../../src/modules/products/products.service';
import { TransactionsRepository } from '../../src/modules/transactions/transactions.repository';
import { TransactionsService } from '../../src/modules/transactions/transactions.service';

export const createTransactionsTestContext = () => {
  const productsRepository = new ProductsRepository();
  const customersRepository = new CustomersRepository();
  const transactionsRepository = new TransactionsRepository();
  const idempotencyService = new IdempotencyService();

  const productsService = new ProductsService(productsRepository);
  const customersService = new CustomersService(customersRepository);
  const transactionsService = new TransactionsService(
    transactionsRepository,
    productsRepository,
    customersRepository,
    idempotencyService,
  );

  return {
    productsRepository,
    customersRepository,
    transactionsRepository,
    productsService,
    customersService,
    transactionsService,
  };
};
