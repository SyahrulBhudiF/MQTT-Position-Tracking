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

export class PostgresOperationError extends Error {
  readonly _tag = 'PostgresOperationError';
  constructor(
    message: string,
    public readonly operation: string,
  ) {
    super(message);
    this.name = 'PostgresOperationError';
  }
}

export class PostgresConnectionError extends Error {
  readonly _tag = 'PostgresConnectionError';
  constructor(message: string) {
    super(message);
    this.name = 'PostgresConnectionError';
  }
}

@Injectable()
export class PostgresService {
  private readonly logger = new Logger(PostgresService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER)
    private readonly db: DrizzleDB,
  ) {}

  /**
   * Save a position to the database
   */
  savePosition(
    position: ProcessedPosition,
  ): Effect.Effect<TrackingPosition, PostgresOperationError, never> {
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
        new PostgresOperationError(
          `Failed to save position: ${error instanceof Error ? error.message : String(error)}`,
          'savePosition',
        ),
    });
  }

  /**
   * Get position history for a participant in a race
   */
  getPositionHistory(
    participantId: string,
    raceId: string,
    limit = 100,
  ): Effect.Effect<TrackingPosition[], PostgresOperationError, never> {
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
        new PostgresOperationError(
          `Failed to get position history: ${error instanceof Error ? error.message : String(error)}`,
          'getPositionHistory',
        ),
    });
  }

  /**
   * Get all positions for a race within a time range
   */
  getRacePositions(
    raceId: string,
    startTime?: Date,
    endTime?: Date,
  ): Effect.Effect<TrackingPosition[], PostgresOperationError, never> {
    return Effect.tryPromise({
      try: async () => {
        const conditions = [eq(trackingPositions.raceId, raceId)];

        if (startTime) {
          conditions.push(gte(trackingPositions.clientTimestamp, startTime));
        }

        if (endTime) {
          conditions.push(lte(trackingPositions.clientTimestamp, endTime));
        }

        return await this.db
          .select()
          .from(trackingPositions)
          .where(and(...conditions))
          .orderBy(desc(trackingPositions.clientTimestamp));
      },
      catch: (error) =>
        new PostgresOperationError(
          `Failed to get race positions: ${error instanceof Error ? error.message : String(error)}`,
          'getRacePositions',
        ),
    });
  }

  /**
   * Get the latest position for each participant in a race
   */
  getLatestPositionsForRace(
    raceId: string,
  ): Effect.Effect<TrackingPosition[], PostgresOperationError, never> {
    return Effect.tryPromise({
      try: async () => {
        // Get the latest position IDs for each participant
        const latestIds = await this.db
          .select({
            maxId: sql<string>`MAX(${trackingPositions.id})`.as('max_id'),
          })
          .from(trackingPositions)
          .where(eq(trackingPositions.raceId, raceId))
          .groupBy(trackingPositions.participantId);

        const ids = latestIds.map((r) => r.maxId).filter(Boolean);

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
        new PostgresOperationError(
          `Failed to get latest positions for race: ${error instanceof Error ? error.message : String(error)}`,
          'getLatestPositionsForRace',
        ),
    });
  }

  /**
   * Delete old positions (cleanup job)
   */
  deleteOldPositions(olderThan: Date): Effect.Effect<number, PostgresOperationError, never> {
    return Effect.tryPromise({
      try: async () => {
        const result = await this.db
          .delete(trackingPositions)
          .where(lt(trackingPositions.clientTimestamp, olderThan))
          .returning({ id: trackingPositions.id });

        const deleted = result.length;
        this.logger.log(`Deleted ${deleted} old position records`);
        return deleted;
      },
      catch: (error) =>
        new PostgresOperationError(
          `Failed to delete old positions: ${error instanceof Error ? error.message : String(error)}`,
          'deleteOldPositions',
        ),
    });
  }

  /**
   * Count positions for a participant
   */
  countParticipantPositions(
    participantId: string,
    raceId: string,
  ): Effect.Effect<number, PostgresOperationError, never> {
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
        new PostgresOperationError(
          `Failed to count positions: ${error instanceof Error ? error.message : String(error)}`,
          'countParticipantPositions',
        ),
    });
  }

  /**
   * Check database connectivity by executing a simple query
   */
  isConnected(): Effect.Effect<boolean, PostgresConnectionError, never> {
    return Effect.tryPromise({
      try: async () => {
        await this.db.execute(sql`SELECT 1`);
        return true;
      },
      catch: (error) =>
        new PostgresConnectionError(
          `Database connection check failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });
  }
}
