"use client";

import { Info, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AddStaffDialog } from "@/components/settings/add-staff-dialog";
import {
  EmployeeDetailDialog,
  type StaffMember,
} from "@/components/settings/employee-detail-dialog";
import { specialtyLabel } from "@/lib/staff";
import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_LABELS } from "@/lib/access";
import { apiFetch } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/toast";

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

export function CareTeamPanel({
  initialMemberId,
}: {
  initialMemberId?: string;
}) {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pendingRemove, setPendingRemove] = useState<StaffMember | null>(null);
  const [removing, setRemoving] = useState(false);

  // The effect owns the fetch; `reload()` just bumps a key to re-run it. That
  // keeps every setState inside a promise callback rather than running
  // synchronously when the effect fires, and it drops the exhaustive-deps
  // suppression the old useCallback needed.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    apiFetch<StaffMember[]>("/api/staff")
      .then((data) => {
        if (!active) return;
        setMembers(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : t("settings.careTeam.loadError"),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // `t` is intentionally omitted: re-fetching the staff list on a language
    // change would be pointless, and the message is only read on failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // Deep-link: open a specific member (e.g. from a password-reset system card).
  // Resolved during render once the list arrives, so the member's dialog opens
  // on the same paint the list does.
  const [appliedDeepLink, setAppliedDeepLink] = useState(false);
  if (!appliedDeepLink && initialMemberId && members.length > 0) {
    setAppliedDeepLink(true);
    const target = members.find((m) => m.userId === initialMemberId);
    if (target) setSelected(target);
  }

  const myRole = members.find((m) => m.userId === session?.user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const confirmRemove = async () => {
    if (!pendingRemove || removing) return;
    setRemoving(true);
    const { error: err } = await authClient.organization.removeMember({
      memberIdOrEmail: pendingRemove.id,
    });
    setRemoving(false);
    if (err) {
      notify.error(
        t("settings.careTeam.remove.failedTitle"),
        err.message ?? t("settings.careTeam.remove.failedBody"),
      );
      return;
    }
    notify.success(
      t("settings.careTeam.remove.removedTitle"),
      t("settings.careTeam.remove.removedBody", {
        name: pendingRemove.name ?? pendingRemove.email ?? "",
      }),
    );
    setPendingRemove(null);
    reload();
  };

  return (
    <SettingsSection
      description={t("settings.careTeam.description")}
      title={t("settings.careTeam.title")}
    >
      {error && (
        <SettingsCard className="bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </SettingsCard>
      )}

      {canManage && (
        <SettingsCard className="flex flex-row items-center justify-between gap-4 p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" />
            {t("settings.careTeam.clickHint")}
          </p>
          <Button onClick={() => setAdding(true)} type="button">
            <UserPlus className="size-4" />
            {t("settings.careTeam.addMember")}
          </Button>
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
            // Prefer the login username; fall back to email for owners who
            // signed up by email.
            const secondary = m.username ? `@${m.username}` : m.email;
            const body = (
              <>
                <Avatar className="size-8">
                  <AvatarFallback>
                    {initials(m.name, m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-start">
                  <p className="truncate text-sm font-medium">
                    {m.name || m.email || m.userId}
                    {isSelf && (
                      <span className="ms-1 text-xs text-muted-foreground">
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
                {specialtyLabel(t, m.specialty) && (
                  <Badge variant="outline">
                    {specialtyLabel(t, m.specialty)}
                  </Badge>
                )}
                <Badge className="capitalize" variant="secondary">
                  {roleLabel(m.role)}
                </Badge>
              </>
            );
            // Admins click a row to open the employee detail dialog (view
            // permissions, change role, remove). Non-managers see a static row.
            return canManage ? (
              <button
                className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                key={m.id}
                onClick={() => setSelected(m)}
                type="button"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3" key={m.id}>
                {body}
              </div>
            );
          })
        )}
      </SettingsCard>

      {canManage && (
        <AddStaffDialog
          onCreated={reload}
          onOpenChange={setAdding}
          open={adding}
        />
      )}

      {/* Click a member to view details, change role, or remove. */}
      <EmployeeDetailDialog
        editable={
          canManage &&
          selected?.userId !== session?.user?.id &&
          selected?.role !== "owner"
        }
        member={selected}
        onChanged={reload}
        onOpenChange={(o) => !o && setSelected(null)}
        onRemove={(m) => {
          setSelected(null);
          setPendingRemove(m);
        }}
        open={selected !== null}
      />

      {/* Confirm before removing a member — destructive and not reversible. */}
      <Dialog
        onOpenChange={(o) => !o && setPendingRemove(null)}
        open={pendingRemove !== null}
      >
        <DialogPopup className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.careTeam.remove.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.careTeam.remove.description", {
                name:
                  pendingRemove?.name ??
                  pendingRemove?.email ??
                  t("settings.careTeam.remove.thisMember"),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("settings.careTeam.remove.cancel")}
            </DialogClose>
            <Button
              disabled={removing}
              onClick={confirmRemove}
              type="button"
              variant="destructive"
            >
              {removing
                ? t("settings.careTeam.remove.removing")
                : t("settings.careTeam.remove.confirm")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </SettingsSection>
  );
}
