import { sql } from "drizzle-orm";

import { db } from "@/db/client";

export const STALE_MEETING_JOB_TIMEOUT_MS = 6 * 60 * 60 * 1_000;

export async function reconcileStaleMeetingJobs(
  input: { now?: Date } = {},
) {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - STALE_MEETING_JOB_TIMEOUT_MS);
  const rows = await db.execute<{
    failed_transcript_job_count: number;
    failed_translation_count: number;
  }>(sql`
    with stale_transcript_jobs as (
      update transcript_jobs
      set
        status = 'failed',
        error_message = 'Transcription timed out before completion',
        updated_at = ${now}
      where status in ('queued', 'running')
        and updated_at < ${cutoff}
      returning meeting_id
    ),
    failed_meetings as (
      update meetings as meeting
      set
        status = 'failed',
        updated_at = ${now}
      where meeting.status = 'processing'
        and meeting.id in (select meeting_id from stale_transcript_jobs)
        and (
          select latest.status
          from transcript_jobs as latest
          where latest.meeting_id = meeting.id
          order by latest.created_at desc
          limit 1
        ) = 'failed'
      returning meeting.id
    ),
    failed_translations as (
      update meetings
      set
        translation_status = 'failed',
        translation_error_message = 'Translation timed out before completion',
        updated_at = ${now}
      where translation_status in ('queued', 'running')
        and coalesce(translation_started_at, updated_at) < ${cutoff}
      returning id
    )
    select
      (select count(*)::integer from stale_transcript_jobs)
        as failed_transcript_job_count,
      (select count(*)::integer from failed_translations)
        as failed_translation_count
  `);
  const result = rows.rows[0];

  return {
    failedTranscriptJobCount: Number(result?.failed_transcript_job_count ?? 0),
    failedTranslationCount: Number(result?.failed_translation_count ?? 0),
  };
}
