import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { userAiSettings } from "../../db/schema/ai.js";
import { decryptSecret, encryptSecret } from "../../lib/crypto.js";
import type { AiConfigInput } from "../../lib/ai-validation.js";
import {
  type AiConfig,
  type ApiProvider,
  DEFAULT_OLLAMA_BASE_URL,
} from "../../types/ai.js";

type AiSettingsRow = typeof userAiSettings.$inferSelect;

const DEFAULTS: Omit<AiSettingsRow, "userId" | "updatedAt"> = {
  mode: "local",
  provider: "anthropic",
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  ollamaModel: "llama3.1",
  defaultModel: "claude-sonnet-4-6",
  defaultEffort: "medium",
  veilLevel: "full",
  apiKeysCipher: {},
};

// The full row for a user (including the encrypted key map), with defaults when
// the user has never saved AI settings. Internal — never returned to clients.
export async function getAiSettings(userId: string): Promise<AiSettingsRow> {
  const [row] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);
  return row ?? { userId, updatedAt: new Date(), ...DEFAULTS };
}

const PROVIDERS: ApiProvider[] = ["openai", "anthropic", "gemini"];

// Strips secrets and reports which providers have a stored key.
export function toAiConfig(row: AiSettingsRow): AiConfig {
  const apiKeySet = Object.fromEntries(
    PROVIDERS.map((p) => [p, Boolean(row.apiKeysCipher[p])]),
  ) as Record<ApiProvider, boolean>;
  return {
    mode: row.mode,
    provider: row.provider,
    ollamaBaseUrl: row.ollamaBaseUrl,
    ollamaModel: row.ollamaModel,
    defaultModel: row.defaultModel,
    defaultEffort: row.defaultEffort,
    veilLevel: row.veilLevel,
    apiKeySet,
  };
}

// Decrypts the stored key for a provider, or null if none/undecryptable.
export function getApiKey(
  row: AiSettingsRow,
  provider: ApiProvider,
): string | null {
  const cipher = row.apiKeysCipher[provider];
  if (!cipher) return null;
  try {
    return decryptSecret(cipher);
  } catch {
    return null;
  }
}

// Upserts a user's AI config. A provided `apiKey` is encrypted and stored for
// the *currently selected* provider (the one in `input.provider`, else the
// existing provider); an empty string clears it. The key is never persisted in
// plaintext and never returned.
export async function saveAiConfig(
  userId: string,
  input: AiConfigInput,
): Promise<AiConfig> {
  const current = await getAiSettings(userId);

  const next = {
    mode: input.mode ?? current.mode,
    provider: input.provider ?? current.provider,
    ollamaBaseUrl: input.ollamaBaseUrl ?? current.ollamaBaseUrl,
    ollamaModel: input.ollamaModel ?? current.ollamaModel,
    defaultModel: input.defaultModel ?? current.defaultModel,
    defaultEffort: input.defaultEffort ?? current.defaultEffort,
    veilLevel: input.veilLevel ?? current.veilLevel,
    apiKeysCipher: { ...current.apiKeysCipher },
  };

  if (input.apiKey !== undefined) {
    const target = input.provider ?? current.provider;
    if (input.apiKey === "") {
      delete next.apiKeysCipher[target];
    } else {
      next.apiKeysCipher[target] = encryptSecret(input.apiKey);
    }
  }

  await db
    .insert(userAiSettings)
    .values({ userId, ...next })
    .onConflictDoUpdate({
      target: userAiSettings.userId,
      set: { ...next, updatedAt: new Date() },
    });

  return toAiConfig({ userId, updatedAt: new Date(), ...next });
}
