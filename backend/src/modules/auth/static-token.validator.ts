import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/config.service';
import { AuthContextDto } from '../../contracts/v1/auth/auth-context.dto';
import { TokenValidator } from './interfaces/token-validator.interface';

@Injectable()
export class StaticTokenValidator implements TokenValidator {
  constructor(private readonly config: AppConfigService) {}

  async validateBearerToken(token: string): Promise<AuthContextDto | null> {
    if (!token || token !== this.config.authDevStaticToken) {
      return null;
    }

    return {
      actorId: this.config.authDevActorId,
      verified: this.config.authDevVerified,
      defaultStoreId: this.config.authDevDefaultStoreId,
      allowedStoreIds: [this.config.authDevDefaultStoreId],
      roles: ['owner'],
    };
  }
}
