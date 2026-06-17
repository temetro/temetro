// The chat "situation" modes shown in the composer — what the clinician wants
// the assistant to do, rather than which LLM runs (the model/provider is set
// once in Settings → AI). The mode travels with each send so the backend can
// shape its system prompt, and Graph mode also renders the record graph for the
// `/patient` fast-path.

import { MessageSquare, Network, Sparkles } from "lucide-react";

export type ChatMode = "chat" | "analysis" | "graph";

export const DEFAULT_MODE: ChatMode = "chat";

export type ChatModeOption = {
  id: ChatMode;
  icon: typeof MessageSquare;
  // i18n keys under `chat.input.modes.*`.
  labelKey: string;
  descriptionKey: string;
};

export const CHAT_MODES: ChatModeOption[] = [
  {
    id: "chat",
    icon: MessageSquare,
    labelKey: "chat.input.modes.chat.label",
    descriptionKey: "chat.input.modes.chat.description",
  },
  {
    id: "analysis",
    icon: Sparkles,
    labelKey: "chat.input.modes.analysis.label",
    descriptionKey: "chat.input.modes.analysis.description",
  },
  {
    id: "graph",
    icon: Network,
    labelKey: "chat.input.modes.graph.label",
    descriptionKey: "chat.input.modes.graph.description",
  },
];

export function getMode(id: string): ChatModeOption {
  return CHAT_MODES.find((m) => m.id === id) ?? CHAT_MODES[0];
}
