import { Effect, pipe } from 'effect';
import type { ProcessedPosition, TrackingPayload } from '../shared/types';
import { TrackingPayloadSchema } from '../shared/types';
import type { PositionUpdateDto } from './dto/tracking.dto';
import {
  InvalidCoordinatesError,
  PayloadValidationError,
  StaleDataError,
  type StorageError,
  TimestampParseError,
} from './tracking.errors';

/**
 * Configuration for tracking effects
 */
export interface TrackingEffectsConfig {
  staleDataThresholdMs: number;
}

/**
 * Dependencies required by tracking effects
 */
export interface TrackingEffectsDeps {
  saveToRedis: (position: ProcessedPosition) => Effect.Effect<void, StorageError, never>;
  saveToPostgres: (position: ProcessedPosition) => Effect.Effect<void, StorageError, never>;
  broadcastPosition: (update: PositionUpdateDto) => Effect.Effect<void, never, never>;
}

/**
 * Validate raw MQTT payload and parse into TrackingPayload
 */
export const validatePayload = (
  rawPayload: unknown,
): Effect.Effect<TrackingPayload, PayloadValidationError, never> => {
  return Effect.try({
    try: () => {
      const result = TrackingPayloadSchema.safeParse(rawPayload);
      if (!result.success) {
        throw result.error;
      }
      return result.data;
    },
    catch: (error) => {
      const validationErrors =
        error && typeof error === 'object' && 'errors' in error
          ? (error.errors as Array<{ message: string }>).map((e) => e.message)
          : ['Unknown validation error'];
      return new PayloadValidationError({
        message: 'Payload validation failed',
        payload: rawPayload,
        validationErrors,
      });
    },
  });
};

/**
 * Parse and validate the timestamp from the payload
 */
export const parseTimestamp = (
  timestamp: string,
): Effect.Effect<Date, TimestampParseError, never> => {
  return Effect.try({
    try: () => {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date;
    },
    catch: () =>
      new TimestampParseError({
        message: `Failed to parse timestamp: ${timestamp}`,
        rawTimestamp: timestamp,
      }),
  });
};

/**
 * Validate coordinates are within valid ranges
 */
export const validateCoordinates = (
  latitude: number,
  longitude: number,
): Effect.Effect<{ latitude: number; longitude: number }, InvalidCoordinatesError, never> => {
  return Effect.try({
    try: () => {
      if (latitude < -90 || latitude > 90) {
        throw new Error(`Latitude ${latitude} out of range [-90, 90]`);
      }
      if (longitude < -180 || longitude > 180) {
        throw new Error(`Longitude ${longitude} out of range [-180, 180]`);
      }
      return { latitude, longitude };
    },
    catch: () =>
      new InvalidCoordinatesError({
        message: `Invalid coordinates: lat=${latitude}, lon=${longitude}`,
        latitude,
        longitude,
      }),
  });
};

/**
 * Check if the position data is stale (too old)
 */
export const checkStaleData = (
  participantId: string,
  raceId: string,
  timestamp: Date,
  thresholdMs: number,
): Effect.Effect<Date, StaleDataError, never> => {
  return Effect.try({
    try: () => {
      const now = Date.now();
      const dataAge = now - timestamp.getTime();

      if (dataAge > thresholdMs) {
        throw new Error('Data is stale');
      }

      return timestamp;
    },
    catch: () =>
      new StaleDataError({
        message: `Data for participant ${participantId} is stale`,
        participantId,
        raceId,
        dataTimestamp: timestamp,
        threshold: thresholdMs,
      }),
  });
};

/**
 * Transform validated payload into ProcessedPosition
 */
export const transformToProcessedPosition = (
  payload: TrackingPayload,
  clientTimestamp: Date,
): Effect.Effect<ProcessedPosition, never, never> => {
  return Effect.succeed({
    participantId: payload.participant_id,
    raceId: payload.race_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    clientTimestamp,
    serverReceivedAt: new Date(),
    status: payload.status,
  });
};

/**
 * Transform ProcessedPosition to PositionUpdateDto
 */
export const transformToPositionUpdate = (
  position: ProcessedPosition,
): Effect.Effect<PositionUpdateDto, never, never> => {
  return Effect.succeed({
    participantId: position.participantId,
    raceId: position.raceId,
    latitude: position.latitude,
    longitude: position.longitude,
    timestamp: position.clientTimestamp,
    serverReceivedAt: position.serverReceivedAt,
    status: position.status,
  } as PositionUpdateDto);
};

/**
 * Main processing pipeline for incoming tracking data
 * This is the core Effect pipeline that processes MQTT messages
 */
export const processTrackingData = (
  rawPayload: unknown,
  config: TrackingEffectsConfig,
  deps: TrackingEffectsDeps,
): Effect.Effect<
  PositionUpdateDto,
  | PayloadValidationError
  | TimestampParseError
  | InvalidCoordinatesError
  | StaleDataError
  | StorageError,
  never
> => {
  return pipe(
    // Step 1: Validate the raw payload
    validatePayload(rawPayload),

    // Step 2: Parse and validate timestamp
    Effect.flatMap((payload) =>
      pipe(
        parseTimestamp(payload.timestamp),
        Effect.flatMap((clientTimestamp) =>
          // Step 3: Validate coordinates
          pipe(
            validateCoordinates(payload.latitude, payload.longitude),
            Effect.flatMap(() =>
              // Step 4: Check for stale data
              checkStaleData(
                payload.participant_id,
                payload.race_id,
                clientTimestamp,
                config.staleDataThresholdMs,
              ),
            ),
            Effect.flatMap(() =>
              // Step 5: Transform to processed position
              transformToProcessedPosition(payload, clientTimestamp),
            ),
          ),
        ),
      ),
    ),

    // Step 6: Save to Redis and PostgreSQL in parallel
    Effect.flatMap((position) =>
      pipe(
        Effect.all([deps.saveToRedis(position), deps.saveToPostgres(position)], {
          concurrency: 2,
        }),
        Effect.map(() => position),
      ),
    ),

    // Step 7: Transform to PositionUpdateDto
    Effect.flatMap(transformToPositionUpdate),

    // Step 8: Broadcast to WebSocket clients
    Effect.tap((update) => deps.broadcastPosition(update)),
  );
};

/**
 * Process tracking data with error logging
 */
export const processTrackingDataWithLogging = (
  rawPayload: unknown,
  config: TrackingEffectsConfig,
  deps: TrackingEffectsDeps,
  logger: {
    debug: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
  },
): Effect.Effect<PositionUpdateDto | null, never, never> => {
  return pipe(
    processTrackingData(rawPayload, config, deps),
    Effect.tap((update) =>
      Effect.sync(() => {
        logger.debug('Successfully processed tracking data', {
          participantId: update.participantId,
          raceId: update.raceId,
        });
      }),
    ),
    Effect.catchTags({
      PayloadValidationError: (error) =>
        Effect.sync(() => {
          logger.warn('Payload validation failed', {
            errors: error.validationErrors,
          });
          return null;
        }),
      StaleDataError: (error) =>
        Effect.sync(() => {
          logger.warn('Dropped stale data', {
            participantId: error.participantId,
            raceId: error.raceId,
            dataTimestamp: error.dataTimestamp.toISOString(),
          });
          return null;
        }),
      TimestampParseError: (error) =>
        Effect.sync(() => {
          logger.warn('Failed to parse timestamp', {
            rawTimestamp: error.rawTimestamp,
          });
          return null;
        }),
      InvalidCoordinatesError: (error) =>
        Effect.sync(() => {
          logger.warn('Invalid coordinates received', {
            latitude: error.latitude,
            longitude: error.longitude,
          });
          return null;
        }),
      StorageError: (error) =>
        Effect.sync(() => {
          logger.error('Storage operation failed', {
            operation: error.operation,
            message: error.message,
          });
          return null;
        }),
    }),
  );
};

/**
 * Batch process multiple tracking payloads
 */
export const batchProcessTrackingData = (
  payloads: unknown[],
  config: TrackingEffectsConfig,
  deps: TrackingEffectsDeps,
  logger: {
    debug: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
  },
): Effect.Effect<PositionUpdateDto[], never, never> => {
  return pipe(
    Effect.all(
      payloads.map((payload) => processTrackingDataWithLogging(payload, config, deps, logger)),
      { concurrency: 10 },
    ),
    Effect.map((results) => results.filter((r): r is PositionUpdateDto => r !== null)),
  );
};
