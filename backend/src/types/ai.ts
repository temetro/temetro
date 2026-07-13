// Shared AI-configuration types, mirrored loosely by the frontend Settings →
// AI panel. The chat agent reads these to decide which provider/model to call
// and how strict the Veil de-identification safeguard should be.

// Inference modes:
//   api    — a user-provided cloud API key
//   local  — a local Ollama model
//   auto   — auto-pick: use a cloud key when one is set, else fall back to local
//   off    — the assistant is disabled
export type AiMode = "api" | "local" | "auto" | "off";

// The three supported cloud providers for API-key mode.
export type ApiProvider = "openai" | "anthropic" | "gemini";

export type Effort = "low" | "medium" | "high";

// Veil (PHI de-identification) strictness. Only applies on external (API-key)
// calls; local Ollama never leaves the clinic so Veil is bypassed there.
//   off   — send clinical context as-is (not recommended; logged)
//   names — tokenize direct identifiers (name, MRN, provider, DOB)
//   full  — names + free-text scrubbing of incidental identifiers
export type VeilLevel = "off" | "names" | "full";

// Non-secret AI config returned to the client. API keys are never included;
// `apiKeySet` records which providers have a stored (encrypted) key.
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

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
