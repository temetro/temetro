import nodemailer from "nodemailer";

import { env } from "../env.js";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// Lazily build a transport. With SMTP_HOST configured we send real mail;
// otherwise we fall back to logging the message (and any links) to the
// server console — zero setup for local / open-source development.
const transport = env.SMTP_HOST
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

export async function sendEmail({ to, subject, text, html }: SendArgs): Promise<void> {
  if (!transport) {
    console.info(
      [
        "",
        "✉️  [email:console] No SMTP configured — printing instead of sending.",
        `    to:      ${to}`,
        `    subject: ${subject}`,
        `    body:    ${text}`,
        "",
      ].join("\n"),
    );
    return;
  }

  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html: html ?? text,
  });
}
