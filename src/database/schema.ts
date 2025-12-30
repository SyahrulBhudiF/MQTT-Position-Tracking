import { decimal, index, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Participant status enum
 */
export const participantStatusEnum = pgEnum('participant_status', [
  'moving',
  'stopped',
  'finished',
  'disqualified',
]);

/**
 * Tracking positions table schema
 */
export const trackingPositions = pgTable(
  'tracking_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participantId: varchar('participant_id', { length: 50 }).notNull(),
    raceId: varchar('race_id', { length: 50 }).notNull(),
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }).notNull(),
    serverReceivedAt: timestamp('server_received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: participantStatusEnum('status').notNull().default('moving'),
  },
  (table) => [
    index('idx_tracking_participant_id').on(table.participantId),
    index('idx_tracking_race_id').on(table.raceId),
    index('idx_tracking_participant_timestamp').on(table.participantId, table.clientTimestamp),
    index('idx_tracking_race_timestamp').on(table.raceId, table.clientTimestamp),
  ],
);

/**
 * Type inference for insert operations
 */
export type NewTrackingPosition = typeof trackingPositions.$inferInsert;

/**
 * Type inference for select operations
 */
export type TrackingPosition = typeof trackingPositions.$inferSelect;
