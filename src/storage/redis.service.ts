import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Effect } from 'effect';
import Redis from 'ioredis';
import { AppConfigService } from '../config/config.service';
import type { ProcessedPosition, RaceParticipantKey } from '../shared/types';

export class RedisConnectionError extends Error {
  readonly _tag = 'RedisConnectionError';
  constructor(message: string) {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

export class RedisOperationError extends Error {
  readonly _tag = 'RedisOperationError';
  constructor(
    message: string,
    public readonly operation: string,
  ) {
    super(message);
    this.name = 'RedisOperationError';
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: AppConfigService) {
    const config = this.configService.redis;
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit(): Promise<void> {
    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis connection closed gracefully');
  }

  /**
   * Generate Redis key for participant's last known position
   */
  private getPositionKey(key: RaceParticipantKey): string {
    return `race:${key.raceId}:participant:${key.participantId}:last`;
  }

  /**
   * Store last known position for a participant
   */
  setLastPosition(
    key: RaceParticipantKey,
    position: ProcessedPosition,
  ): Effect.Effect<void, RedisOperationError, never> {
    return Effect.tryPromise({
      try: async () => {
        const redisKey = this.getPositionKey(key);
        await this.client.set(redisKey, JSON.stringify(position), 'EX', 3600); // 1 hour TTL
      },
      catch: (error) =>
        new RedisOperationError(
          `Failed to set position: ${error instanceof Error ? error.message : String(error)}`,
          'setLastPosition',
        ),
    });
  }

  /**
   * Get last known position for a participant
   */
  getLastPosition(
    key: RaceParticipantKey,
  ): Effect.Effect<ProcessedPosition | null, RedisOperationError, never> {
    return Effect.tryPromise({
      try: async () => {
        const redisKey = this.getPositionKey(key);
        const data = await this.client.get(redisKey);
        if (!data) return null;
        return JSON.parse(data) as ProcessedPosition;
      },
      catch: (error) =>
        new RedisOperationError(
          `Failed to get position: ${error instanceof Error ? error.message : String(error)}`,
          'getLastPosition',
        ),
    });
  }

  /**
   * Get all participant positions for a race
   */
  getRacePositions(raceId: string): Effect.Effect<ProcessedPosition[], RedisOperationError, never> {
    return Effect.tryPromise({
      try: async () => {
        const pattern = `race:${raceId}:participant:*:last`;
        const keys = await this.client.keys(pattern);

        if (keys.length === 0) return [];

        const values = await this.client.mget(...keys);
        return values
          .filter((v): v is string => v !== null)
          .map((v) => JSON.parse(v) as ProcessedPosition);
      },
      catch: (error) =>
        new RedisOperationError(
          `Failed to get race positions: ${error instanceof Error ? error.message : String(error)}`,
          'getRacePositions',
        ),
    });
  }

  /**
   * Delete position for a participant
   */
  deletePosition(key: RaceParticipantKey): Effect.Effect<void, RedisOperationError, never> {
    return Effect.tryPromise({
      try: async () => {
        const redisKey = this.getPositionKey(key);
        await this.client.del(redisKey);
      },
      catch: (error) =>
        new RedisOperationError(
          `Failed to delete position: ${error instanceof Error ? error.message : String(error)}`,
          'deletePosition',
        ),
    });
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.client.status === 'ready';
  }

  /**
   * Ping Redis to check connectivity
   */
  ping(): Effect.Effect<string, RedisConnectionError, never> {
    return Effect.tryPromise({
      try: () => this.client.ping(),
      catch: (error) =>
        new RedisConnectionError(
          `Redis ping failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });
  }
}
