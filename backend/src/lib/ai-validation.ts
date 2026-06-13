import { z } from "zod";

// Validates the body of PUT /api/ai/config. All fields are optional so the
// client can patch a subset (e.g. just the Veil level). `apiKey`, when present,
// is the plaintext key for the *currently selected* provider — it is encrypted
// before storage and never echoed back.
export const aiConfigInputSchema = z.object({
  mode: z.enum(["api", "local"]).optional(),
  provider: z.enum(["openai", "anthropic", "gemini"]).optional(),
  ollamaBaseUrl: z.string().url().optional(),
  ollamaModel: z.string().min(1).max(120).optional(),
  defaultModel: z.string().min(1).max(120).optional(),
  defaultEffort: z.enum(["low", "medium", "high"]).optional(),
  veilLevel: z.enum(["off", "names", "full"]).optional(),
  // A new key for `provider`; empty string clears the stored key.
  apiKey: z.string().max(400).optional(),
});

export type AiConfigInput = z.infer<typeof aiConfigInputSchema>;

// Body of POST /api/ai/test — probe a provider/Ollama before saving.
export const aiTestInputSchema = z.object({
  mode: z.enum(["api", "local"]),
  provider: z.enum(["openai", "anthropic", "gemini"]).optional(),
  ollamaBaseUrl: z.string().url().optional(),
});

export type AiTestInput = z.infer<typeof aiTestInputSchema>;
