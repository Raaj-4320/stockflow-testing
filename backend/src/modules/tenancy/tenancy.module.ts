import { Module } from '@nestjs/common';

import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthModule } from '../auth/auth.module';
import { TenancyController } from './tenancy.controller';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [AuthModule],
  controllers: [TenancyController],
  providers: [TenancyService, TenantGuard],
  exports: [TenancyService, TenantGuard],
})
export class TenancyModule {}
