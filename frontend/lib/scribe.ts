// Client for the ambient AI visit-scribe API. The dialog records (or accepts a
// pasted transcript of) a clinician↔patient visit, transcribes it, drafts a
// structured encounter note, and — after the clinician reviews it — appends the
// note to the patient record (the same write-approval gate as the chat agent).

import { apiFetch } from "@/lib/api-client";
import type { Encounter, Patient } from "@/lib/patients";

export type ScribeVeil = {
  active: boolean;
  level: string;
  classes: string[];
  provider: string;
};

// Turn a stored audio attachment into a raw transcript (server streams it to the
// user's OpenAI/Gemini speech provider). Audio does NOT pass through Veil.
export function transcribeRecording(
  attachmentId: string,
): Promise<{ transcript: string }> {
  return apiFetch<{ transcript: string }>("/api/scribe/transcribe", {
    method: "POST",
    body: JSON.stringify({ attachmentId }),
  });
}

// Draft an encounter note from a transcript. The transcript + patient context
// are de-identified through Veil before any external call; the draft is never
// saved automatically.
export function draftNote(input: {
  fileNumber: string;
  transcript: string;
  visitType?: string;
  date?: string;
}): Promise<{ draft: Encounter; veil: ScribeVeil }> {
  return apiFetch<{ draft: Encounter; veil: ScribeVeil }>("/api/scribe/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// The approval step: append the reviewed note to the patient record.
export function saveNote(
  fileNumber: string,
  encounter: Encounter,
): Promise<Patient> {
  return apiFetch<Patient>("/api/scribe/save", {
    method: "POST",
    body: JSON.stringify({ fileNumber, encounter }),
  });
}
