import { Injectable } from '@nestjs/common';

import { EnvConfig } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly env: EnvConfig) {}

  get port(): number {
    return this.env.PORT;
  }

  get apiPrefix(): string {
    return this.env.API_PREFIX;
  }

  get apiVersion(): string {
    return this.env.API_VERSION;
  }

  get securityEnableCors(): boolean {
    return this.env.SECURITY_ENABLE_CORS;
  }

  get authRequired(): boolean {
    return this.env.AUTH_REQUIRED;
  }

  get authDevStaticToken(): string {
    return this.env.AUTH_DEV_STATIC_TOKEN;
  }

  get authDevActorId(): string {
    return this.env.AUTH_DEV_ACTOR_ID;
  }

  get authDevDefaultStoreId(): string {
    return this.env.AUTH_DEV_DEFAULT_STORE_ID;
  }

  get authDevVerified(): boolean {
    return this.env.AUTH_DEV_VERIFIED;
  }

  get authTokenTtlSeconds(): number {
    return this.env.AUTH_TOKEN_TTL_SECONDS;
  }

  get featureFlagProductsEnabled(): boolean {
    return this.env.FEATURE_FLAG_PRODUCTS_ENABLED;
  }

  get mongodbUri(): string {
    return this.env.MONGODB_URI;
  }

  get mongodbDbName(): string {
    return this.env.MONGODB_DB_NAME;
  }

  get mongodbAppName(): string {
    return this.env.MONGODB_APP_NAME;
  }
}
