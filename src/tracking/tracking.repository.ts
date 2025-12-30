import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { Effect } from 'effect';
import {
  DRIZZLE_PROVIDER,
  type DrizzleDB,
  type TrackingPosition,
  trackingPositions,
} from '../database';
import type { ProcessedPosition } from '../shared/types';
import { StorageError } from './tracking.errors';

@Injectable()
export class TrackingRepository {
  private readonly logger = new Logger(TrackingRepository.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER)
    private readonly db: DrizzleDB,
  ) {}

  /**
   * Save a processed position to the database
   */
  save(position: ProcessedPosition): Effect.Effect<TrackingPosition, StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        const [saved] = await this.db
          .insert(trackingPositions)
          .values({
            participantId: position.participantId,
            raceId: position.raceId,
            latitude: String(position.latitude),
            longitude: String(position.longitude),
            clientTimestamp: position.clientTimestamp,
            serverReceivedAt: position.serverReceivedAt,
            status: position.status,
          })
          .returning();

        this.logger.debug(
          `Saved position for participant ${position.participantId} in race ${position.raceId}`,
        );
        return saved;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to save position: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'save',
          cause: error,
        }),
    });
  }

  /**
   * Find positions by participant ID and race ID
   */
  findByParticipantAndRace(
    participantId: string,
    raceId: string,
    limit = 100,
  ): Effect.Effect<TrackingPosition[], StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        return await this.db
          .select()
          .from(trackingPositions)
          .where(
            and(
              eq(trackingPositions.participantId, participantId),
              eq(trackingPositions.raceId, raceId),
            ),
          )
          .orderBy(desc(trackingPositions.clientTimestamp))
          .limit(limit);
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to find positions: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'findByParticipantAndRace',
          cause: error,
        }),
    });
  }

  /**
   * Find all positions for a race
   */
  findByRace(
    raceId: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    },
  ): Effect.Effect<TrackingPosition[], StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        const conditions = [eq(trackingPositions.raceId, raceId)];

        if (options?.startTime) {
          conditions.push(gte(trackingPositions.clientTimestamp, options.startTime));
        }

        if (options?.endTime) {
          conditions.push(lte(trackingPositions.clientTimestamp, options.endTime));
        }

        let query = this.db
          .select()
          .from(trackingPositions)
          .where(and(...conditions))
          .orderBy(desc(trackingPositions.clientTimestamp));

        if (options?.limit) {
          query = query.limit(options.limit) as typeof query;
        }

        return await query;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to find race positions: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'findByRace',
          cause: error,
        }),
    });
  }

  /**
   * Get the latest position for each participant in a race
   */
  findLatestByRace(raceId: string): Effect.Effect<TrackingPosition[], StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        // Use a subquery to get the latest position for each participant
        const latestIds = this.db
          .select({
            maxId: sql<string>`MAX(${trackingPositions.id})`.as('max_id'),
          })
          .from(trackingPositions)
          .where(eq(trackingPositions.raceId, raceId))
          .groupBy(trackingPositions.participantId);

        const latestIdsResult = await latestIds;
        const ids = latestIdsResult.map((r) => r.maxId).filter(Boolean);

        if (ids.length === 0) {
          return [];
        }

        return await this.db
          .select()
          .from(trackingPositions)
          .where(inArray(trackingPositions.id, ids))
          .orderBy(trackingPositions.participantId);
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to find latest positions: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'findLatestByRace',
          cause: error,
        }),
    });
  }

  /**
   * Get the latest position for a specific participant
   */
  findLatestByParticipant(
    participantId: string,
    raceId: string,
  ): Effect.Effect<TrackingPosition | null, StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        const [result] = await this.db
          .select()
          .from(trackingPositions)
          .where(
            and(
              eq(trackingPositions.participantId, participantId),
              eq(trackingPositions.raceId, raceId),
            ),
          )
          .orderBy(desc(trackingPositions.clientTimestamp))
          .limit(1);

        return result ?? null;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to find latest participant position: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'findLatestByParticipant',
          cause: error,
        }),
    });
  }

  /**
   * Count positions for a participant in a race
   */
  countByParticipant(
    participantId: string,
    raceId: string,
  ): Effect.Effect<number, StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        const [result] = await this.db
          .select({ count: count() })
          .from(trackingPositions)
          .where(
            and(
              eq(trackingPositions.participantId, participantId),
              eq(trackingPositions.raceId, raceId),
            ),
          );

        return result?.count ?? 0;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to count positions: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'countByParticipant',
          cause: error,
        }),
    });
  }

  /**
   * Delete positions older than a specified date
   */
  deleteOlderThan(date: Date): Effect.Effect<number, StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        const result = await this.db
          .delete(trackingPositions)
          .where(lt(trackingPositions.clientTimestamp, date))
          .returning({ id: trackingPositions.id });

        const deleted = result.length;
        this.logger.log(`Deleted ${deleted} position records older than ${date.toISOString()}`);
        return deleted;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to delete old positions: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'deleteOlderThan',
          cause: error,
        }),
    });
  }

  /**
   * Delete all positions for a race
   */
  deleteByRace(raceId: string): Effect.Effect<number, StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        const result = await this.db
          .delete(trackingPositions)
          .where(eq(trackingPositions.raceId, raceId))
          .returning({ id: trackingPositions.id });

        const deleted = result.length;
        this.logger.log(`Deleted ${deleted} position records for race ${raceId}`);
        return deleted;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to delete race positions: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'deleteByRace',
          cause: error,
        }),
    });
  }

  /**
   * Bulk save positions (for batch processing)
   */
  saveBatch(
    positions: ProcessedPosition[],
  ): Effect.Effect<TrackingPosition[], StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        if (positions.length === 0) {
          return [];
        }

        const values = positions.map((position) => ({
          participantId: position.participantId,
          raceId: position.raceId,
          latitude: String(position.latitude),
          longitude: String(position.longitude),
          clientTimestamp: position.clientTimestamp,
          serverReceivedAt: position.serverReceivedAt,
          status: position.status,
        }));

        const saved = await this.db.insert(trackingPositions).values(values).returning();

        this.logger.debug(`Bulk saved ${saved.length} positions`);
        return saved;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to bulk save positions: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'saveBatch',
          cause: error,
        }),
    });
  }

  /**
   * Check if participant has any positions in a race
   */
  existsByParticipant(
    participantId: string,
    raceId: string,
  ): Effect.Effect<boolean, StorageError, never> {
    return Effect.tryPromise({
      try: async () => {
        const [result] = await this.db
          .select({ count: count() })
          .from(trackingPositions)
          .where(
            and(
              eq(trackingPositions.participantId, participantId),
              eq(trackingPositions.raceId, raceId),
            ),
          )
          .limit(1);

        return (result?.count ?? 0) > 0;
      },
      catch: (error) =>
        new StorageError({
          message: `Failed to check participant existence: ${error instanceof Error ? error.message : String(error)}`,
          operation: 'existsByParticipant',
          cause: error,
        }),
    });
  }
}
