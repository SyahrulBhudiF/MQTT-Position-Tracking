import { EventEmitter } from "node:events";
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import mqtt, {
  type IClientOptions,
  type MqttClient as MqttClientType,
} from "mqtt";
import type { QoS } from "mqtt-packet";
import { AppConfigService } from "../config/config.service";

export interface MqttClientEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  message: (topic: string, payload: Buffer) => void;
}

@Injectable()
export class MqttClient
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MqttClient.name);
  private client: MqttClientType | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private connectionPromise: Promise<void> | null = null;

  constructor(private readonly configService: AppConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Connect to the MQTT broker
   */
  async connect(): Promise<void> {
    // If already connecting, wait for that connection
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected, return immediately
    if (this.isConnected && this.client) {
      return Promise.resolve();
    }

    const config = this.configService.mqtt;

    this.logger.log(`Connecting to MQTT broker: ${config.brokerUrl}`);

    this.connectionPromise = new Promise((resolve, reject) => {
      const options: IClientOptions = {
        clientId: config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        keepalive: 60,
      };

      if (config.username && config.password) {
        options.username = config.username;
        options.password = config.password;
      }

      this.client = mqtt.connect(config.brokerUrl, options);

      const connectHandler = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.log("Connected to MQTT broker");
        this.emit("connected");
        resolve();
      };

      const errorHandler = (error: Error) => {
        this.logger.error("MQTT connection error", error);
        this.emit("error", error);
        if (!this.isConnected) {
          this.connectionPromise = null;
          reject(error);
        }
      };

      this.client.once("connect", connectHandler);
      this.client.once("error", errorHandler);

      this.client.on("close", () => {
        this.isConnected = false;
        this.connectionPromise = null;
        this.logger.warn("MQTT connection closed");
        this.emit("disconnected");
      });

      this.client.on("reconnect", () => {
        this.reconnectAttempts++;
        this.logger.log(
          `MQTT reconnecting... attempt ${this.reconnectAttempts}`,
        );

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.logger.error("Max reconnection attempts reached");
          this.client?.end(true);
        }
      });

      this.client.on("offline", () => {
        this.logger.warn("MQTT client is offline");
      });

      this.client.on("message", (topic, payload) => {
        this.emit("message", topic, payload);
      });
    });

    return this.connectionPromise;
  }

  /**
   * Wait for connection to be established
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`MQTT connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeout);
          resolve();
        } else {
          this.once("connected", () => {
            clearTimeout(timeout);
            resolve();
          });
        }
      };

      checkConnection();
    });
  }

  /**
   * Disconnect from the MQTT broker
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, {}, () => {
          this.logger.log("Disconnected from MQTT broker");
          this.isConnected = false;
          this.connectionPromise = null;
          this.client = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(topic: string | string[], qos: QoS = 1): Promise<void> {
    // Wait for connection if not connected
    if (!this.isConnected) {
      await this.waitForConnection();
    }

    if (!this.client) {
      throw new Error("MQTT client is not initialized");
    }

    return new Promise((resolve, reject) => {
      this.client?.subscribe(topic, { qos }, (error, granted) => {
        if (error) {
          this.logger.error(`Failed to subscribe to ${topic}`, error);
          reject(error);
        } else {
          const topics =
            granted?.map((g) => g.topic).join(", ") ?? String(topic);
          this.logger.log(`Subscribed to topics: ${topics}`);
          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic: string | string[]): Promise<void> {
    if (!(this.client && this.isConnected)) {
      this.logger.warn("MQTT client is not connected, skipping unsubscribe");
      return;
    }

    return new Promise((resolve, reject) => {
      this.client?.unsubscribe(topic, {}, (error) => {
        if (error) {
          this.logger.error(`Failed to unsubscribe from ${topic}`, error);
          reject(error);
        } else {
          this.logger.log(`Unsubscribed from ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Publish a message to a topic
   */
  async publish(
    topic: string,
    message: string | Buffer,
    qos: QoS = 1,
  ): Promise<void> {
    // Wait for connection if not connected
    if (!this.isConnected) {
      await this.waitForConnection();
    }

    if (!this.client) {
      throw new Error("MQTT client is not initialized");
    }

    return new Promise((resolve, reject) => {
      this.client?.publish(topic, message, { qos, retain: false }, (error) => {
        if (error) {
          this.logger.error(`Failed to publish to ${topic}`, error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if the client is connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the underlying MQTT client
   */
  getClient(): MqttClientType | null {
    return this.client;
  }
}
