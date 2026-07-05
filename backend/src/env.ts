import "dotenv/config";
import { z } from "zod";

// Defaults keep this module loadable even with no .env present (e.g. when the
// Better Auth / drizzle-kit CLIs introspect the config offline). Real values
// come from .env at runtime; production misconfiguration is caught below.
const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://temetro:temetro@localhost:5432/temetro"),
  BETTER_AUTH_SECRET: z.string().min(1).default("dev-insecure-secret-change-me"),
  // Key used to encrypt at-rest AI provider API keys (src/lib/crypto.ts). Any
  // length passphrase; rotating it invalidates stored keys (they re-enter).
  AI_CREDENTIALS_KEY: z
    .string()
    .min(1)
    .default("dev-insecure-ai-key-change-me"),
  // Directory where uploaded patient/lab files are stored on disk. Back this
  // with a persistent volume in production (see docker-compose.yml).
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  BETTER_AUTH_URL: z.string().min(1).default("http://localhost:4000"),
  FRONTEND_URL: z.string().min(1).default("http://localhost:3000"),
  // Extra browser origins allowed to call the API with credentials, beyond
  // FRONTEND_URL and the auto-allowed private/LAN hosts (see src/lib/origins.ts).
  // Comma-separated; set to "*" to allow any origin (only for trusted networks).
  TRUSTED_ORIGINS: z.string().optional(),
  // Overrides the version reported by GET /api/version. Normally derived from
  // package.json; the release pipeline can pin it explicitly.
  APP_VERSION: z.string().optional(),
  // Temetro Network relay (github.com/temetro/temetro-network). Both this
  // backend and patient phones connect to it; it routes the encrypted wallet
  // messages between them. RELAY_URL is the relay's public URL (also baked into
  // the QR a patient scans). Each clinic authenticates to the relay's /hub with
  // its own Ed25519 signing key, so no shared secret is needed. RELAY_TOKEN is
  // now *optional/legacy* — set it only for a private relay that also gates on a
  // shared token (must then match the relay's RELAY_TOKEN).
  //
  // Defaults to the hosted relay so "Join Temetro Network" works out of the box;
  // override only when running your own relay. (A `localhost` default silently
  // fails inside Docker, where localhost is the container itself.)
  RELAY_URL: z.string().min(1).default("https://network.temetro.com"),
  RELAY_TOKEN: z.string().default(""),
  // Public, device-reachable URL of this backend's wallet relay, baked into the
  // QR a patient scans. Optional — when unset we derive it from the request host
  // (so opening the web app over the LAN yields a reachable LAN URL).
  PUBLIC_RELAY_URL: z.string().optional(),
  // Metrics URL of a cloudflared quick-tunnel sidecar (e.g. http://cloudflared:3333).
  // When set and PUBLIC_RELAY_URL is unset, the backend discovers its public
  // trycloudflare.com URL from there for Dockerized off-network testing.
  CLOUDFLARED_METRICS_URL: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("temetro <no-reply@temetro.local>"),
});

// docker compose passes unset optionals as empty strings (e.g. `${SMTP_PORT:-}`).
// Treat empty strings as "unset" so optionals/defaults apply instead of failing
// coercion (e.g. Number("") === 0).
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
);

const parsed = schema.safeParse(rawEnv);

if (!parsed.success) {
  const lines = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  console.error(`❌ Invalid environment variables:\n${lines}`);
  process.exit(1);
}

export const env = parsed.data;

// Fail fast on dangerous production misconfiguration.
if (env.NODE_ENV === "production") {
  if (env.BETTER_AUTH_SECRET === "dev-insecure-secret-change-me") {
    console.error(
      "❌ BETTER_AUTH_SECRET is unset in production. Generate one: openssl rand -base64 32",
    );
    process.exit(1);
  }
  if (env.AI_CREDENTIALS_KEY === "dev-insecure-ai-key-change-me") {
    console.error(
      "❌ AI_CREDENTIALS_KEY is unset in production. Generate one: openssl rand -base64 32",
    );
    process.exit(1);
  }
  // RELAY_TOKEN is optional now: clinics authenticate to the relay with their
  // own Ed25519 signing key, so an unset token is the normal "open relay" case —
  // no warning needed.
}

export const isProd = env.NODE_ENV === "production";
