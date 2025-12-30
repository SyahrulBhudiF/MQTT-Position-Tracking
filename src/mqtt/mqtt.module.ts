import { Module, forwardRef } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TrackingModule } from '../tracking/tracking.module';
import { MqttClient } from './mqtt.client';
import { MqttSubscriber } from './mqtt.subscriber';

@Module({
  imports: [forwardRef(() => TrackingModule), forwardRef(() => RealtimeModule)],
  providers: [MqttClient, MqttSubscriber],
  exports: [MqttClient, MqttSubscriber],
})
export class MqttModule {}
