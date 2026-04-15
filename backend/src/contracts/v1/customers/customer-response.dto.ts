import { CustomerDto } from './customer.types';

export class CustomerResponseDto {
  customer!: CustomerDto;
}

export class CustomerListResponseDto {
  customers!: CustomerDto[];
}
