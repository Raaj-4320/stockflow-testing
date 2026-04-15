import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { AppConfigService } from '../../config/config.service';

@Injectable()
export class MongoDbService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    // Skeleton only: real DB connection will be implemented in next phase.
    void this.config.mongodbUri;
  }

  async onModuleDestroy(): Promise<void> {
    // Skeleton only: close connection in implementation phase.
  }

  async ping(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
