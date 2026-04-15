import { Inject, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/config.service';
import { LoginRequestDto } from '../../contracts/v1/auth/login-request.dto';
import { LoginResponseDto } from '../../contracts/v1/auth/login-response.dto';
import { AuthContextDto } from '../../contracts/v1/auth/auth-context.dto';
import { TOKEN_VALIDATOR, TokenValidator } from './interfaces/token-validator.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject(TOKEN_VALIDATOR) private readonly tokenValidator: TokenValidator,
    private readonly config: AppConfigService,
  ) {}

  async validateToken(token: string): Promise<AuthContextDto | null> {
    return this.tokenValidator.validateBearerToken(token);
  }

  async login(_payload: LoginRequestDto): Promise<LoginResponseDto> {
    // Stubbed by design: full credential auth integration is deferred.
    return {
      accessToken: this.config.authDevStaticToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.config.authTokenTtlSeconds,
      authContext: {
        actorId: this.config.authDevActorId,
        verified: this.config.authDevVerified,
        defaultStoreId: this.config.authDevDefaultStoreId,
        allowedStoreIds: [this.config.authDevDefaultStoreId],
        roles: ['owner'],
      },
    };
  }
}
