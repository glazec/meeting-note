CREATE TABLE "team_speaker_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"alias_key" text NOT NULL,
	"alias" text NOT NULL,
	"canonical_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_speaker_aliases" ADD CONSTRAINT "team_speaker_aliases_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_speaker_aliases_team_alias_key_unique" ON "team_speaker_aliases" USING btree ("team_id","alias_key");--> statement-breakpoint
CREATE INDEX "team_speaker_aliases_team_canonical_index" ON "team_speaker_aliases" USING btree ("team_id","canonical_name");
