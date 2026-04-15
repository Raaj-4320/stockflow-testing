import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const idempotencyKey = req.header('idempotency-key');

    if (idempotencyKey) {
      req.headers['idempotency-key'] = idempotencyKey;
    }

    next();
  }
}
