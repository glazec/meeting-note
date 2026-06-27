DROP INDEX "calendar_connections_recall_calendar_id_unique";--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "team_meeting_key" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "team_meeting_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_connections_recall_calendar_id_unique" ON "calendar_connections" USING btree ("recall_calendar_id") WHERE "calendar_connections"."recall_calendar_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_team_meeting_key_unique" ON "meetings" USING btree ("team_id","team_meeting_key") WHERE "meetings"."team_meeting_key" is not null;