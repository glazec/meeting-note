ALTER TABLE "meetings" ADD COLUMN "translation_language" text DEFAULT 'zh-CN' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "translation_language" text DEFAULT 'zh-CN' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_translation_language_check" CHECK ("meetings"."translation_language" in ('zh-CN', 'en'));--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_translation_language_check" CHECK ("teams"."translation_language" in ('zh-CN', 'en'));