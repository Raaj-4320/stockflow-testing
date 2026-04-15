import { Global, Module } from '@nestjs/common';

import { MongoDbService } from './mongodb.service';

@Global()
@Module({
  providers: [MongoDbService],
  exports: [MongoDbService],
})
export class MongoDbModule {}
