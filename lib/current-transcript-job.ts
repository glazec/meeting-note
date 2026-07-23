import { sql } from "drizzle-orm";

export function currentTranscriptJobIdsSubquery(meetingId: unknown) {
  return sql<string>`(
    with latest_replace as (
      select id, created_at
      from transcript_jobs
      where meeting_id = ${meetingId}
        and status = 'completed'
        and mode = 'replace'
      order by created_at desc, id desc
      limit 1
    )
    select current_jobs.id
    from transcript_jobs current_jobs
    where current_jobs.meeting_id = ${meetingId}
      and current_jobs.status = 'completed'
      and (
        current_jobs.id = (select id from latest_replace)
        or (
          current_jobs.mode = 'append'
          and (
            not exists (select 1 from latest_replace)
            or current_jobs.created_at > (
              select created_at from latest_replace
            )
            or (
              current_jobs.created_at = (
                select created_at from latest_replace
              )
              and current_jobs.id > (select id from latest_replace)
            )
          )
        )
      )
  )`;
}
