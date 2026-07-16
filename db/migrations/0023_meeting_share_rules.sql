CREATE TABLE "meeting_share_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"match_key" text NOT NULL,
	"role" "access_role" DEFAULT 'shared' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_share_rules" ADD CONSTRAINT "meeting_share_rules_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meeting_share_rules" ADD CONSTRAINT "meeting_share_rules_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meeting_share_rules" ADD CONSTRAINT "meeting_share_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_share_rules_scope_recipient_key_unique" ON "meeting_share_rules" USING btree ("team_id","owner_user_id","recipient_email","match_key");
--> statement-breakpoint
CREATE INDEX "meeting_share_rules_future_lookup_index" ON "meeting_share_rules" USING btree ("team_id","owner_user_id","match_key");
