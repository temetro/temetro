import Image from "next/image";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// temetro logo + wordmark, centered.
export function AuthBrand() {
  return (
    <div className="flex items-center justify-center gap-3">
      <Image
        alt="temetro"
        className="size-11"
        height={44}
        priority
        src="/temetro-logo.png"
        width={44}
      />
      <span className="text-2xl font-semibold tracking-tight">temetro</span>
    </div>
  );
}

// Centered page wrapper for every auth screen: brand on top, content below.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthBrand />
        {children}
      </div>
    </div>
  );
}

// Card-based shell for the non-block auth pages (onboarding, verify, reset,
// forgot-password, accept-invite).
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
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer && (
        <div className="text-center text-sm text-muted-foreground">{footer}</div>
      )}
    </AuthLayout>
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
