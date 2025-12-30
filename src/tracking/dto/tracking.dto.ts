import { z } from 'zod';
import {
  type ParticipantStatus,
  type TrackingPayload,
  TrackingPayloadSchema,
} from '../../shared/types';

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
    const result = TrackingPayloadSchema.safeParse(data);
    if (!result.success) {
      return null;
    }

    const dto = new TrackingPayloadDto();
    dto.participant_id = result.data.participant_id;
    dto.race_id = result.data.race_id;
    dto.latitude = result.data.latitude;
    dto.longitude = result.data.longitude;
    dto.timestamp = result.data.timestamp;
    dto.status = result.data.status;
    return dto;
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
 * DTO for subscribing to race updates
 */
export const SubscribeRaceSchema = z.object({
  raceId: z.string().min(1),
});

export type SubscribeRaceDto = z.infer<typeof SubscribeRaceSchema>;

/**
 * DTO for position history query
 */
export const PositionHistoryQuerySchema = z.object({
  participantId: z.string().min(1),
  raceId: z.string().min(1),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export type PositionHistoryQueryDto = z.infer<typeof PositionHistoryQuerySchema>;

/**
 * DTO for race positions query
 */
export const RacePositionsQuerySchema = z.object({
  raceId: z.string().min(1),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export type RacePositionsQueryDto = z.infer<typeof RacePositionsQuerySchema>;

/**
 * DTO for WebSocket position broadcast
 */
export class PositionBroadcastDto {
  event: 'position_update';
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
    dto.event = 'position_update';
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
  event: 'batch_position_update';
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

  static create(raceId: string, positions: PositionUpdateDto[]): BatchPositionBroadcastDto {
    const dto = new BatchPositionBroadcastDto();
    dto.event = 'batch_position_update';
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
