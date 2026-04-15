import { Injectable } from '@nestjs/common';

import { AuthContextDto } from '../../contracts/v1/auth/auth-context.dto';
import { TenantContextDto } from '../../contracts/v1/tenancy/tenant-context.dto';

@Injectable()
export class TenancyService {
  resolveTenantContext(
    authContext: AuthContextDto,
    requestedStoreId: string | undefined,
  ): TenantContextDto | null {
    if (requestedStoreId && requestedStoreId.trim().length > 0) {
      const normalized = requestedStoreId.trim();
      if (!authContext.allowedStoreIds.includes(normalized)) {
        return null;
      }

      return {
        storeId: normalized,
        source: 'request_header',
      };
    }

    return {
      storeId: authContext.defaultStoreId,
      source: 'auth_default',
    };
  }
}
