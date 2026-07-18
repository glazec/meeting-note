CREATE TABLE "meeting_access_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_access_exclusions" ADD CONSTRAINT "meeting_access_exclusions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_access_exclusions" ADD CONSTRAINT "meeting_access_exclusions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_access_exclusions_meeting_email_unique" ON "meeting_access_exclusions" USING btree ("meeting_id","recipient_email");
--> statement-breakpoint
INSERT INTO "meeting_access_sources" (
	"meeting_id",
	"recipient_email",
	"role",
	"source",
	"source_id",
	"created_by_user_id"
)
SELECT
	meeting."id",
	lower(app_user."email"),
	'shared',
	'organization_migration',
	'0028',
	meeting."owner_user_id"
FROM "meetings" AS meeting
INNER JOIN "team_memberships" AS membership
	ON membership."team_id" = meeting."team_id"
	AND membership."role" <> 'external'
INNER JOIN "users" AS app_user
	ON app_user."id" = membership."user_id"
WHERE meeting."organization_access_enabled" = true
	AND app_user."id" <> meeting."owner_user_id"
ON CONFLICT ("meeting_id", "recipient_email", "source", "source_id") DO UPDATE
SET "role" = excluded."role",
	"created_by_user_id" = excluded."created_by_user_id",
	"revoked_at" = null,
	"updated_at" = now();
--> statement-breakpoint
INSERT INTO "meeting_access" (
	"meeting_id",
	"user_id",
	"role",
	"source",
	"source_id",
	"created_by_user_id"
)
SELECT
	source."meeting_id",
	app_user."id",
	source."role",
	'effective',
	'materialized',
	source."created_by_user_id"
FROM "meeting_access_sources" AS source
INNER JOIN "users" AS app_user
	ON lower(app_user."email") = source."recipient_email"
WHERE source."source" = 'organization_migration'
	AND source."source_id" = '0028'
	AND source."revoked_at" IS NULL
ON CONFLICT ("meeting_id", "user_id") DO UPDATE
SET "role" = excluded."role",
	"source" = excluded."source",
	"source_id" = excluded."source_id",
	"created_by_user_id" = excluded."created_by_user_id",
	"revoked_at" = null,
	"updated_at" = now();
