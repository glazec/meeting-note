ALTER TABLE "meetings" ADD COLUMN "translation_status" "job_status";
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "translation_error_message" text;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "translation_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "translation_completed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "meetings"
SET
	"translation_status" = 'completed',
	"translation_completed_at" = now(),
	"updated_at" = now()
WHERE
	EXISTS (
		SELECT 1
		FROM "transcript_segments"
		WHERE "transcript_segments"."meeting_id" = "meetings"."id"
	)
	AND NOT EXISTS (
		SELECT 1
		FROM "transcript_segments"
		WHERE
			"transcript_segments"."meeting_id" = "meetings"."id"
			AND (
				"transcript_segments"."translated_text" IS NULL
				OR btrim("transcript_segments"."translated_text") = ''
			)
	);
