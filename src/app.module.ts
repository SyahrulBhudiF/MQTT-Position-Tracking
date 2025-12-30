import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { MqttModule } from './mqtt/mqtt.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StorageModule } from './storage/storage.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [ConfigModule, StorageModule, TrackingModule, MqttModule, RealtimeModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
