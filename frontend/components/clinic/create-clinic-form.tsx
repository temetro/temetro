"use client";

import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/toast";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Shared "create a clinic" form: name + auto-derived slug, creates the org and
// makes it active. Used by both the onboarding page and the sidebar-footer
// clinic menu's "Create clinic" dialog.
export function CreateClinicForm({
  onCreated,
  submitLabel,
}: {
  onCreated?: (org: { id: string; name: string }) => void;
  submitLabel?: string;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const finalSlug = (slugEdited ? slug : slugify(name)) || slugify(name);
    const { data: org, error: createErr } =
      await authClient.organization.create({ name: name.trim(), slug: finalSlug });

    if (createErr || !org) {
      const message = createErr?.message ?? t("clinic.createError");
      setError(message);
      notify.error(t("clinic.createFailedTitle"), message);
      setSubmitting(false);
      return;
    }

    const { error: activeErr } = await authClient.organization.setActive({
      organizationId: org.id,
    });
    if (activeErr) {
      const message = activeErr.message ?? t("clinic.createError");
      setError(message);
      notify.error(t("clinic.createFailedTitle"), message);
      setSubmitting(false);
      return;
    }

    // Refresh the cached session so `activeOrganizationId` is populated before we
    // navigate — otherwise AppAuthGuard still sees no active clinic and bounces
    // straight back to /onboarding.
    await authClient.getSession({ query: { disableCookieCache: true } });

    notify.success(t("clinic.createdTitle"), t("clinic.createdBody", { name: org.name }));
    onCreated?.(org);
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {error && (
        <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label
          className="font-medium text-foreground text-sm"
          htmlFor="clinic-name"
        >
          {t("clinic.nameLabel")}
        </label>
        <Input
          id="clinic-name"
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          placeholder={t("clinic.namePlaceholder")}
          required
          value={name}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          className="font-medium text-foreground text-sm"
          htmlFor="clinic-slug"
        >
          {t("clinic.slugLabel")}
        </label>
        <Input
          id="clinic-slug"
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
          placeholder={t("clinic.slugPlaceholder")}
          required
          value={slug}
        />
        <p className="text-muted-foreground text-xs">{t("clinic.slugHint")}</p>
      </div>
      <Button className="mt-1 w-full" disabled={submitting} type="submit">
        {submitting ? t("clinic.creating") : (submitLabel ?? t("clinic.create"))}
      </Button>
    </form>
  );
}
