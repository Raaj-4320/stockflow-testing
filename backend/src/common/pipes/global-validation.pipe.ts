import { ValidationPipe } from '@nestjs/common';

export const createGlobalValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
