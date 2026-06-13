CREATE TABLE "user_ai_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'local' NOT NULL,
	"provider" text DEFAULT 'anthropic' NOT NULL,
	"ollama_base_url" text DEFAULT 'http://localhost:11434' NOT NULL,
	"ollama_model" text DEFAULT 'llama3.1' NOT NULL,
	"default_model" text DEFAULT 'claude-sonnet-4-6' NOT NULL,
	"default_effort" text DEFAULT 'medium' NOT NULL,
	"veil_level" text DEFAULT 'full' NOT NULL,
	"api_keys_cipher" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ai_settings" ADD CONSTRAINT "user_ai_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;