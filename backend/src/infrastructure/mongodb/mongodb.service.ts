import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

import { AppConfigService } from '../../config/config.service';

@Injectable()
export class MongoDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoDbService.name);

  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    const client = new MongoClient(this.config.mongodbUri, {
      appName: this.config.mongodbAppName,
      minPoolSize: this.config.mongodbMinPoolSize,
      maxPoolSize: this.config.mongodbMaxPoolSize,
      serverSelectionTimeoutMS: this.config.mongodbServerSelectionTimeoutMs,
      socketTimeoutMS: this.config.mongodbSocketTimeoutMs,
    });

    try {
      await client.connect();
      const db = client.db(this.config.mongodbDbName);
      await db.command({ ping: 1 });

      this.client = client;
      this.db = db;

      this.logger.log(`Connected to MongoDB database "${this.config.mongodbDbName}".`);
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB during module init.', error as Error);
      await client.close();
      throw error;
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB connection is not initialized.');
    }

    return this.db;
  }

  async ping(): Promise<{ ok: boolean }> {
    if (!this.db) {
      return { ok: false };
    }

    try {
      const result = await this.db.command({ ping: 1 });
      return { ok: Number(result.ok) === 1 ? true : false };
    } catch {
      return { ok: false };
    }
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.close();
    this.client = null;
    this.db = null;
    this.logger.log('MongoDB connection closed.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
