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

const PROVIDER_ORDER: ApiProvider[] = ["anthropic", "openai", "gemini"];

// A safe default model id for each provider, used when the picked model doesn't
// belong to the provider we end up calling.
const DEFAULT_MODEL: Record<ApiProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-2.5-flash",
};

// Choose which provider to actually call: prefer the one the picked model maps
// to (if it has a key), else the user's configured provider (if keyed), else any
// provider that has a key. Returns null when no key is configured at all.
function chooseProvider(
  settings: AiSettingsRow,
  requested: ApiProvider | null,
): ApiProvider | null {
  if (requested && getApiKey(settings, requested)) return requested;
  if (getApiKey(settings, settings.provider)) return settings.provider;
  return PROVIDER_ORDER.find((p) => getApiKey(settings, p)) ?? null;
}

// Resolve a concrete LanguageModel for a request. `requestedModelId` is the id
// the user picked in the chat input; when it maps to a cloud provider we use
// that provider's stored key, otherwise we fall back to local Ollama (also used
// when mode === "local" or the picked model is the local sentinel).
export function resolveModel(
  settings: AiSettingsRow,
  requestedModelId: string,
): ResolvedModel {
  // Off → the assistant is disabled. Guard here in case a request slips past the
  // route-level short-circuit.
  if (settings.mode === "off") {
    throw new HttpError(
      400,
      "The AI assistant is turned off. Turn it on in Settings → AI.",
    );
  }

  const requested = providerForModel(requestedModelId);
  // In api/auto mode, find a cloud provider that actually has a key. Auto with
  // no key (and api mode's remaining fall-through) drops to local Ollama below.
  const provider =
    settings.mode === "api" || settings.mode === "auto"
      ? chooseProvider(settings, requested)
      : null;

  // Local when: explicit local mode, the local sentinel was picked, or auto with
  // no configured cloud key. → Ollama's OpenAI-compatible endpoint.
  if (
    settings.mode === "local" ||
    requestedModelId === OLLAMA_SENTINEL ||
    (settings.mode === "auto" && !provider)
  ) {
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

  // API mode with a picked cloud model but no matching/any key.
  if (!provider) {
    throw new HttpError(
      400,
      "No AI provider API key is configured. Add one in Settings → AI, or switch to a local model.",
    );
  }

  // Use the picked model only if it belongs to the chosen provider; otherwise
  // use the user's default (or a per-provider default).
  const modelName =
    requested === provider
      ? requestedModelId
      : providerForModel(settings.defaultModel) === provider
        ? settings.defaultModel
        : DEFAULT_MODEL[provider];

  const apiKey = getApiKey(settings, provider)!;
  const model: LanguageModel =
    provider === "anthropic"
      ? createAnthropic({ apiKey })(modelName)
      : provider === "gemini"
        ? createGoogleGenerativeAI({ apiKey })(modelName)
        : createOpenAI({ apiKey })(modelName);

  return { model, isExternal: true, providerLabel: PROVIDER_LABELS[provider] };
}
