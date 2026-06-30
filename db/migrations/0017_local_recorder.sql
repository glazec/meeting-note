ALTER TYPE "public"."asset_source" ADD VALUE IF NOT EXISTS 'local_recorder';--> statement-breakpoint
ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'computer_audio';--> statement-breakpoint
ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'microphone_audio';--> statement-breakpoint
ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'synthesized_audio';--> statement-breakpoint
CREATE TABLE "local_recorder_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id_hash" text NOT NULL,
	"app_version" text,
	"permission_readiness" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_recording_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id_hash" text NOT NULL,
	"fallback_intent_id_hash" text NOT NULL,
	"notification_state" text DEFAULT 'shown' NOT NULL,
	"attempt_state" text DEFAULT 'notified' NOT NULL,
	"claimed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"local_recording_attempt_id" uuid NOT NULL,
	"client_recording_id" text NOT NULL,
	"recording_started_at" timestamp with time zone NOT NULL,
	"recording_stopped_at" timestamp with time zone NOT NULL,
	"computer_audio_asset_id" uuid NOT NULL,
	"microphone_audio_asset_id" uuid NOT NULL,
	"synthesized_audio_asset_id" uuid NOT NULL,
	"manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"synthesis_status" text DEFAULT 'queued' NOT NULL,
	"synthesis_error_message" text,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_recorder_device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "local_recorder_devices" ADD CONSTRAINT "local_recorder_devices_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recorder_devices" ADD CONSTRAINT "local_recorder_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recording_attempts" ADD CONSTRAINT "local_recording_attempts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recording_attempts" ADD CONSTRAINT "local_recording_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recordings" ADD CONSTRAINT "local_recordings_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recordings" ADD CONSTRAINT "local_recordings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recordings" ADD CONSTRAINT "local_recordings_local_recording_attempt_id_local_recording_attempts_id_fk" FOREIGN KEY ("local_recording_attempt_id") REFERENCES "public"."local_recording_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recordings" ADD CONSTRAINT "local_recordings_computer_audio_asset_id_media_assets_id_fk" FOREIGN KEY ("computer_audio_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recordings" ADD CONSTRAINT "local_recordings_microphone_audio_asset_id_media_assets_id_fk" FOREIGN KEY ("microphone_audio_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recordings" ADD CONSTRAINT "local_recordings_synthesized_audio_asset_id_media_assets_id_fk" FOREIGN KEY ("synthesized_audio_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recorder_device_sessions" ADD CONSTRAINT "local_recorder_device_sessions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_recorder_device_sessions" ADD CONSTRAINT "local_recorder_device_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "local_recorder_devices_team_user_device_unique" ON "local_recorder_devices" USING btree ("team_id","user_id","device_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "local_recording_attempts_intent_unique" ON "local_recording_attempts" USING btree ("fallback_intent_id_hash");--> statement-breakpoint
CREATE INDEX "local_recording_attempts_meeting_index" ON "local_recording_attempts" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "local_recording_attempts_primary_active_unique" ON "local_recording_attempts" USING btree ("meeting_id") WHERE "attempt_state" in ('started', 'uploading', 'uploaded');--> statement-breakpoint
CREATE UNIQUE INDEX "local_recorder_device_sessions_token_unique" ON "local_recorder_device_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "local_recorder_device_sessions_user_device_index" ON "local_recorder_device_sessions" USING btree ("user_id","device_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "local_recordings_owner_client_unique" ON "local_recordings" USING btree ("owner_user_id","client_recording_id");--> statement-breakpoint
CREATE UNIQUE INDEX "local_recordings_attempt_unique" ON "local_recordings" USING btree ("local_recording_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "local_recordings_meeting_primary_unique" ON "local_recordings" USING btree ("meeting_id") WHERE "is_primary" = true;
