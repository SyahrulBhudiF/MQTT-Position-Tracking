import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database";
import { RedisService } from "./redis.service";

@Module({
  imports: [DatabaseModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class StorageModule {}
