import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db/index.js";
import { member } from "../db/schema/auth.js";
import { emitToUser } from "../realtime.js";
import { createSystemMessage } from "./messaging.js";
import { createNotification } from "./notifications.js";

// When an employee asks for a password reset but no email provider is configured,
// alert the admin(s) of each clinic the user belongs to: a "System" message card
// in Messages + a bell notification, both deep-linking to that member's settings
// so an admin can set a new password. The reset URL is never exposed.
export async function notifyAdminsPasswordReset(u: {
  id: string;
  name: string;
  email: string;
}): Promise<void> {
  const orgs = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, u.id));
  const orgIds = [...new Set(orgs.map((o) => o.organizationId))];

  for (const orgId of orgIds) {
    try {
      const admins = await db
        .select({ userId: member.userId })
        .from(member)
        .where(
          and(
            eq(member.organizationId, orgId),
            inArray(member.role, ["owner", "admin"]),
          ),
        );
      const adminIds = admins.map((a) => a.userId).filter((id) => id !== u.id);
      if (adminIds.length === 0) continue;

      const body = `${u.name} requested a password reset, but no email provider is configured. Reset their password from their settings.`;
      const { message, recipientIds } = await createSystemMessage(
        orgId,
        adminIds,
        body,
        {
          kind: "passwordReset",
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
        },
      );
      for (const rid of recipientIds) emitToUser(rid, "message:new", message);

      for (const rid of adminIds) {
        const n = await createNotification({
          orgId,
          userId: rid,
          type: "password_reset",
          text: `${u.name} needs a password reset`,
          entityType: "user",
          entityId: u.id,
          actorName: u.name,
        });
        if (n) emitToUser(rid, "notification:new", n);
      }
    } catch (err) {
      console.error("password-reset fallback failed:", err);
    }
  }
}
