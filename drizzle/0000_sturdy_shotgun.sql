CREATE TYPE "public"."participant_status" AS ENUM('moving', 'stopped', 'finished', 'disqualified');--> statement-breakpoint
CREATE TABLE "tracking_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" varchar(50) NOT NULL,
	"race_id" varchar(50) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"client_timestamp" timestamp with time zone NOT NULL,
	"server_received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "participant_status" DEFAULT 'moving' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_tracking_participant_id" ON "tracking_positions" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_race_id" ON "tracking_positions" USING btree ("race_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_participant_timestamp" ON "tracking_positions" USING btree ("participant_id","client_timestamp");--> statement-breakpoint
CREATE INDEX "idx_tracking_race_timestamp" ON "tracking_positions" USING btree ("race_id","client_timestamp");