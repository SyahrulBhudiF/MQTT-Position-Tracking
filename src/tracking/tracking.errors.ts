import { Data } from 'effect';

/**
 * Base class for all tracking-related errors
 */
export class TrackingError extends Data.TaggedError('TrackingError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when payload validation fails
 */
export class PayloadValidationError extends Data.TaggedError('PayloadValidationError')<{
  readonly message: string;
  readonly payload: unknown;
  readonly validationErrors: string[];
}> {}

/**
 * Error thrown when position data is stale (too old)
 */
export class StaleDataError extends Data.TaggedError('StaleDataError')<{
  readonly message: string;
  readonly participantId: string;
  readonly raceId: string;
  readonly dataTimestamp: Date;
  readonly threshold: number;
}> {}

/**
 * Error thrown when participant is not found
 */
export class ParticipantNotFoundError extends Data.TaggedError('ParticipantNotFoundError')<{
  readonly message: string;
  readonly participantId: string;
  readonly raceId: string;
}> {}

/**
 * Error thrown when race is not found
 */
export class RaceNotFoundError extends Data.TaggedError('RaceNotFoundError')<{
  readonly message: string;
  readonly raceId: string;
}> {}

/**
 * Error thrown when storage operation fails
 */
export class StorageError extends Data.TaggedError('StorageError')<{
  readonly message: string;
  readonly operation: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when coordinates are invalid
 */
export class InvalidCoordinatesError extends Data.TaggedError('InvalidCoordinatesError')<{
  readonly message: string;
  readonly latitude: number;
  readonly longitude: number;
}> {}

/**
 * Error thrown when timestamp parsing fails
 */
export class TimestampParseError extends Data.TaggedError('TimestampParseError')<{
  readonly message: string;
  readonly rawTimestamp: string;
}> {}

/**
 * Union type of all tracking errors for exhaustive error handling
 */
export type TrackingErrors =
  | TrackingError
  | PayloadValidationError
  | StaleDataError
  | ParticipantNotFoundError
  | RaceNotFoundError
  | StorageError
  | InvalidCoordinatesError
  | TimestampParseError;

/**
 * Helper to create a human-readable error message
 */
export const formatTrackingError = (error: TrackingErrors): string => {
  switch (error._tag) {
    case 'TrackingError':
      return `Tracking error: ${error.message}`;
    case 'PayloadValidationError':
      return `Validation failed: ${error.validationErrors.join(', ')}`;
    case 'StaleDataError':
      return `Stale data for participant ${error.participantId}: data is older than ${error.threshold}ms`;
    case 'ParticipantNotFoundError':
      return `Participant ${error.participantId} not found in race ${error.raceId}`;
    case 'RaceNotFoundError':
      return `Race ${error.raceId} not found`;
    case 'StorageError':
      return `Storage error during ${error.operation}: ${error.message}`;
    case 'InvalidCoordinatesError':
      return `Invalid coordinates: lat=${error.latitude}, lon=${error.longitude}`;
    case 'TimestampParseError':
      return `Failed to parse timestamp: ${error.rawTimestamp}`;
  }
};
