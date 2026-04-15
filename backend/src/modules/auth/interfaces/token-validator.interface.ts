import { AuthContextDto } from '../../../contracts/v1/auth/auth-context.dto';

export interface TokenValidator {
  validateBearerToken(token: string): Promise<AuthContextDto | null>;
}

export const TOKEN_VALIDATOR = Symbol('TOKEN_VALIDATOR');
