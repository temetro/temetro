"use client";

import { type FormEvent, useState } from "react";

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
  submitLabel = "Create clinic",
}: {
  onCreated?: (org: { id: string; name: string }) => void;
  submitLabel?: string;
}) {
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
      const message = createErr?.message ?? "Could not create the clinic.";
      setError(message);
      notify.error("Couldn't create clinic", message);
      setSubmitting(false);
      return;
    }

    await authClient.organization.setActive({ organizationId: org.id });
    notify.success("Clinic created", `${org.name} is ready.`);
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
          Clinic name
        </label>
        <Input
          id="clinic-name"
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          placeholder="North Side Family Practice"
          required
          value={name}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          className="font-medium text-foreground text-sm"
          htmlFor="clinic-slug"
        >
          Clinic URL slug
        </label>
        <Input
          id="clinic-slug"
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
          placeholder="north-side-family-practice"
          required
          value={slug}
        />
        <p className="text-muted-foreground text-xs">
          Used in links and invitations. Lowercase letters, numbers and dashes.
        </p>
      </div>
      <Button className="mt-1 w-full" disabled={submitting} type="submit">
        {submitting ? "Creating clinic…" : submitLabel}
      </Button>
    </form>
  );
}
