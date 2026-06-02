import { Check } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const FEATURES = [
  "Look up any patient just by asking",
  "Rich record cards — vitals, labs, meds, history",
  "Open-source, built around patient-owned data",
];

// Left brand panel (desktop only): gradient glow, product pitch, feature list.
function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden border-r border-border/60 bg-[oklch(0.17_0.006_277)] p-12 lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/25 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-32 size-[26rem] rounded-full bg-[oklch(0.62_0.15_305)]/20 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at center, black 25%, transparent 75%)",
        }}
      />

      <div className="relative flex items-center gap-2.5">
        <Image
          alt="temetro"
          className="size-8"
          height={32}
          priority
          src="/temetro-logo.png"
          width={32}
        />
        <span className="text-lg font-semibold tracking-tight">temetro</span>
      </div>

      <div className="relative max-w-md space-y-5">
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight">
          Patient records, organized by conversation.
        </h2>
        <p className="text-pretty text-muted-foreground">
          The AI middleman between you and patient data — retrieve, review and
          update charts from a simple chat, so you spend less time clicking.
        </p>
        <ul className="space-y-3 pt-2">
          {FEATURES.map((feature) => (
            <li
              className="flex items-center gap-3 text-sm text-foreground/90"
              key={feature}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3.5" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative text-xs text-muted-foreground">
        © temetro — open-source clinical tooling
      </div>
    </div>
  );
}

// Centered, branded shell shared by every auth page (split layout on desktop).
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <BrandPanel />

      <div className="relative flex items-center justify-center px-6 py-12">
        {/* soft glow behind the form on small screens (no brand panel) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden"
        >
          <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="mb-8">
            <Image
              alt="temetro"
              className="mb-6 size-9 lg:hidden"
              height={36}
              priority
              src="/temetro-logo.png"
              width={36}
            />
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {children}

          {footer && (
            <div className="mt-8 text-sm text-muted-foreground">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-2xl px-3 py-2 text-sm",
        tone === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary"
      )}
    >
      {children}
    </p>
  );
}
