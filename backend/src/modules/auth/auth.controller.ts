import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/guards/auth.guard';
import { LoginRequestDto } from '../../contracts/v1/auth/login-request.dto';
import { LoginResponseDto } from '../../contracts/v1/auth/login-response.dto';
import { AuthService } from './auth.service';
import { CurrentAuthContext } from './decorators/current-auth-context.decorator';
import { RequireVerified } from './decorators/require-verified.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() payload: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(payload);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentAuthContext() authContext: unknown): unknown {
    return { authContext };
  }

  @Get('verified-check')
  @UseGuards(AuthGuard)
  @RequireVerified()
  verifiedCheck(): { ok: boolean } {
    return { ok: true };
  }
}
