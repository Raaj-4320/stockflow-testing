import { Request } from 'express';

import { AuthContextDto } from '../../contracts/v1/auth/auth-context.dto';
import { TenantContextDto } from '../../contracts/v1/tenancy/tenant-context.dto';

export type AuthenticatedRequest = Request & {
  authContext?: AuthContextDto;
  tenantContext?: TenantContextDto;
};
