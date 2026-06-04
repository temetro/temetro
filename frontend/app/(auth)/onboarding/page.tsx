"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
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

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Send unauthenticated users to login. Authenticated users (whether brand
  // new or creating an additional clinic) stay on this page.
  useEffect(() => {
    if (isPending) return;
    if (!session?.user) router.replace("/login");
  }, [session, isPending, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const finalSlug = (slugEdited ? slug : slugify(name)) || slugify(name);
    const { data: org, error: createErr } = await authClient.organization.create(
      { name: name.trim(), slug: finalSlug }
    );

    if (createErr || !org) {
      const message = createErr?.message ?? "Could not create the clinic.";
      setError(message);
      notify.error("Couldn't create clinic", message);
      setSubmitting(false);
      return;
    }

    await authClient.organization.setActive({ organizationId: org.id });
    notify.success("Clinic created", `${org.name} is ready.`);
    router.push("/");
  };

  return (
    <AuthShell
      subtitle="Create your clinic to start organizing patient records"
      title="Set up your clinic"
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error && <FormAlert>{error}</FormAlert>}
        <Field htmlFor="name" label="Clinic name">
          <Input
            id="name"
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            placeholder="North Side Family Practice"
            required
            value={name}
          />
        </Field>
        <Field
          hint="Used in links and invitations. Lowercase letters, numbers and dashes."
          htmlFor="slug"
          label="Clinic URL slug"
        >
          <Input
            id="slug"
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="north-side-family-practice"
            required
            value={slug}
          />
        </Field>
        <Button className="mt-1 w-full" disabled={submitting} type="submit">
          {submitting ? "Creating clinic…" : "Create clinic"}
        </Button>
      </form>
    </AuthShell>
  );
}
