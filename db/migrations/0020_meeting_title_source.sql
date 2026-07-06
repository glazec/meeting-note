ALTER TABLE "meetings" ADD COLUMN "title_source" text DEFAULT 'calendar' NOT NULL;
--> statement-breakpoint
UPDATE "meetings"
SET "title_source" = 'manual'
FROM "calendar_events"
WHERE "meetings"."calendar_event_id" = "calendar_events"."id"
	AND "meetings"."title" IS DISTINCT FROM "calendar_events"."title";
