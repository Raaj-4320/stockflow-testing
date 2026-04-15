import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenantContext } from './decorators/current-tenant-context.decorator';

@Controller('tenancy')
@UseGuards(AuthGuard, TenantGuard)
export class TenancyController {
  @Get('context')
  context(@CurrentTenantContext() tenantContext: unknown): { tenantContext: unknown } {
    return { tenantContext };
  }
}
