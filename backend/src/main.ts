import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggerService } from './common/logger/logger.service';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { createGlobalValidationPipe } from './common/pipes/global-validation.pipe';
import { AppConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = app.get(LoggerService);

  app.use(new RequestIdMiddleware().use);
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.setGlobalPrefix(`${config.apiPrefix}/${config.apiVersion}`);
  if (config.securityEnableCors) {
    app.enableCors();
  }
  app.useLogger(logger);

  await app.listen(config.port);
  logger.log(`Backend scaffold started on port ${config.port}`);
}

bootstrap();
