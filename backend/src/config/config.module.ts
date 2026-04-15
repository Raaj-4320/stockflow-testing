import { Global, Module } from '@nestjs/common';

import { AppConfigService } from './config.service';
import { envSchema } from './env.schema';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useValue: new AppConfigService(parsed.data),
    },
  ],
  exports: [AppConfigService],
})
export class ConfigModule {}
