import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TrackingService } from '../tracking/tracking.service';
import { MqttClient } from './mqtt.client';

@Injectable()
export class MqttSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttSubscriber.name);

  constructor(
    private readonly mqttClient: MqttClient,
    private readonly configService: AppConfigService,
    private readonly trackingService: TrackingService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.setupSubscriptions();
    this.setupMessageHandler();
  }

  async onModuleDestroy(): Promise<void> {
    await this.teardownSubscriptions();
  }

  /**
   * Set up subscriptions to configured MQTT topics
   */
  private async setupSubscriptions(): Promise<void> {
    const topics = this.configService.mqtt.topics;

    this.logger.log(`Setting up subscriptions for topics: ${topics.join(', ')}`);

    try {
      for (const topic of topics) {
        await this.mqttClient.subscribe(topic);
      }
      this.logger.log('Successfully subscribed to all tracking topics');
    } catch (error) {
      this.logger.error('Failed to subscribe to topics', error);
      throw error;
    }
  }

  /**
   * Tear down subscriptions when module is destroyed
   */
  private async teardownSubscriptions(): Promise<void> {
    const topics = this.configService.mqtt.topics;

    try {
      for (const topic of topics) {
        await this.mqttClient.unsubscribe(topic);
      }
      this.logger.log('Successfully unsubscribed from all tracking topics');
    } catch (error) {
      this.logger.warn('Error unsubscribing from topics', error);
    }
  }

  /**
   * Set up the message handler for incoming MQTT messages
   */
  private setupMessageHandler(): void {
    this.mqttClient.on('message', (topic: string, payload: Buffer) => {
      this.handleMessage(topic, payload).catch((error) => {
        this.logger.error('Error handling MQTT message', {
          topic,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    this.logger.log('MQTT message handler set up');
  }

  /**
   * Handle an incoming MQTT message
   */
  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    this.logger.debug(`Received message on topic: ${topic}`);

    // Parse the JSON payload
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload.toString('utf-8'));
    } catch (error) {
      this.logger.warn('Failed to parse MQTT message as JSON', {
        topic,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    // Process the tracking data through the Effect pipeline
    const update = await this.trackingService.processTrackingPayload(
      parsedPayload,
      (positionUpdate) => {
        // Broadcast the position update via WebSocket
        this.realtimeGateway.broadcastPositionUpdate(positionUpdate);
      },
    );

    if (update) {
      this.logger.debug(
        `Successfully processed tracking update for participant ${update.participantId}`,
      );
    }
  }

  /**
   * Get the topic pattern for a specific race
   */
  static getRaceTopicPattern(raceId: string): string {
    return `tracking/${raceId}/+/position`;
  }

  /**
   * Get the topic pattern for a specific participant
   */
  static getParticipantTopic(raceId: string, participantId: string): string {
    return `tracking/${raceId}/${participantId}/position`;
  }

  /**
   * Subscribe to a specific race's tracking updates
   */
  async subscribeToRace(raceId: string): Promise<void> {
    const topic = MqttSubscriber.getRaceTopicPattern(raceId);
    await this.mqttClient.subscribe(topic);
    this.logger.log(`Subscribed to race ${raceId} tracking updates`);
  }

  /**
   * Unsubscribe from a specific race's tracking updates
   */
  async unsubscribeFromRace(raceId: string): Promise<void> {
    const topic = MqttSubscriber.getRaceTopicPattern(raceId);
    await this.mqttClient.unsubscribe(topic);
    this.logger.log(`Unsubscribed from race ${raceId} tracking updates`);
  }
}
