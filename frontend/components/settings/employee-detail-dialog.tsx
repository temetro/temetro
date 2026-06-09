"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_LABELS } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { PROVISIONABLE_ROLES, rolePermissionSummary } from "@/lib/roles";
import { notify } from "@/lib/toast";

// One row of /api/staff — shared with the Care Team panel.
export type StaffMember = {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  username: string | null;
};

const selectClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

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

type Props = {
  member: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // True when the viewer may change/remove this member (admin, not self, not an
  // owner). When false the dialog is read-only.
  editable: boolean;
  onChanged: () => void;
  onRemove: (member: StaffMember) => void;
};

// Admin-facing detail view for a single clinic member: shows who they are, what
// their role lets them do, and (when editable) lets an admin change the role —
// which swaps the whole permission bundle — or remove them.
export function EmployeeDetailDialog({
  member,
  open,
  onOpenChange,
  editable,
  onChanged,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const [role, setRole] = useState<string>(member?.role ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(member?.role ?? "");
  }, [member?.id, member?.role]);

  const summary = rolePermissionSummary(member?.role);
  const secondary = member?.username ? `@${member.username}` : member?.email;
  // Keep the member's current role selectable even if it isn't admin-assignable
  // (e.g. the "member"/Clinician role).
  const roleOptions = Array.from(
    new Set([member?.role, ...PROVISIONABLE_ROLES].filter(Boolean) as string[]),
  );

  const changeRole = async () => {
    if (!member || saving || role === member.role) return;
    setSaving(true);
    const { error } = await authClient.organization.updateMemberRole({
      memberId: member.id,
      role,
    });
    setSaving(false);
    if (error) {
      notify.error(
        t("settings.careTeam.employee.roleFailedTitle"),
        error.message ?? t("settings.careTeam.employee.roleFailedBody"),
      );
      return;
    }
    notify.success(
      t("settings.careTeam.employee.roleUpdatedTitle"),
      t("settings.careTeam.employee.roleUpdatedBody", {
        name: member.name ?? member.email ?? "",
        role: roleLabel(role),
      }),
    );
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.careTeam.employee.title")}</DialogTitle>
          <DialogDescription>
            {t("settings.careTeam.employee.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback>
                {initials(member?.name, member?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {member?.name || member?.email || member?.userId}
              </p>
              {secondary && (
                <p className="truncate text-xs text-muted-foreground">
                  {secondary}
                </p>
              )}
            </div>
            <Badge className="capitalize" variant="secondary">
              {roleLabel(member?.role)}
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("settings.careTeam.employee.permissions")}
            </span>
            <div className="flex flex-col gap-1.5 rounded-2xl border bg-card/30 px-3 py-2.5">
              {summary.map(({ resource, actions }) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={resource}
                >
                  <span className="text-sm text-foreground">
                    {t(`settings.careTeam.employee.resources.${resource}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {actions.length === 0
                      ? t("settings.careTeam.employee.noAccess")
                      : actions
                          .map((a) =>
                            t(`settings.careTeam.employee.actions.${a}`),
                          )
                          .join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {editable && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("settings.careTeam.employee.changeRole")}
              </span>
              <div className="flex items-center gap-2">
                <select
                  aria-label={t("settings.careTeam.employee.changeRole")}
                  className={selectClass}
                  onChange={(e) => setRole(e.target.value)}
                  value={role}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={saving || role === member?.role}
                  onClick={changeRole}
                  type="button"
                >
                  {saving
                    ? t("settings.careTeam.employee.saving")
                    : t("settings.careTeam.employee.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          {editable && member && (
            <Button
              className="sm:mr-auto"
              onClick={() => onRemove(member)}
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-4" />
              {t("settings.careTeam.employee.remove")}
            </Button>
          )}
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("settings.careTeam.employee.close")}
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
