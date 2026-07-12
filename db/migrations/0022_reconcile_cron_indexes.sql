CREATE INDEX IF NOT EXISTS "meetings_active_status_index" ON "meetings" USING btree ("status") WHERE "meetings"."status" in ('recording', 'processing');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transcript_jobs_meeting_created_index" ON "transcript_jobs" USING btree ("meeting_id","created_at");
