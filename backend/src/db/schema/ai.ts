import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type {
  AiMode,
  ApiProvider,
  Effort,
  VeilLevel,
} from "../../types/ai.js";
import { user } from "./auth.js";

// Per-user AI configuration. One row per user (keyed by the Better Auth user
// id). Non-secret fields are plain columns; provider API keys are stored
// encrypted (src/lib/crypto.ts) in `apiKeysCipher` as a map keyed by provider,
// so a user can save more than one provider's key and switch without re-entry.
// The encrypted blob is never returned to the client.
export const userAiSettings = pgTable("user_ai_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  mode: text("mode").$type<AiMode>().notNull().default("local"),
  provider: text("provider").$type<ApiProvider>().notNull().default("anthropic"),
  ollamaBaseUrl: text("ollama_base_url")
    .notNull()
    .default("http://localhost:11434"),
  // Local model tag served by Ollama (e.g. "llama3.1"); used in local mode.
  ollamaModel: text("ollama_model").notNull().default("llama3.1"),
  defaultModel: text("default_model").notNull().default("claude-sonnet-4-6"),
  defaultEffort: text("default_effort").$type<Effort>().notNull().default("medium"),
  veilLevel: text("veil_level").$type<VeilLevel>().notNull().default("full"),
  // Encrypted per-provider keys: { openai?, anthropic?, gemini? }, each value
  // an opaque ciphertext string from encryptSecret().
  apiKeysCipher: jsonb("api_keys_cipher")
    .$type<Partial<Record<ApiProvider, string>>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
