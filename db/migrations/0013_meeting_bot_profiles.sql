CREATE TABLE "team_meeting_bot_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"bot_name" text DEFAULT 'IOSG Old Friend' NOT NULL,
	"avatar_jpeg_base64" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_meeting_bot_profiles" ADD CONSTRAINT "team_meeting_bot_profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_meeting_bot_profiles_team_unique" ON "team_meeting_bot_profiles" USING btree ("team_id");
