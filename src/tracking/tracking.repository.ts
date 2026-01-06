import { PgDrizzle } from "@effect/sql-drizzle/Pg";
import { SqlError } from "@effect/sql/SqlError";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { and, count, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { Effect, ManagedRuntime } from "effect";
import { DatabaseLive } from "../database/database.provider";
import { type TrackingPosition, trackingPositions } from "../database/schema";
import type { ProcessedPosition } from "../shared/types/tracking.types";
import { StorageError } from "./tracking.errors";

const mapSqlError = (operation: string) => (error: SqlError) =>
  new StorageError({
    message: `Failed to ${operation}: ${error.message}`,
    operation,
    cause: error,
  });

const makeRepository = Effect.gen(function* () {
  const db = yield* PgDrizzle;

  const save = (position: ProcessedPosition) =>
    db
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
      .returning()
      .pipe(
        Effect.map((rows) => rows[0]),
        Effect.mapError(mapSqlError("save")),
      );

  const findByParticipantAndRace = (
    participantId: string,
    raceId: string,
    limit = 100,
  ) =>
    db
      .select()
      .from(trackingPositions)
      .where(
        and(
          eq(trackingPositions.participantId, participantId),
          eq(trackingPositions.raceId, raceId),
        ),
      )
      .orderBy(desc(trackingPositions.clientTimestamp))
      .limit(limit)
      .pipe(Effect.mapError(mapSqlError("findByParticipantAndRace")));

  const findByRace = (
    raceId: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    },
  ) =>
    Effect.gen(function* () {
      const conditions = [eq(trackingPositions.raceId, raceId)];

      if (options?.startTime) {
        conditions.push(
          gte(trackingPositions.clientTimestamp, options.startTime),
        );
      }

      if (options?.endTime) {
        conditions.push(
          lte(trackingPositions.clientTimestamp, options.endTime),
        );
      }

      let query = db
        .select()
        .from(trackingPositions)
        .where(and(...conditions))
        .orderBy(desc(trackingPositions.clientTimestamp));

      if (options?.limit) {
        query = query.limit(options.limit) as typeof query;
      }

      return yield* query;
    }).pipe(Effect.mapError(mapSqlError("findByRace")));

  const findLatestByRace = (raceId: string) =>
    Effect.gen(function* () {
      const latestIdsResult = yield* db
        .select({
          maxId: sql<string>`MAX(${trackingPositions.id})`.as("max_id"),
        })
        .from(trackingPositions)
        .where(eq(trackingPositions.raceId, raceId))
        .groupBy(trackingPositions.participantId);

      const ids = latestIdsResult.map((r) => r.maxId).filter(Boolean);

      if (ids.length === 0) {
        return [] as TrackingPosition[];
      }

      return yield* db
        .select()
        .from(trackingPositions)
        .where(inArray(trackingPositions.id, ids))
        .orderBy(trackingPositions.participantId);
    }).pipe(Effect.mapError(mapSqlError("findLatestByRace")));

  const findLatestByParticipant = (participantId: string, raceId: string) =>
    db
      .select()
      .from(trackingPositions)
      .where(
        and(
          eq(trackingPositions.participantId, participantId),
          eq(trackingPositions.raceId, raceId),
        ),
      )
      .orderBy(desc(trackingPositions.clientTimestamp))
      .limit(1)
      .pipe(
        Effect.map((rows) => rows[0] ?? null),
        Effect.mapError(mapSqlError("findLatestByParticipant")),
      );

  const countByParticipant = (participantId: string, raceId: string) =>
    db
      .select({ count: count() })
      .from(trackingPositions)
      .where(
        and(
          eq(trackingPositions.participantId, participantId),
          eq(trackingPositions.raceId, raceId),
        ),
      )
      .pipe(
        Effect.map((rows) => rows[0]?.count ?? 0),
        Effect.mapError(mapSqlError("countByParticipant")),
      );

  const deleteOlderThan = (date: Date) =>
    db
      .delete(trackingPositions)
      .where(lt(trackingPositions.clientTimestamp, date))
      .returning({ id: trackingPositions.id })
      .pipe(
        Effect.map((rows) => rows.length),
        Effect.mapError(mapSqlError("deleteOlderThan")),
      );

  const deleteByRace = (raceId: string) =>
    db
      .delete(trackingPositions)
      .where(eq(trackingPositions.raceId, raceId))
      .returning({ id: trackingPositions.id })
      .pipe(
        Effect.map((rows) => rows.length),
        Effect.mapError(mapSqlError("deleteByRace")),
      );

  const saveBatch = (positions: ProcessedPosition[]) =>
    Effect.gen(function* () {
      if (positions.length === 0) {
        return [] as TrackingPosition[];
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

      return yield* db.insert(trackingPositions).values(values).returning();
    }).pipe(Effect.mapError(mapSqlError("saveBatch")));

  const existsByParticipant = (participantId: string, raceId: string) =>
    db
      .select({ count: count() })
      .from(trackingPositions)
      .where(
        and(
          eq(trackingPositions.participantId, participantId),
          eq(trackingPositions.raceId, raceId),
        ),
      )
      .limit(1)
      .pipe(
        Effect.map((rows) => (rows[0]?.count ?? 0) > 0),
        Effect.mapError(mapSqlError("existsByParticipant")),
      );

  return {
    save,
    findByParticipantAndRace,
    findByRace,
    findLatestByRace,
    findLatestByParticipant,
    countByParticipant,
    deleteOlderThan,
    deleteByRace,
    saveBatch,
    existsByParticipant,
  };
});

type Repository = Effect.Effect.Success<typeof makeRepository>;

@Injectable()
export class TrackingRepository implements OnModuleInit {
  private readonly logger = new Logger(TrackingRepository.name);
  private runtime!: ManagedRuntime.ManagedRuntime<PgDrizzle, SqlError>;
  private repo!: Repository;

  async onModuleInit() {
    this.logger.log("Initializing TrackingRepository with Effect runtime...");
    this.runtime = ManagedRuntime.make(DatabaseLive);
    this.repo = await this.runtime.runPromise(makeRepository);
    this.logger.log("TrackingRepository initialized");
  }

  save(position: ProcessedPosition) {
    return this.repo.save(position);
  }

  findByParticipantAndRace(participantId: string, raceId: string, limit = 100) {
    return this.repo.findByParticipantAndRace(participantId, raceId, limit);
  }

  findByRace(
    raceId: string,
    options?: { startTime?: Date; endTime?: Date; limit?: number },
  ) {
    return this.repo.findByRace(raceId, options);
  }

  findLatestByRace(raceId: string) {
    return this.repo.findLatestByRace(raceId);
  }

  findLatestByParticipant(participantId: string, raceId: string) {
    return this.repo.findLatestByParticipant(participantId, raceId);
  }

  countByParticipant(participantId: string, raceId: string) {
    return this.repo.countByParticipant(participantId, raceId);
  }

  deleteOlderThan(date: Date) {
    return this.repo.deleteOlderThan(date);
  }

  deleteByRace(raceId: string) {
    return this.repo.deleteByRace(raceId);
  }

  saveBatch(positions: ProcessedPosition[]) {
    return this.repo.saveBatch(positions);
  }

  existsByParticipant(participantId: string, raceId: string) {
    return this.repo.existsByParticipant(participantId, raceId);
  }
}
