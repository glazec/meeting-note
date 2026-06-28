ALTER TABLE "meeting_entities" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "meeting_entities" ADD COLUMN "source" text DEFAULT 'transcript' NOT NULL;
--> statement-breakpoint
CREATE TABLE "meeting_participant_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"recall_participant_id" text,
	"name" text,
	"email" text,
	"start_ms" integer NOT NULL,
	"end_ms" integer,
	"source" text DEFAULT 'recall' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_participant_timeline" ADD CONSTRAINT "meeting_participant_timeline_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "meeting_participant_timeline_meeting_index" ON "meeting_participant_timeline" USING btree ("meeting_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_participant_timeline_unique" ON "meeting_participant_timeline" USING btree ("meeting_id","recall_participant_id","start_ms");
