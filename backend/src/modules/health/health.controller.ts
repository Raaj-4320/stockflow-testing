import { Controller, Get } from '@nestjs/common';

import { MongoDbService } from '../../infrastructure/mongodb/mongodb.service';

@Controller('health')
export class HealthController {
  constructor(private readonly mongo: MongoDbService) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string; checks: { mongodb: boolean } }> {
    const ping = await this.mongo.ping();
    return { status: ping.ok ? 'ready' : 'not_ready', checks: { mongodb: ping.ok } };
  }
}
