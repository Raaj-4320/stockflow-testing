import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Skeleton only: real permission matrix is deferred.
    return true;
  }
}
