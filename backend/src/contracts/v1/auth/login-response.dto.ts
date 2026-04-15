export class LoginResponseDto {
  accessToken!: string;
  tokenType!: 'Bearer';
  expiresInSeconds!: number;
  authContext!: {
    actorId: string;
    verified: boolean;
    defaultStoreId: string;
    allowedStoreIds: string[];
    roles: string[];
  };
}
