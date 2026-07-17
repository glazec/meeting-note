import { sql } from "drizzle-orm";

import { db } from "@/db/client";

export async function verifyDashboardReadiness() {
  await db.execute(sql`
    select
      id,
      meeting_id,
      role,
      source,
      source_id,
      created_by_user_id
    from meeting_share_invites
    where accepted_at is null
      and revoked_at is null
    limit 0
  `);
}
