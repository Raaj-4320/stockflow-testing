import { Module } from '@nestjs/common';

import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TOKEN_VALIDATOR } from './interfaces/token-validator.interface';
import { StaticTokenValidator } from './static-token.validator';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    StaticTokenValidator,
    {
      provide: TOKEN_VALIDATOR,
      useExisting: StaticTokenValidator,
    },
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
