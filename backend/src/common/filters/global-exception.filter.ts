import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { StandardErrorEnvelope } from '../../contracts/v1/common/error-codes';

type ExceptionPayload = {
  code?: string;
  message?: string;
  fieldErrors?: Array<{ field: string; message: string }>;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let payload: ExceptionPayload = {};

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        payload.message = exceptionResponse;
      } else {
        payload = exceptionResponse as ExceptionPayload;
      }
    }

    const body: StandardErrorEnvelope = {
      code: payload.code ?? (status === 400 ? 'VALIDATION_ERROR' : 'UNHANDLED_ERROR'),
      message: payload.message ?? 'Unexpected server error',
      fieldErrors: payload.fieldErrors ?? [],
      requestId: (request.headers['x-request-id'] as string | undefined) ?? null,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
