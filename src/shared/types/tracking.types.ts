import { z } from 'zod';

export const ParticipantStatusSchema = z.enum(['moving', 'stopped', 'finished', 'disqualified']);
export type ParticipantStatus = z.infer<typeof ParticipantStatusSchema>;

export const TrackingPayloadSchema = z.object({
  participant_id: z.string().min(1),
  race_id: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.string().datetime(),
  status: ParticipantStatusSchema,
});

export type TrackingPayload = z.infer<typeof TrackingPayloadSchema>;

export interface ProcessedPosition {
  participantId: string;
  raceId: string;
  latitude: number;
  longitude: number;
  clientTimestamp: Date;
  serverReceivedAt: Date;
  status: ParticipantStatus;
}

export interface PositionUpdate {
  participantId: string;
  raceId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  status: ParticipantStatus;
}

export interface RaceParticipantKey {
  raceId: string;
  participantId: string;
}
