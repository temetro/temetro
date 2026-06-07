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
  BETTER_AUTH_URL: z.string().min(1).default("http://localhost:4000"),
  FRONTEND_URL: z.string().min(1).default("http://localhost:3000"),
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
}

export const isProd = env.NODE_ENV === "production";
