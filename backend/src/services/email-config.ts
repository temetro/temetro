import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { emailSettings } from "../db/schema/email-settings.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";

export type EmailProvider = "none" | "smtp" | "resend" | "postmark" | "sendgrid";

const ROW_ID = "default";

// Providers that authenticate with an API key (so the UI knows to ask for one).
const API_KEY_PROVIDERS: EmailProvider[] = ["resend", "postmark", "sendgrid"];

export type PublicEmailConfig = {
  provider: EmailProvider;
  fromAddress: string;
  hasCredentials: boolean;
};

export type ActiveEmailConfig = {
  provider: EmailProvider;
  fromAddress: string;
  credentials: string | null;
};

async function getRow() {
  const [row] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.id, ROW_ID))
    .limit(1);
  return row ?? null;
}

export async function getPublicConfig(): Promise<PublicEmailConfig> {
  const row = await getRow();
  return {
    provider: (row?.provider as EmailProvider) ?? "none",
    fromAddress: row?.fromAddress ?? "",
    hasCredentials: Boolean(row?.credentials),
  };
}

// Internal — includes the decrypted API key. Used by lib/email.ts at send time.
export async function getActiveConfig(): Promise<ActiveEmailConfig> {
  const row = await getRow();
  return {
    provider: (row?.provider as EmailProvider) ?? "none",
    fromAddress: row?.fromAddress ?? "",
    credentials: row?.credentials ? decryptSecret(row.credentials) : null,
  };
}

// True when the deployment can actually deliver email (a real provider is set,
// and API-key providers have a key). SMTP relies on env, treated as configured.
export async function isEmailConfigured(): Promise<boolean> {
  const cfg = await getActiveConfig();
  if (cfg.provider === "none") return false;
  if (API_KEY_PROVIDERS.includes(cfg.provider)) return Boolean(cfg.credentials);
  return true; // smtp
}

export async function saveConfig(input: {
  provider: EmailProvider;
  fromAddress: string;
  // undefined = leave existing key untouched; "" = clear it.
  credentials?: string;
}): Promise<PublicEmailConfig> {
  const existing = await getRow();
  const credentials =
    input.credentials === undefined
      ? (existing?.credentials ?? null)
      : input.credentials
        ? encryptSecret(input.credentials)
        : null;

  await db
    .insert(emailSettings)
    .values({
      id: ROW_ID,
      provider: input.provider,
      fromAddress: input.fromAddress,
      credentials,
    })
    .onConflictDoUpdate({
      target: emailSettings.id,
      set: {
        provider: input.provider,
        fromAddress: input.fromAddress,
        credentials,
        updatedAt: new Date(),
      },
    });

  return getPublicConfig();
}
