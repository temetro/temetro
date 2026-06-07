"use client";

import { X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/access";
import { authClient } from "@/lib/auth-client";

type Member = {
  id: string;
  role: string;
  userId: string;
  user?: { name?: string | null; email?: string | null };
};
type Invite = {
  id: string;
  email: string;
  role?: string | null;
  status: string;
};

const INVITE_ROLES = ["member", "admin", "viewer"] as const;

function roleLabel(role?: string | null): string {
  if (!role) return "Member";
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

function initials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  return (
    source
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function CareTeamPanel() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>("member");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } =
      await authClient.organization.getFullOrganization();
    if (err || !data) {
      setError(err?.message ?? t("settings.careTeam.loadError"));
      setLoading(false);
      return;
    }
    setMembers((data.members ?? []) as Member[]);
    setInvites(
      ((data.invitations ?? []) as Invite[]).filter(
        (i) => i.status === "pending"
      )
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const myRole = members.find((m) => m.userId === session?.user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || inviting) return;
    setInviting(true);
    setNotice(null);
    setError(null);
    const { error: err } = await authClient.organization.inviteMember({
      email: email.trim(),
      role,
    });
    setInviting(false);
    if (err) {
      setError(err.message ?? t("settings.careTeam.inviteError"));
      return;
    }
    setEmail("");
    setNotice(t("settings.careTeam.inviteSent", { email: email.trim() }));
    void load();
  };

  const removeMember = async (memberId: string) => {
    await authClient.organization.removeMember({ memberIdOrEmail: memberId });
    void load();
  };

  const cancelInvite = async (invitationId: string) => {
    await authClient.organization.cancelInvitation({ invitationId });
    void load();
  };

  return (
    <SettingsSection
      description={t("settings.careTeam.description")}
      title={t("settings.careTeam.title")}
    >
      {error && (
        <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary">
          {notice}
        </p>
      )}

      {canManage && (
        <SettingsCard className="p-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={invite}
          >
            <Input
              className="flex-1"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("settings.careTeam.invitePlaceholder")}
              required
              type="email"
              value={email}
            />
            <select
              className="h-9 rounded-3xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              onChange={(e) =>
                setRole(e.target.value as (typeof INVITE_ROLES)[number])
              }
              value={role}
            >
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
            <Button disabled={inviting} type="submit">
              {inviting
                ? t("settings.careTeam.inviting")
                : t("settings.careTeam.invite")}
            </Button>
          </form>
        </SettingsCard>
      )}

      <SettingsCard className="divide-y divide-border">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("settings.careTeam.loading")}
          </p>
        ) : (
          members.map((m) => {
            const isSelf = m.userId === session?.user?.id;
            return (
              <div className="flex items-center gap-3 px-4 py-3" key={m.id}>
                <Avatar className="size-8">
                  <AvatarFallback>
                    {initials(m.user?.name, m.user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user?.name || m.user?.email || m.userId}
                    {isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {t("settings.careTeam.you")}
                      </span>
                    )}
                  </p>
                  {m.user?.email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {m.user.email}
                    </p>
                  )}
                </div>
                <Badge className="capitalize" variant="secondary">
                  {roleLabel(m.role)}
                </Badge>
                {canManage && !isSelf && m.role !== "owner" && (
                  <Button
                    aria-label={t("settings.careTeam.removeMember")}
                    onClick={() => removeMember(m.id)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </SettingsCard>

      {invites.length > 0 && (
        <SettingsCard className="divide-y divide-border">
          <p className="px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("settings.careTeam.pendingInvitations")}
          </p>
          {invites.map((inv) => (
            <div className="flex items-center gap-3 px-4 py-3" key={inv.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{inv.email}</p>
              </div>
              <Badge className="capitalize" variant="outline">
                {roleLabel(inv.role)}
              </Badge>
              {canManage && (
                <Button
                  aria-label={t("settings.careTeam.cancelInvitation")}
                  onClick={() => cancelInvite(inv.id)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </SettingsCard>
      )}
    </SettingsSection>
  );
}
