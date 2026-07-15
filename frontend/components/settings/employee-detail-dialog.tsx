"use client";

import {
  CalendarDays,
  FlaskConical,
  ListChecks,
  Pill,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { PROVISIONABLE_ROLES, rolePermissionSummary } from "@/lib/roles";
import {
  SPECIALTIES,
  setStaffPassword,
  specialtyLabel,
  updateStaffSpecialty,
} from "@/lib/staff";
import { notify } from "@/lib/toast";

// Roles that can carry a clinical specialty (i.e. treat patients).
const PROVIDER_ROLES = new Set(["owner", "admin", "doctor", "member"]);

// Icon shown next to each permission resource row.
const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  patient: <Users className="size-4" />,
  appointment: <CalendarDays className="size-4" />,
  prescription: <Pill className="size-4" />,
  task: <ListChecks className="size-4" />,
  lab: <FlaskConical className="size-4" />,
};

// One row of /api/staff — shared with the Care Team panel.
export type StaffMember = {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  username: string | null;
  specialty: string | null;
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
  const [specialty, setSpecialty] = useState<string>(member?.specialty ?? "");
  const [savingSpecialty, setSavingSpecialty] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // Re-seed when a different member (or their role/specialty) is shown, and
  // always clear the password fields so they can't carry across. Adjusted
  // during render rather than in an effect, so the dialog never paints another
  // member's values — and a typed password never survives a switch.
  const seed = `${member?.id ?? ""}|${member?.role ?? ""}|${member?.specialty ?? ""}`;
  const [prevSeed, setPrevSeed] = useState(seed);
  if (prevSeed !== seed) {
    setPrevSeed(seed);
    setRole(member?.role ?? "");
    setSpecialty(member?.specialty ?? "");
    setNewPw("");
    setConfirmPw("");
  }

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

  const saveSpecialty = async () => {
    if (!member || savingSpecialty) return;
    const next = specialty || null;
    if (next === (member.specialty ?? null)) return;
    setSavingSpecialty(true);
    try {
      await updateStaffSpecialty(member.userId, next);
      notify.success(
        t("settings.careTeam.employee.specialtyUpdatedTitle"),
        t("settings.careTeam.employee.specialtyUpdatedBody", {
          name: member.name ?? member.email ?? "",
        }),
      );
      onChanged();
    } catch {
      notify.error(
        t("settings.careTeam.employee.specialtyFailedTitle"),
        t("settings.careTeam.employee.specialtyFailedBody"),
      );
    } finally {
      setSavingSpecialty(false);
    }
  };

  const resetPassword = async () => {
    if (!member || savingPw) return;
    if (newPw.length < 12) {
      notify.error(
        t("settings.careTeam.employee.pwTooShortTitle"),
        t("settings.careTeam.employee.pwTooShortBody"),
      );
      return;
    }
    if (newPw !== confirmPw) {
      notify.error(
        t("settings.careTeam.employee.pwMismatchTitle"),
        t("settings.careTeam.employee.pwMismatchBody"),
      );
      return;
    }
    setSavingPw(true);
    try {
      await setStaffPassword(member.userId, newPw);
      notify.success(
        t("settings.careTeam.employee.pwUpdatedTitle"),
        t("settings.careTeam.employee.pwUpdatedBody", {
          name: member.name ?? member.email ?? "",
        }),
      );
      setNewPw("");
      setConfirmPw("");
    } catch {
      notify.error(
        t("settings.careTeam.employee.pwFailedTitle"),
        t("settings.careTeam.employee.pwFailedBody"),
      );
    } finally {
      setSavingPw(false);
    }
  };

  const showSpecialty = PROVIDER_ROLES.has(member?.role ?? "");
  const specialtyOptions = [
    { value: "", label: t("settings.careTeam.employee.noSpecialty") },
    ...SPECIALTIES.map((s) => ({
      value: s,
      label: t(`settings.careTeam.specialties.${s}`),
    })),
  ];

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
          <div className="flex items-center gap-4 rounded-2xl border bg-card/30 p-4">
            <Avatar className="size-12 rounded-xl">
              <AvatarFallback className="rounded-xl bg-muted text-base font-medium">
                {initials(member?.name, member?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold tracking-tight">
                {member?.name || member?.email || member?.userId}
              </p>
              {secondary && (
                <p className="truncate text-sm text-muted-foreground">
                  {secondary}
                </p>
              )}
              {showSpecialty && specialtyLabel(t, member?.specialty) && (
                <p className="truncate text-primary text-xs">
                  {specialtyLabel(t, member?.specialty)}
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
            <div className="divide-y divide-border rounded-2xl border bg-card/30">
              {summary.map(({ resource, actions }) => (
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                  key={resource}
                >
                  <span className="flex items-center gap-2.5 text-sm text-foreground">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {RESOURCE_ICONS[resource]}
                    </span>
                    {t(`settings.careTeam.employee.resources.${resource}`)}
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {actions.length === 0 ? (
                      <Badge
                        className="text-muted-foreground"
                        variant="outline"
                      >
                        {t("settings.careTeam.employee.noAccess")}
                      </Badge>
                    ) : (
                      actions.map((a) => (
                        <Badge key={a} variant="secondary">
                          {t(`settings.careTeam.employee.actions.${a}`)}
                        </Badge>
                      ))
                    )}
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
                <Select
                  items={roleOptions.map((r) => ({
                    value: r,
                    label: roleLabel(r),
                  }))}
                  onValueChange={(value) => setRole(value as string)}
                  value={role}
                >
                  <SelectTrigger
                    aria-label={t("settings.careTeam.employee.changeRole")}
                    className="flex-1"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
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

          {editable && showSpecialty && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("settings.careTeam.employee.specialty")}
              </span>
              <div className="flex items-center gap-2">
                <Select
                  items={specialtyOptions}
                  onValueChange={(value) => setSpecialty(value as string)}
                  value={specialty}
                >
                  <SelectTrigger
                    aria-label={t("settings.careTeam.employee.specialty")}
                    className="flex-1"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {specialtyOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <Button
                  disabled={
                    savingSpecialty ||
                    (specialty || null) === (member?.specialty ?? null)
                  }
                  onClick={saveSpecialty}
                  type="button"
                >
                  {savingSpecialty
                    ? t("settings.careTeam.employee.saving")
                    : t("settings.careTeam.employee.save")}
                </Button>
              </div>
            </div>
          )}

          {editable && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("settings.careTeam.employee.resetPassword")}
              </span>
              <p className="text-muted-foreground text-xs">
                {t("settings.careTeam.employee.resetPasswordHint")}
              </p>
              <Input
                autoComplete="new-password"
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={t("settings.careTeam.employee.newPassword")}
                type="password"
                value={newPw}
              />
              <div className="flex items-center gap-2">
                <Input
                  autoComplete="new-password"
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder={t("settings.careTeam.employee.confirmPassword")}
                  type="password"
                  value={confirmPw}
                />
                <Button
                  disabled={savingPw || !newPw || !confirmPw}
                  onClick={resetPassword}
                  type="button"
                >
                  {savingPw
                    ? t("settings.careTeam.employee.saving")
                    : t("settings.careTeam.employee.setPassword")}
                </Button>
              </div>
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          {editable && member && (
            <Button
              className="sm:me-auto"
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
