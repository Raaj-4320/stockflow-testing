import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { CustomersController } from './customers.controller';
import { CustomersRepository } from './customers.repository';
import { MongoCustomersRepository } from './mongo-customers.repository';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule, TenancyModule],
  controllers: [CustomersController],
  providers: [CustomersRepository, MongoCustomersRepository, CustomersService],
  exports: [CustomersService, CustomersRepository],
})
export class CustomersModule {}
