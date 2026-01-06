import { Injectable, Logger } from "@nestjs/common";
import { Effect, pipe } from "effect";
import { AppConfigService } from "../config/config.service";
import type { TrackingPosition } from "../database/schema";
import type { ProcessedPosition } from "../shared/types/tracking.types";
import { RedisService } from "../storage/redis.service";
import type { PositionUpdateDto } from "./dto/tracking.dto";
import {
  type TrackingEffectsConfig,
  type TrackingEffectsDeps,
  processTrackingDataWithLogging,
} from "./tracking.effects";
import { StorageError } from "./tracking.errors";
import { TrackingRepository } from "./tracking.repository";

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly effectsConfig: TrackingEffectsConfig;

  constructor(
    private readonly configService: AppConfigService,
    private readonly trackingRepository: TrackingRepository,
    private readonly redisService: RedisService,
  ) {
    this.effectsConfig = {
      staleDataThresholdMs: this.configService.app.staleDataThresholdMs,
    };
  }

  /**
   * Process incoming tracking data from MQTT
   * This is the main entry point for MQTT messages
   */
  async processTrackingPayload(
    rawPayload: unknown,
    broadcastFn: (update: PositionUpdateDto) => void,
  ): Promise<PositionUpdateDto | null> {
    const deps = this.createEffectsDeps(broadcastFn);

    const effect = processTrackingDataWithLogging(
      rawPayload,
      this.effectsConfig,
      deps,
      {
        debug: (msg, ctx) => this.logger.debug(msg, ctx),
        warn: (msg, ctx) => this.logger.warn(msg, ctx),
        error: (msg, ctx) => this.logger.error(msg, ctx),
      },
    );

    return Effect.runPromise(effect);
  }

  /**
   * Get position history for a participant
   */
  async getPositionHistory(
    participantId: string,
    raceId: string,
    limit = 100,
  ): Promise<TrackingPosition[]> {
    const effect = this.trackingRepository.findByParticipantAndRace(
      participantId,
      raceId,
      limit,
    );

    return Effect.runPromise(
      pipe(
        effect,
        Effect.catchTag("StorageError", (error) => {
          this.logger.error("Failed to get position history", {
            error: error.message,
            participantId,
            raceId,
          });
          return Effect.succeed([]);
        }),
      ),
    );
  }

  /**
   * Get all positions for a race
   */
  async getRacePositions(
    raceId: string,
    options?: { startTime?: Date; endTime?: Date; limit?: number },
  ): Promise<TrackingPosition[]> {
    const effect = this.trackingRepository.findByRace(raceId, options);

    return Effect.runPromise(
      pipe(
        effect,
        Effect.catchTag("StorageError", (error) => {
          this.logger.error("Failed to get race positions", {
            error: error.message,
            raceId,
          });
          return Effect.succeed([]);
        }),
      ),
    );
  }

  /**
   * Get the latest position for each participant in a race
   */
  async getLatestRacePositions(raceId: string): Promise<TrackingPosition[]> {
    const effect = this.trackingRepository.findLatestByRace(raceId);

    return Effect.runPromise(
      pipe(
        effect,
        Effect.catchTag("StorageError", (error) => {
          this.logger.error("Failed to get latest race positions", {
            error: error.message,
            raceId,
          });
          return Effect.succeed([]);
        }),
      ),
    );
  }

  /**
   * Get cached positions for a race from Redis
   */
  async getCachedRacePositions(raceId: string): Promise<ProcessedPosition[]> {
    const effect = this.redisService.getRacePositions(raceId);

    return Effect.runPromise(
      pipe(
        effect,
        Effect.catchTag("RedisOperationError", (error) => {
          this.logger.error("Failed to get cached race positions", {
            error: error.message,
            raceId,
          });
          return Effect.succeed([]);
        }),
      ),
    );
  }

  /**
   * Get the latest cached position for a participant
   */
  async getCachedParticipantPosition(
    participantId: string,
    raceId: string,
  ): Promise<ProcessedPosition | null> {
    const effect = this.redisService.getLastPosition({ participantId, raceId });

    return Effect.runPromise(
      pipe(
        effect,
        Effect.catchTag("RedisOperationError", (error) => {
          this.logger.error("Failed to get cached participant position", {
            error: error.message,
            participantId,
            raceId,
          });
          return Effect.succeed(null);
        }),
      ),
    );
  }

  /**
   * Delete old position records (cleanup job)
   */
  async cleanupOldPositions(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const effect = this.trackingRepository.deleteOlderThan(cutoffDate);

    return Effect.runPromise(
      pipe(
        effect,
        Effect.tap((count) =>
          Effect.sync(() => {
            this.logger.log(`Cleaned up ${count} old position records`);
          }),
        ),
        Effect.catchTag("StorageError", (error) => {
          this.logger.error("Failed to cleanup old positions", {
            error: error.message,
          });
          return Effect.succeed(0);
        }),
      ),
    );
  }

  /**
   * Count positions for a participant
   */
  async countParticipantPositions(
    participantId: string,
    raceId: string,
  ): Promise<number> {
    const effect = this.trackingRepository.countByParticipant(
      participantId,
      raceId,
    );

    return Effect.runPromise(
      pipe(
        effect,
        Effect.catchTag("StorageError", (error) => {
          this.logger.error("Failed to count participant positions", {
            error: error.message,
            participantId,
            raceId,
          });
          return Effect.succeed(0);
        }),
      ),
    );
  }

  /**
   * Create Effect dependencies for processing pipeline
   */
  private createEffectsDeps(
    broadcastFn: (update: PositionUpdateDto) => void,
  ): TrackingEffectsDeps {
    return {
      saveToRedis: (position: ProcessedPosition) =>
        pipe(
          this.redisService.setLastPosition(
            {
              participantId: position.participantId,
              raceId: position.raceId,
            },
            position,
          ),
          Effect.mapError(
            (error) =>
              new StorageError({
                message: error.message,
                operation: error.operation,
                cause: error,
              }),
          ),
        ),

      saveToPostgres: (position: ProcessedPosition) =>
        pipe(
          this.trackingRepository.save(position),
          Effect.map(() => undefined),
          Effect.mapError(
            (error) =>
              new StorageError({
                message: error.message,
                operation: "saveToPostgres",
                cause: error,
              }),
          ),
        ),

      broadcastPosition: (update: PositionUpdateDto) =>
        Effect.sync(() => {
          broadcastFn(update);
        }),
    };
  }
}
