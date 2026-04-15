export type AuthContextDto = {
  actorId: string;
  verified: boolean;
  defaultStoreId: string;
  allowedStoreIds: string[];
  roles: string[];
};

export type SessionContextDto = {
  requestId: string | null;
  auth: AuthContextDto;
};
