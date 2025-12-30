import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database';
import { StorageModule } from '../storage/storage.module';
import { TrackingRepository } from './tracking.repository';
import { TrackingService } from './tracking.service';

@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [TrackingService, TrackingRepository],
  exports: [TrackingService, TrackingRepository],
})
export class TrackingModule {}
