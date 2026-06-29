UPDATE "meetings"
SET
	"status" = 'missed',
	"updated_at" = now()
WHERE
	"status" = 'processing'
	AND "recall_bot_id" IS NOT NULL
	AND "recall_recording_id" IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "transcript_jobs"
		WHERE "transcript_jobs"."meeting_id" = "meetings"."id"
	);
