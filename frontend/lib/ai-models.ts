// Catalog of models the chat can run, shared by the chat-input model picker,
// the Settings → AI panel, and the chat→backend wiring. The actual provider
// call is made by the backend (`backend/src/services/ai/provider.ts`); here we
// only describe the menu of choices. `id` is the provider's model id sent to
// the backend; `descriptionKey` is an i18n key under `chat.input.models.*`.

export type Effort = "low" | "medium" | "high";

export const EFFORT_LEVELS: Effort[] = ["low", "medium", "high"];
export const DEFAULT_EFFORT: Effort = "medium";

// The three supported cloud providers (API key) plus local Ollama.
export type AiProvider = "anthropic" | "openai" | "gemini" | "ollama";

export type AiModel = {
  /** Provider model id passed to the backend. */
  id: string;
  provider: AiProvider;
  /** Short display name shown in the picker trigger. */
  label: string;
  /** i18n key for the one-line description under the label. */
  descriptionKey: string;
  /** Shown directly in the model list; non-primary live under "More models". */
  primary?: boolean;
  /** Whether the Effort control applies to this model. */
  supportsEffort?: boolean;
};

// Curated catalog. Cloud model ids are best-effort current ids and can be
// adjusted without touching the UI. Ollama is a stand-in for "your local model"
// — the concrete tag is configured in Settings → AI.
export const AI_MODELS: AiModel[] = [
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    label: "Opus 4.8",
    descriptionKey: "chat.input.models.opus48",
    primary: true,
    supportsEffort: true,
  },
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    label: "Sonnet 4.6",
    descriptionKey: "chat.input.models.sonnet46",
    primary: true,
    supportsEffort: true,
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Haiku 4.5",
    descriptionKey: "chat.input.models.haiku45",
  },
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    label: "Gemini 2.5 Pro",
    descriptionKey: "chat.input.models.gemini25Pro",
    primary: true,
    supportsEffort: true,
  },
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    descriptionKey: "chat.input.models.gemini25Flash",
    primary: true,
  },
  {
    id: "gemini-2.0-flash",
    provider: "gemini",
    label: "Gemini 2.0 Flash",
    descriptionKey: "chat.input.models.gemini20Flash",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    descriptionKey: "chat.input.models.gpt4o",
    supportsEffort: true,
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o mini",
    descriptionKey: "chat.input.models.gpt4oMini",
  },
  {
    id: "ollama",
    provider: "ollama",
    label: "Local (Ollama)",
    descriptionKey: "chat.input.models.ollama",
  },
];

export const DEFAULT_MODEL_ID = AI_MODELS[0].id;

export function getModel(id: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export const PRIMARY_MODELS = AI_MODELS.filter((m) => m.primary);
export const MORE_MODELS = AI_MODELS.filter((m) => !m.primary);
