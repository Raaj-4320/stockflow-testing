import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { AuthTenantErrorCode } from '../../contracts/v1/common/error-codes';
import { TenancyService } from '../../modules/tenancy/tenancy.service';
import { AuthenticatedRequest } from '../types/request-context';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenancyService: TenancyService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authContext) {
      throw new ForbiddenException({
        code: AuthTenantErrorCode.TENANT_CONTEXT_REQUIRED,
        message: 'Auth context is required before tenant resolution.',
      });
    }

    const requestedStoreId = request.header('x-store-id');
    const tenantContext = this.tenancyService.resolveTenantContext(request.authContext, requestedStoreId);

    if (!tenantContext) {
      throw new ForbiddenException({
        code: AuthTenantErrorCode.TENANT_ACCESS_DENIED,
        message: 'Resolved tenant is not allowed for current user.',
      });
    }

    request.tenantContext = tenantContext;
    return true;
  }
}
