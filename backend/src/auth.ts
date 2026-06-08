import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { username } from "better-auth/plugins/username";
import { eq } from "drizzle-orm";

import { db } from "./db/index.js";
import * as authSchema from "./db/schema/auth.js";
import { env } from "./env.js";
import { ac, roles } from "./lib/access.js";
import { sendEmail } from "./lib/email.js";

const WEEK = 60 * 60 * 24 * 7;
const DAY = 60 * 60 * 24;

export const auth = betterAuth({
  appName: "temetro",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),

  emailAndPassword: {
    enabled: true,
    // TODO(verification): Email verification is intentionally NOT enforced for
    // now so users can sign in immediately. Verification emails are still sent
    // (sendOnSignUp below) and the /verify-email flow still works — flip this
    // back to `true` to make verification mandatory before sign-in.
    requireEmailVerification: false,
    minPasswordLength: 12,
    maxPasswordLength: 256,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your temetro password",
        text: `Reset your password by opening this link:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email for temetro",
        text: `Welcome to temetro. Verify your email address by opening this link:\n\n${url}`,
      });
    },
  },

  plugins: [
    // Lets staff sign in with a username (in addition to email). Admin-created
    // staff accounts (see src/routes/staff.ts) set a username + password the
    // employee uses to log in. Adds `username` + `displayUsername` to `user`.
    username({
      minUsernameLength: 3,
      maxUsernameLength: 32,
    }),
    organization({
      ac,
      roles,
      creatorRole: "owner",
      // Verification isn't enforced right now (see emailAndPassword above), so
      // any signed-in user may create a clinic. Re-tie this to
      // `user.emailVerified === true` when verification is re-enabled.
      allowUserToCreateOrganization: true,
      membershipLimit: 200,
      invitationExpiresIn: WEEK,
      sendInvitationEmail: async (data) => {
        const url = `${env.FRONTEND_URL}/accept-invite?id=${data.invitation.id}`;
        await sendEmail({
          to: data.email,
          subject: `${data.inviter.user.name} invited you to join ${data.organization.name} on temetro`,
          text: `${data.inviter.user.name} invited you to join the clinic "${data.organization.name}".\n\nAccept the invitation:\n\n${url}`,
        });
      },
    }),
  ],

  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },

  session: {
    expiresIn: WEEK,
    updateAge: DAY,
    cookieCache: { enabled: true, maxAge: 300 },
  },

  advanced: {
    // Secure cookies only when actually served over HTTPS — otherwise the
    // browser silently drops them over http://localhost and login "does
    // nothing". This is correct regardless of NODE_ENV.
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    defaultCookieAttributes: { sameSite: "lax" },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Default the active organization to the user's first clinic so
          // returning members skip onboarding on sign-in.
          const rows = await db
            .select({ organizationId: authSchema.member.organizationId })
            .from(authSchema.member)
            .where(eq(authSchema.member.userId, session.userId))
            .limit(1);
          const organizationId = rows[0]?.organizationId;
          if (organizationId) {
            return { data: { ...session, activeOrganizationId: organizationId } };
          }
          return undefined;
        },
        after: async (session) => {
          // Lightweight audit trail; swap console for a real sink in prod.
          console.info(
            `[audit] session.created user=${session.userId} ip=${session.ipAddress ?? "-"}`,
          );
        },
      },
    },
  },
});

export type Auth = typeof auth;
