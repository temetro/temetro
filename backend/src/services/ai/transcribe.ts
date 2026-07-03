import { HttpError } from "../../lib/http-error.js";
import type { userAiSettings } from "../../db/schema/ai.js";
import { getApiKey } from "./config.js";

type AiSettingsRow = typeof userAiSettings.$inferSelect;

export type AudioInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

// Which transcription backend a user's AI settings can reach. Anthropic has no
// speech-to-text API, so an Anthropic-only user must paste a transcript instead.
export type TranscribeProvider = "openai" | "gemini";

export function transcribeProviderFor(
  settings: AiSettingsRow,
): TranscribeProvider | null {
  if (getApiKey(settings, "openai")) return "openai";
  if (getApiKey(settings, "gemini")) return "gemini";
  return null;
}

const OPENAI_MODEL = "whisper-1";
const GEMINI_MODEL = "gemini-2.5-flash";

const TRANSCRIBE_PROMPT =
  "Transcribe this clinical visit recording verbatim. Return only the spoken words as plain text, with no commentary, headings, or timestamps.";

async function transcribeWithOpenAI(
  apiKey: string,
  audio: AudioInput,
): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType }),
    audio.filename,
  );
  form.append("model", OPENAI_MODEL);
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(
      502,
      `Transcription failed (OpenAI ${res.status}). ${detail.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

async function transcribeWithGemini(
  apiKey: string,
  audio: AudioInput,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: audio.mimeType,
                data: audio.buffer.toString("base64"),
              },
            },
            { text: TRANSCRIBE_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(
      502,
      `Transcription failed (Gemini ${res.status}). ${detail.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  return text;
}

// Send an audio recording to the user's transcription provider and return the
// raw transcript. The audio never passes through the chat loop or Veil — Veil
// cannot redact speech, so the caller must warn the clinician that audio leaves
// the clinic when an external provider is used (only the DRAFTING step is
// Veil-protected). Throws a 400 when no speech-capable provider is configured.
export async function transcribeAudio(
  settings: AiSettingsRow,
  audio: AudioInput,
): Promise<{ transcript: string; provider: TranscribeProvider }> {
  const provider = transcribeProviderFor(settings);
  if (!provider) {
    throw new HttpError(
      400,
      "Transcription needs an OpenAI or Gemini API key. Add one in Settings → AI, or paste the visit transcript instead.",
    );
  }
  const apiKey = getApiKey(settings, provider)!;
  const transcript =
    provider === "openai"
      ? await transcribeWithOpenAI(apiKey, audio)
      : await transcribeWithGemini(apiKey, audio);
  if (!transcript) {
    throw new HttpError(
      502,
      "The transcription came back empty — try again or paste the transcript.",
    );
  }
  return { transcript, provider };
}
