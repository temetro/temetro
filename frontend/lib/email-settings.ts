import { apiFetch } from "@/lib/api-client";

// Deployment-wide email provider config (Settings → Developers). The API key is
// never returned — `hasCredentials` only signals whether one is stored.
export type EmailProvider = "none" | "smtp" | "resend" | "postmark" | "sendgrid";

export type EmailConfig = {
  provider: EmailProvider;
  fromAddress: string;
  hasCredentials: boolean;
};

export function getEmailConfig(): Promise<EmailConfig> {
  return apiFetch<EmailConfig>("/api/settings/email");
}

export function saveEmailConfig(input: {
  provider: EmailProvider;
  fromAddress: string;
  // undefined = leave existing key; "" = clear; string = set/replace.
  credentials?: string;
}): Promise<EmailConfig> {
  return apiFetch<EmailConfig>("/api/settings/email", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function testEmailConfig(): Promise<{ ok: boolean; to: string }> {
  return apiFetch("/api/settings/email/test", { method: "POST" });
}
