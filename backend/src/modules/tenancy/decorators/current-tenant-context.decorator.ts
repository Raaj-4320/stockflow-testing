import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedRequest } from '../../../common/types/request-context';
import { TenantContextDto } from '../../../contracts/v1/tenancy/tenant-context.dto';

export const CurrentTenantContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContextDto | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenantContext;
  },
);
