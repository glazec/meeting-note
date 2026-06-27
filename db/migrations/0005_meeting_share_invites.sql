CREATE TABLE "meeting_share_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "access_role" DEFAULT 'shared' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_share_invites" ADD CONSTRAINT "meeting_share_invites_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meeting_share_invites" ADD CONSTRAINT "meeting_share_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_share_invites_meeting_email_unique" ON "meeting_share_invites" USING btree ("meeting_id","email");
--> statement-breakpoint
CREATE INDEX "meeting_share_invites_email_index" ON "meeting_share_invites" USING btree ("email");
