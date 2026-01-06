import { Effect, Schema } from "effect";
import type { ProcessedPosition, TrackingPayload } from "../shared/types";
import { TrackingPayloadSchema } from "../shared/types";
import type { PositionUpdateDto } from "./dto/tracking.dto";
import {
  InvalidCoordinatesError,
  PayloadValidationError,
  StaleDataError,
  type StorageError,
  TimestampParseError,
} from "./tracking.errors";

export interface TrackingEffectsConfig {
  staleDataThresholdMs: number;
}

export interface TrackingEffectsDeps {
  saveToRedis: (
    position: ProcessedPosition,
  ) => Effect.Effect<void, StorageError>;
  saveToPostgres: (
    position: ProcessedPosition,
  ) => Effect.Effect<void, StorageError>;
  broadcastPosition: (update: PositionUpdateDto) => Effect.Effect<void>;
}

const validatePayload = (rawPayload: unknown) =>
  Schema.decodeUnknown(TrackingPayloadSchema)(rawPayload).pipe(
    Effect.mapError(
      (parseError) =>
        new PayloadValidationError({
          message: "Payload validation failed",
          payload: rawPayload,
          validationErrors: [parseError.message],
        }),
    ),
  );

const parseTimestamp = (timestamp: string) =>
  Effect.try({
    try: () => {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }
      return date;
    },
    catch: () =>
      new TimestampParseError({
        message: `Failed to parse timestamp: ${timestamp}`,
        rawTimestamp: timestamp,
      }),
  });

const validateCoordinates = (latitude: number, longitude: number) =>
  Effect.gen(function* () {
    if (latitude < -90 || latitude > 90) {
      yield* new InvalidCoordinatesError({
        message: `Invalid coordinates: lat=${latitude}, lon=${longitude}`,
        latitude,
        longitude,
      });
    }
    if (longitude < -180 || longitude > 180) {
      yield* new InvalidCoordinatesError({
        message: `Invalid coordinates: lat=${latitude}, lon=${longitude}`,
        latitude,
        longitude,
      });
    }
    return { latitude, longitude };
  });

const checkStaleData = (
  participantId: string,
  raceId: string,
  timestamp: Date,
  thresholdMs: number,
) =>
  Effect.gen(function* () {
    const dataAge = Date.now() - timestamp.getTime();
    if (dataAge > thresholdMs) {
      yield* new StaleDataError({
        message: `Data for participant ${participantId} is stale`,
        participantId,
        raceId,
        dataTimestamp: timestamp,
        threshold: thresholdMs,
      });
    }
    return timestamp;
  });

const toProcessedPosition = (
  payload: TrackingPayload,
  clientTimestamp: Date,
): ProcessedPosition => ({
  participantId: payload.participant_id,
  raceId: payload.race_id,
  latitude: payload.latitude,
  longitude: payload.longitude,
  clientTimestamp,
  serverReceivedAt: new Date(),
  status: payload.status,
});

const toPositionUpdateDto = (position: ProcessedPosition): PositionUpdateDto =>
  ({
    participantId: position.participantId,
    raceId: position.raceId,
    latitude: position.latitude,
    longitude: position.longitude,
    timestamp: position.clientTimestamp,
    serverReceivedAt: position.serverReceivedAt,
    status: position.status,
  }) as PositionUpdateDto;

export const processTrackingData = (
  rawPayload: unknown,
  config: TrackingEffectsConfig,
  deps: TrackingEffectsDeps,
) =>
  Effect.gen(function* () {
    const payload = yield* validatePayload(rawPayload);
    const clientTimestamp = yield* parseTimestamp(payload.timestamp);

    yield* validateCoordinates(payload.latitude, payload.longitude);
    yield* checkStaleData(
      payload.participant_id,
      payload.race_id,
      clientTimestamp,
      config.staleDataThresholdMs,
    );

    const position = toProcessedPosition(payload, clientTimestamp);

    yield* Effect.all(
      [deps.saveToRedis(position), deps.saveToPostgres(position)],
      {
        concurrency: 2,
      },
    );

    const update = toPositionUpdateDto(position);
    yield* deps.broadcastPosition(update);

    return update;
  });

export const processTrackingDataWithLogging = (
  rawPayload: unknown,
  config: TrackingEffectsConfig,
  deps: TrackingEffectsDeps,
  logger: {
    debug: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
  },
) =>
  processTrackingData(rawPayload, config, deps).pipe(
    Effect.tap((update) =>
      Effect.sync(() => {
        logger.debug("Successfully processed tracking data", {
          participantId: update.participantId,
          raceId: update.raceId,
        });
      }),
    ),
    Effect.catchTags({
      PayloadValidationError: (e) =>
        Effect.sync(() => {
          logger.warn("Payload validation failed", {
            errors: e.validationErrors,
          });
          return null;
        }),
      StaleDataError: (e) =>
        Effect.sync(() => {
          logger.warn("Dropped stale data", {
            participantId: e.participantId,
            raceId: e.raceId,
            dataTimestamp: e.dataTimestamp.toISOString(),
          });
          return null;
        }),
      TimestampParseError: (e) =>
        Effect.sync(() => {
          logger.warn("Failed to parse timestamp", {
            rawTimestamp: e.rawTimestamp,
          });
          return null;
        }),
      InvalidCoordinatesError: (e) =>
        Effect.sync(() => {
          logger.warn("Invalid coordinates received", {
            latitude: e.latitude,
            longitude: e.longitude,
          });
          return null;
        }),
      StorageError: (e) =>
        Effect.sync(() => {
          logger.error("Storage operation failed", {
            operation: e.operation,
            message: e.message,
          });
          return null;
        }),
    }),
  );

export const batchProcessTrackingData = (
  payloads: unknown[],
  config: TrackingEffectsConfig,
  deps: TrackingEffectsDeps,
  logger: {
    debug: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
  },
) =>
  Effect.all(
    payloads.map((payload) =>
      processTrackingDataWithLogging(payload, config, deps, logger),
    ),
    { concurrency: 10 },
  ).pipe(
    Effect.map((results) =>
      results.filter((r): r is PositionUpdateDto => r !== null),
    ),
  );
