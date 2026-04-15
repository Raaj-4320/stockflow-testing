import { SetMetadata } from '@nestjs/common';

export const REQUIRE_VERIFIED_KEY = 'require_verified';

export const RequireVerified = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_VERIFIED_KEY, true);
