import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { HttpError } from "../../lib/http-error.js";
import type { ApiProvider } from "../../types/ai.js";
import { getApiKey } from "./config.js";
import type { userAiSettings } from "../../db/schema/ai.js";

type AiSettingsRow = typeof userAiSettings.$inferSelect;

export type ResolvedModel = {
  model: LanguageModel;
  // True for external cloud providers — Veil de-identification applies. False
  // for local Ollama (data never leaves the clinic).
  isExternal: boolean;
  providerLabel: string;
};

// The "ollama" sentinel id from the frontend catalog means "use my local
// model" regardless of the model field.
const OLLAMA_SENTINEL = "ollama";

// Derive the cloud provider from a catalog model id, so the picker drives which
// provider/key is used. Returns null for the local sentinel.
function providerForModel(modelId: string): ApiProvider | null {
  if (modelId === OLLAMA_SENTINEL) return null;
  if (modelId.startsWith("claude")) return "anthropic";
  if (modelId.startsWith("gemini")) return "gemini";
  if (modelId.startsWith("gpt") || /^o\d/.test(modelId)) return "openai";
  return null;
}

const PROVIDER_LABELS: Record<ApiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

// Resolve a concrete LanguageModel for a request. `requestedModelId` is the id
// the user picked in the chat input; when it maps to a cloud provider we use
// that provider's stored key, otherwise we fall back to local Ollama (also used
// when mode === "local" or the picked model is the local sentinel).
export function resolveModel(
  settings: AiSettingsRow,
  requestedModelId: string,
): ResolvedModel {
  const provider =
    settings.mode === "local" ? null : providerForModel(requestedModelId);

  if (!provider) {
    // Local mode via Ollama's OpenAI-compatible endpoint. No key required.
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL: `${settings.ollamaBaseUrl.replace(/\/$/, "")}/v1`,
    });
    return {
      model: ollama(settings.ollamaModel),
      isExternal: false,
      providerLabel: "Local (Ollama)",
    };
  }

  const apiKey = getApiKey(settings, provider);
  if (!apiKey) {
    throw new HttpError(
      400,
      `No API key configured for ${PROVIDER_LABELS[provider]}. Add one in Settings → AI.`,
    );
  }

  const model: LanguageModel =
    provider === "anthropic"
      ? createAnthropic({ apiKey })(requestedModelId)
      : provider === "gemini"
        ? createGoogleGenerativeAI({ apiKey })(requestedModelId)
        : createOpenAI({ apiKey })(requestedModelId);

  return { model, isExternal: true, providerLabel: PROVIDER_LABELS[provider] };
}
