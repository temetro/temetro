"use client";

import { UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AddStaffDialog } from "@/components/settings/add-staff-dialog";
import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/access";
import { apiFetch } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

// One row of /api/staff — clinic members joined to their user record (incl. the
// username admin-provisioned staff sign in with).
type StaffMember = {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  username: string | null;
};

function roleLabel(role?: string | null): string {
  if (!role) return ROLE_LABELS.member;
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
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<StaffMember[]>("/api/staff");
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("settings.careTeam.loadError"),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const myRole = members.find((m) => m.userId === session?.user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const removeMember = async (memberId: string) => {
    await authClient.organization.removeMember({ memberIdOrEmail: memberId });
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

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)} type="button">
            <UserPlus className="size-4" />
            {t("settings.careTeam.addMember")}
          </Button>
        </div>
      )}

      <SettingsCard className="divide-y divide-border">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("settings.careTeam.loading")}
          </p>
        ) : (
          members.map((m) => {
            const isSelf = m.userId === session?.user?.id;
            // Prefer the login username; fall back to email for owners who
            // signed up by email.
            const secondary = m.username ? `@${m.username}` : m.email;
            return (
              <div className="flex items-center gap-3 px-4 py-3" key={m.id}>
                <Avatar className="size-8">
                  <AvatarFallback>
                    {initials(m.name, m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name || m.email || m.userId}
                    {isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {t("settings.careTeam.you")}
                      </span>
                    )}
                  </p>
                  {secondary && (
                    <p className="truncate text-xs text-muted-foreground">
                      {secondary}
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

      {canManage && (
        <AddStaffDialog
          onCreated={() => void load()}
          onOpenChange={setAdding}
          open={adding}
        />
      )}
    </SettingsSection>
  );
}
