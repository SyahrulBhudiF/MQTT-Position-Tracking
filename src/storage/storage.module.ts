import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database';
import { PostgresService } from './postgres.service';
import { RedisService } from './redis.service';

@Module({
  imports: [DatabaseModule],
  providers: [RedisService, PostgresService],
  exports: [RedisService, PostgresService],
})
export class StorageModule {}
