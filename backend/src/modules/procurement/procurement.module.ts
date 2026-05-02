import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ProcurementController } from './procurement.controller';
import { ProcurementRepository } from './procurement.repository';
import { ProcurementService } from './procurement.service';

@Module({
  imports: [AuthModule, TenancyModule, ProductsModule],
  controllers: [ProcurementController],
  providers: [ProcurementRepository, ProcurementService],
  exports: [ProcurementService, ProcurementRepository],
})
export class ProcurementModule {}
