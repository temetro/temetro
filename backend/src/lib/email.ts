import nodemailer from "nodemailer";

import { env } from "../env.js";
import { getActiveConfig } from "../services/email-config.js";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// SMTP transport (built from env) — used when the active provider is "smtp" or,
// for backward compatibility, when SMTP_HOST is set and no provider is chosen.
const smtpTransport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    })
  : null;

function logToConsole({ to, subject, text }: SendArgs): void {
  console.info(
    [
      "",
      "✉️  [email:console] No email provider configured — printing instead of sending.",
      `    to:      ${to}`,
      `    subject: ${subject}`,
      `    body:    ${text}`,
      "",
    ].join("\n"),
  );
}

async function sendViaResend(
  apiKey: string,
  from: string,
  { to, subject, text, html }: SendArgs,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text, html: html ?? text }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

async function sendViaPostmark(
  apiKey: string,
  from: string,
  { to, subject, text, html }: SendArgs,
): Promise<void> {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      TextBody: text,
      HtmlBody: html ?? text,
      MessageStream: "outbound",
    }),
  });
  if (!res.ok)
    throw new Error(`Postmark failed: ${res.status} ${await res.text()}`);
}

async function sendViaSendgrid(
  apiKey: string,
  from: string,
  { to, subject, text, html }: SendArgs,
): Promise<void> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html ?? text },
      ],
    }),
  });
  if (!res.ok)
    throw new Error(`SendGrid failed: ${res.status} ${await res.text()}`);
}

// Send an email via the deployment's configured provider. Falls back to logging
// when nothing is configured so local/open-source dev needs zero setup.
export async function sendEmail(args: SendArgs): Promise<void> {
  const cfg = await getActiveConfig();
  // A real "from": the configured address, else the SMTP default.
  const from = cfg.fromAddress || env.SMTP_FROM;

  switch (cfg.provider) {
    case "resend":
      if (!cfg.credentials) return logToConsole(args);
      return sendViaResend(cfg.credentials, from, args);
    case "postmark":
      if (!cfg.credentials) return logToConsole(args);
      return sendViaPostmark(cfg.credentials, from, args);
    case "sendgrid":
      if (!cfg.credentials) return logToConsole(args);
      return sendViaSendgrid(cfg.credentials, from, args);
    case "smtp": {
      if (!smtpTransport) return logToConsole(args);
      await smtpTransport.sendMail({
        from,
        to: args.to,
        subject: args.subject,
        text: args.text,
        html: args.html ?? args.text,
      });
      return;
    }
    default: {
      // No provider chosen — honour a pre-existing SMTP env setup if present.
      if (smtpTransport) {
        await smtpTransport.sendMail({
          from,
          to: args.to,
          subject: args.subject,
          text: args.text,
          html: args.html ?? args.text,
        });
        return;
      }
      return logToConsole(args);
    }
  }
}
