import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [AuthModule, TenancyModule, TransactionsModule, CustomersModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
