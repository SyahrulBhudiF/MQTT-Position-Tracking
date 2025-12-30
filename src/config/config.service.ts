import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface MqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId: string;
  topics: string[];
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface PostgresConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface WebSocketConfig {
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

export interface AppConfig {
  port: number;
  environment: string;
  staleDataThresholdMs: number;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get app(): AppConfig {
    return {
      port: this.configService.get<number>("PORT", 3000),
      environment: this.configService.get<string>("NODE_ENV", "development"),
      staleDataThresholdMs: this.configService.get<number>(
        "STALE_DATA_THRESHOLD_MS",
        30000,
      ),
    };
  }

  get mqtt(): MqttConfig {
    return {
      brokerUrl: this.configService.getOrThrow<string>("MQTT_BROKER_URL"),
      username: this.configService.get<string>("MQTT_USERNAME"),
      password: this.configService.get<string>("MQTT_PASSWORD"),
      clientId: this.configService.get<string>(
        "MQTT_CLIENT_ID",
        `tracking-backend-${Date.now()}`,
      ),
      topics: this.configService
        .get<string>("MQTT_TOPICS", "tracking/+/position")
        .split(",")
        .map((t) => t.trim()),
    };
  }

  get redis(): RedisConfig {
    return {
      host: this.configService.get<string>("REDIS_HOST", "localhost"),
      port: this.configService.get<number>("REDIS_PORT", 6379),
      password: this.configService.get<string>("REDIS_PASSWORD"),
      db: this.configService.get<number>("REDIS_DB", 0),
    };
  }

  get postgres(): PostgresConfig {
    return {
      host: this.configService.get<string>("POSTGRES_HOST", "localhost"),
      port: this.configService.get<number>("POSTGRES_PORT", 5432),
      username: this.configService.get<string>("POSTGRES_USERNAME", "postgres"),
      password: this.configService.getOrThrow<string>("POSTGRES_PASSWORD"),
      database: this.configService.get<string>("POSTGRES_DATABASE", "tracking"),
    };
  }

  get websocket(): WebSocketConfig {
    const corsOrigin = this.configService.get<string>("WS_CORS_ORIGIN", "*");
    return {
      port: this.configService.get<number>("WS_PORT", 3001),
      cors: {
        origin: corsOrigin.includes(",")
          ? corsOrigin.split(",").map((o) => o.trim())
          : corsOrigin,
        credentials: this.configService.get<boolean>(
          "WS_CORS_CREDENTIALS",
          true,
        ),
      },
    };
  }

  isDevelopment(): boolean {
    return this.app.environment === "development";
  }

  isProduction(): boolean {
    return this.app.environment === "production";
  }
}
