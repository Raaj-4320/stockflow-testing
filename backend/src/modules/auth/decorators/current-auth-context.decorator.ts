import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthContextDto } from '../../../contracts/v1/auth/auth-context.dto';
import { AuthenticatedRequest } from '../../../common/types/request-context';

export const CurrentAuthContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContextDto | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authContext;
  },
);
