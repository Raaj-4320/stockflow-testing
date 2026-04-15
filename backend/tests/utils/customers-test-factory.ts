import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCustomerDto } from '../../src/contracts/v1/customers/create-customer.dto';
import { CustomersRepository } from '../../src/modules/customers/customers.repository';
import { CustomersService } from '../../src/modules/customers/customers.service';

export const createCustomersTestContext = (): {
  repository: CustomersRepository;
  service: CustomersService;
} => {
  const repository = new CustomersRepository();
  const service = new CustomersService(repository);
  return { repository, service };
};

export const validateCreateCustomerPayload = async (payload: unknown): Promise<number> => {
  const dto = plainToInstance(CreateCustomerDto, payload);
  const errors = await validate(dto);
  return errors.length;
};
