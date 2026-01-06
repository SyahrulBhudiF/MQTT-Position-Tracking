import { Schema } from "effect";

/**
 * Participant status enum schema using Effect Schema Literal
 */
export const ParticipantStatusSchema = Schema.Literal(
  "moving",
  "stopped",
  "finished",
  "disqualified",
);
export type ParticipantStatus = typeof ParticipantStatusSchema.Type;

/**
 * Latitude schema with range validation (-90 to 90)
 */
export const LatitudeSchema = Schema.Number.pipe(
  Schema.between(-90, 90, {
    message: () => "Latitude must be between -90 and 90",
  }),
);

/**
 * Longitude schema with range validation (-180 to 180)
 */
export const LongitudeSchema = Schema.Number.pipe(
  Schema.between(-180, 180, {
    message: () => "Longitude must be between -180 and 180",
  }),
);

/**
 * Non-empty string schema
 */
export const NonEmptyString = Schema.String.pipe(
  Schema.minLength(1, {
    message: () => "String must not be empty",
  }),
);

/**
 * ISO DateTime string schema
 */
export const DateTimeString = Schema.String.pipe(
  Schema.pattern(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
    {
      message: () => "Invalid ISO 8601 datetime format",
    },
  ),
);

/**
 * Main tracking payload schema for MQTT messages
 */
export const TrackingPayloadSchema = Schema.Struct({
  participant_id: NonEmptyString,
  race_id: NonEmptyString,
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  timestamp: DateTimeString,
  status: ParticipantStatusSchema,
});

export type TrackingPayload = typeof TrackingPayloadSchema.Type;

/**
 * Processed position after validation and enrichment
 */
export interface ProcessedPosition {
  participantId: string;
  raceId: string;
  latitude: number;
  longitude: number;
  clientTimestamp: Date;
  serverReceivedAt: Date;
  status: ParticipantStatus;
}

/**
 * Position update for broadcasting
 */
export interface PositionUpdate {
  participantId: string;
  raceId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  status: ParticipantStatus;
}

/**
 * Key for Redis operations
 */
export interface RaceParticipantKey {
  raceId: string;
  participantId: string;
}
