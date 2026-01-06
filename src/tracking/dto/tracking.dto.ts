import { Schema } from "effect";
import {
  DateTimeString,
  NonEmptyString,
  type ParticipantStatus,
  type TrackingPayload,
  TrackingPayloadSchema,
} from "../../shared/types";

/**
 * DTO for incoming MQTT tracking payload
 */
export class TrackingPayloadDto implements TrackingPayload {
  participant_id: string;
  race_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: ParticipantStatus;

  static validate(data: unknown): TrackingPayloadDto | null {
    try {
      const result = Schema.decodeUnknownSync(TrackingPayloadSchema)(data);
      const dto = new TrackingPayloadDto();
      dto.participant_id = result.participant_id;
      dto.race_id = result.race_id;
      dto.latitude = result.latitude;
      dto.longitude = result.longitude;
      dto.timestamp = result.timestamp;
      dto.status = result.status;
      return dto;
    } catch {
      return null;
    }
  }

  static fromPayload(payload: TrackingPayload): TrackingPayloadDto {
    const dto = new TrackingPayloadDto();
    dto.participant_id = payload.participant_id;
    dto.race_id = payload.race_id;
    dto.latitude = payload.latitude;
    dto.longitude = payload.longitude;
    dto.timestamp = payload.timestamp;
    dto.status = payload.status;
    return dto;
  }
}

/**
 * DTO for position update response
 */
export class PositionUpdateDto {
  participantId: string;
  raceId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  serverReceivedAt: Date;
  status: ParticipantStatus;

  static create(params: {
    participantId: string;
    raceId: string;
    latitude: number;
    longitude: number;
    timestamp: Date;
    serverReceivedAt: Date;
    status: ParticipantStatus;
  }): PositionUpdateDto {
    const dto = new PositionUpdateDto();
    dto.participantId = params.participantId;
    dto.raceId = params.raceId;
    dto.latitude = params.latitude;
    dto.longitude = params.longitude;
    dto.timestamp = params.timestamp;
    dto.serverReceivedAt = params.serverReceivedAt;
    dto.status = params.status;
    return dto;
  }
}

/**
 * Schema for subscribing to race updates
 */
export const SubscribeRaceSchema = Schema.Struct({
  raceId: NonEmptyString,
});

export type SubscribeRaceDto = typeof SubscribeRaceSchema.Type;

/**
 * Schema for position history query
 */
export const PositionHistoryQuerySchema = Schema.Struct({
  participantId: NonEmptyString,
  raceId: NonEmptyString,
  limit: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int({ message: () => "Limit must be an integer" }),
      Schema.between(1, 1000, {
        message: () => "Limit must be between 1 and 1000",
      }),
    ),
    { default: () => 100 },
  ),
  startTime: Schema.optional(DateTimeString),
  endTime: Schema.optional(DateTimeString),
});

export type PositionHistoryQueryDto = typeof PositionHistoryQuerySchema.Type;

/**
 * Schema for race positions query
 */
export const RacePositionsQuerySchema = Schema.Struct({
  raceId: NonEmptyString,
  startTime: Schema.optional(DateTimeString),
  endTime: Schema.optional(DateTimeString),
});

export type RacePositionsQueryDto = typeof RacePositionsQuerySchema.Type;

/**
 * DTO for WebSocket position broadcast
 */
export class PositionBroadcastDto {
  event: "position_update";
  data: {
    participantId: string;
    raceId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    status: ParticipantStatus;
  };

  static fromPositionUpdate(update: PositionUpdateDto): PositionBroadcastDto {
    const dto = new PositionBroadcastDto();
    dto.event = "position_update";
    dto.data = {
      participantId: update.participantId,
      raceId: update.raceId,
      latitude: update.latitude,
      longitude: update.longitude,
      timestamp: update.timestamp.toISOString(),
      status: update.status,
    };
    return dto;
  }
}

/**
 * DTO for batch position update (multiple participants)
 */
export class BatchPositionBroadcastDto {
  event: "batch_position_update";
  data: {
    raceId: string;
    positions: Array<{
      participantId: string;
      latitude: number;
      longitude: number;
      timestamp: string;
      status: ParticipantStatus;
    }>;
  };

  static create(
    raceId: string,
    positions: PositionUpdateDto[],
  ): BatchPositionBroadcastDto {
    const dto = new BatchPositionBroadcastDto();
    dto.event = "batch_position_update";
    dto.data = {
      raceId,
      positions: positions.map((p) => ({
        participantId: p.participantId,
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.timestamp.toISOString(),
        status: p.status,
      })),
    };
    return dto;
  }
}
