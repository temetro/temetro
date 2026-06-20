import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Deployment-wide email-provider configuration — a single row (id = "default").
// Email (verification, password reset, invitations) is sent while the user is
// logged out / before any clinic exists, so this can't be per-clinic; it's one
// config for the whole deployment, set by any clinic admin from Settings →
// Developers. The provider's API key is stored encrypted (lib/crypto.ts).
export const emailSettings = pgTable("email_settings", {
  id: text("id").primaryKey().default("default"),
  // "none" | "smtp" | "resend" | "postmark" | "sendgrid"
  provider: text("provider").notNull().default("none"),
  fromAddress: text("from_address").notNull().default(""),
  // Encrypted API key (Resend/Postmark/SendGrid). SMTP uses env credentials.
  credentials: text("credentials"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
