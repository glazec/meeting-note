CREATE TYPE "public"."transcript_mode" AS ENUM('replace', 'append');--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "external_bot_id" text;--> statement-breakpoint
ALTER TABLE "transcript_jobs" ADD COLUMN "recording_id" uuid;--> statement-breakpoint
ALTER TABLE "transcript_jobs" ADD COLUMN "mode" "transcript_mode" DEFAULT 'replace' NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript_jobs" ADD CONSTRAINT "transcript_jobs_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "recordings" AS "recording"
SET
  "external_id" = "meeting"."recall_recording_id",
  "external_bot_id" = "meeting"."recall_bot_id"
FROM "meetings" AS "meeting"
WHERE "recording"."meeting_id" = "meeting"."id"
  AND "recording"."source" = 'recall'
  AND "meeting"."recall_recording_id" IS NOT NULL
  AND "recording"."id" = (
    SELECT "candidate"."id"
    FROM "recordings" AS "candidate"
    WHERE "candidate"."meeting_id" = "meeting"."id"
      AND "candidate"."source" = 'recall'
    ORDER BY "candidate"."created_at" DESC, "candidate"."id" DESC
    LIMIT 1
  );--> statement-breakpoint
UPDATE "transcript_jobs" AS "job"
SET "recording_id" = (
  SELECT "recording"."id"
  FROM "recordings" AS "recording"
  WHERE "recording"."meeting_id" = "job"."meeting_id"
  ORDER BY "recording"."created_at" DESC, "recording"."id" DESC
  LIMIT 1
)
WHERE "job"."recording_id" IS NULL
  AND "job"."id" = (
    SELECT "candidate_job"."id"
    FROM "transcript_jobs" AS "candidate_job"
    WHERE "candidate_job"."meeting_id" = "job"."meeting_id"
    ORDER BY "candidate_job"."created_at" DESC, "candidate_job"."id" DESC
    LIMIT 1
  )
  AND (
    SELECT count(*)
    FROM "recordings" AS "recording"
    WHERE "recording"."meeting_id" = "job"."meeting_id"
  ) = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "recordings_source_external_unique" ON "recordings" USING btree ("source","external_id") WHERE "recordings"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_jobs_recording_unique" ON "transcript_jobs" USING btree ("recording_id") WHERE "transcript_jobs"."recording_id" is not null;
