import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthTenantErrorCode } from '../../contracts/v1/common/error-codes';
import { AppConfigService } from '../../config/config.service';
import { AuthService } from '../../modules/auth/auth.service';
import { REQUIRE_VERIFIED_KEY } from '../../modules/auth/decorators/require-verified.decorator';
import { AuthenticatedRequest } from '../types/request-context';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.header('authorization');

    if (!this.config.authRequired) {
      request.authContext = {
        actorId: this.config.authDevActorId,
        verified: this.config.authDevVerified,
        defaultStoreId: this.config.authDevDefaultStoreId,
        allowedStoreIds: [this.config.authDevDefaultStoreId],
        roles: ['owner'],
      };
      return true;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: AuthTenantErrorCode.AUTH_MISSING_TOKEN,
        message: 'Missing or invalid bearer token.',
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const authContext = await this.authService.validateToken(token);

    if (!authContext) {
      throw new UnauthorizedException({
        code: AuthTenantErrorCode.AUTH_INVALID_TOKEN,
        message: 'Token validation failed.',
      });
    }

    const requireVerified = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requireVerified && !authContext.verified) {
      throw new ForbiddenException({
        code: AuthTenantErrorCode.AUTH_VERIFICATION_REQUIRED,
        message: 'Verified user is required for this endpoint.',
      });
    }

    request.authContext = authContext;
    return true;
  }
}
