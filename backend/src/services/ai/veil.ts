import type { Patient } from "../../types/patient.js";
import type { VeilLevel } from "../../types/ai.js";

// Veil — temetro's PHI de-identification safeguard. When the chat runs against
// an external cloud model, Veil sits between the patient data and the model:
//
//   • tool RESULTS are redacted — direct identifiers (name, MRN, provider) are
//     swapped for stable tokens like [PATIENT_1] / [MRN_1] before the model
//     sees them. Clinical values (labs, vitals, problems, meds) pass through —
//     they're what the model needs to reason.
//   • tool ARGUMENTS are resolved — when the model calls a tool with a token
//     (e.g. getPatientLabs("[MRN_1]")) Veil maps it back to the real file
//     number server-side, so the external model never needs the real MRN.
//   • the final OUTPUT is rehydrated — tokens are swapped back to real values
//     before the answer reaches the clinician.
//
// Local Ollama mode never leaves the clinic, so Veil is created inactive there
// (level "off") and every method is a pass-through.

type TokenClass = "PATIENT" | "MRN" | "PROVIDER";

export type Veil = {
  active: boolean;
  level: VeilLevel;
  /** De-identify a patient record for sending to an external model. */
  redactPatient: (patient: Patient) => Patient;
  /** Map a possibly-tokenized file number from a tool call back to the real one. */
  resolveFileNumber: (input: string) => string;
  /** Swap any tokens in model output back to real identifiers. */
  rehydrate: (text: string) => string;
  /** Token classes actually emitted — for the audit log. */
  usedClasses: () => TokenClass[];
};

export function createVeil(level: VeilLevel, active: boolean): Veil {
  // Real value → token, and token → real value, plus a reverse map keyed by
  // token for fast file-number resolution.
  const toToken = new Map<string, string>();
  const fromToken = new Map<string, string>();
  const mrnByToken = new Map<string, string>();
  const counters: Record<TokenClass, number> = {
    PATIENT: 0,
    MRN: 0,
    PROVIDER: 0,
  };

  function tokenFor(cls: TokenClass, value: string): string {
    const key = `${cls}:${value}`;
    const existing = toToken.get(key);
    if (existing) return existing;
    counters[cls] += 1;
    const token = `[${cls}_${counters[cls]}]`;
    toToken.set(key, token);
    fromToken.set(token, value);
    if (cls === "MRN") mrnByToken.set(token, value);
    return token;
  }

  const isActive = active && level !== "off";

  function redactPatient(patient: Patient): Patient {
    if (!isActive) return patient;
    const provider = patient.pcp
      ? tokenFor("PROVIDER", patient.pcp)
      : patient.pcp;
    return {
      ...patient,
      name: tokenFor("PATIENT", patient.name),
      fileNumber: tokenFor("MRN", patient.fileNumber),
      initials: "··",
      pcp: provider,
      encounters: patient.encounters.map((e) => ({
        ...e,
        provider: e.provider ? tokenFor("PROVIDER", e.provider) : e.provider,
      })),
    };
  }

  function resolveFileNumber(input: string): string {
    if (!isActive) return input;
    return mrnByToken.get(input.trim()) ?? input;
  }

  function rehydrate(text: string): string {
    if (!isActive || fromToken.size === 0) return text;
    let out = text;
    for (const [token, real] of fromToken) {
      out = out.split(token).join(real);
    }
    return out;
  }

  function usedClasses(): TokenClass[] {
    return (Object.keys(counters) as TokenClass[]).filter(
      (c) => counters[c] > 0,
    );
  }

  return {
    active: isActive,
    level,
    redactPatient,
    resolveFileNumber,
    rehydrate,
    usedClasses,
  };
}
