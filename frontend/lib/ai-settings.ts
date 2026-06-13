import { apiFetch } from "@/lib/api-client";
import type { Effort } from "@/lib/ai-models";

// Mirrors backend/src/types/ai.ts. Per-user AI configuration fetched from and
// saved to /api/ai/config. Provider API keys are write-only: they are never
// returned, only `apiKeySet` reports which providers have a stored key.

export type AiMode = "api" | "local";
export type ApiProvider = "openai" | "anthropic" | "gemini";
export type VeilLevel = "off" | "names" | "full";

export type AiConfig = {
  mode: AiMode;
  provider: ApiProvider;
  ollamaBaseUrl: string;
  ollamaModel: string;
  defaultModel: string;
  defaultEffort: Effort;
  veilLevel: VeilLevel;
  apiKeySet: Record<ApiProvider, boolean>;
};

export type AiConfigPatch = Partial<
  Omit<AiConfig, "apiKeySet">
> & {
  // Plaintext key for the currently selected provider; "" clears it.
  apiKey?: string;
};

export async function getAiConfig(): Promise<AiConfig> {
  const res = await apiFetch<{ config: AiConfig }>("/api/ai/config");
  return res.config;
}

export async function saveAiConfig(patch: AiConfigPatch): Promise<AiConfig> {
  const res = await apiFetch<{ config: AiConfig }>("/api/ai/config", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return res.config;
}

export async function testAiConnection(input: {
  mode: AiMode;
  provider?: ApiProvider;
  ollamaBaseUrl?: string;
}): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>("/api/ai/test", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Commit records the clinician approved in a chat import preview. The backend
// re-validates and writes via the audited patient service.
export async function commitImport(
  records: unknown[],
): Promise<{ created: string[]; failed: { fileNumber?: string; error: string }[] }> {
  return apiFetch("/api/ai/import", {
    method: "POST",
    body: JSON.stringify({ records }),
  });
}
