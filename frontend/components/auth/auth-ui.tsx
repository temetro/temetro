"use client";

import { motion, type Variants } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.18 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 150, damping: 18 },
  },
};

// Slowly drifting colored blobs behind everything.
function Aurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.div
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-primary/30 blur-[140px]"
        transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
        className="absolute top-1/4 -right-40 size-[32rem] rounded-full bg-[oklch(0.62_0.16_305)]/25 blur-[140px]"
        transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        className="absolute -bottom-40 left-1/3 size-[30rem] rounded-full bg-[oklch(0.7_0.15_200)]/20 blur-[150px]"
        transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
    </div>
  );
}

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
    <div className="relative flex min-h-full w-full items-center justify-center overflow-hidden px-4 py-12">
      <Aurora />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />

      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        {/* rotating gradient halo */}
        <motion.div
          animate={{ rotate: 360 }}
          aria-hidden
          className="absolute -inset-[2px] rounded-[30px] opacity-70 blur-[3px]"
          style={{
            backgroundImage:
              "conic-gradient(from 0deg, var(--primary), transparent 25%, transparent 50%, oklch(0.62 0.16 305), transparent 75%, var(--primary))",
          }}
          transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />

        {/* the card */}
        <motion.div
          animate="show"
          className="relative overflow-hidden rounded-[28px] border border-white/10 bg-card/85 p-8 shadow-2xl backdrop-blur-xl"
          initial="hidden"
          variants={container}
        >
          {/* top edge highlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
          {/* one-time shimmer sweep on mount */}
          <motion.div
            animate={{ x: "130%" }}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -inset-x-1"
            initial={{ x: "-130%" }}
            style={{
              background:
                "linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.07) 50%, transparent 58%)",
            }}
            transition={{ duration: 1.1, delay: 0.45, ease: "easeInOut" }}
          />

          <motion.div
            className="mb-6 flex flex-col items-center text-center"
            variants={item}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30 ring-inset"
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <Image
                alt="temetro"
                className="size-7"
                height={28}
                priority
                src="/temetro-logo.png"
                width={28}
              />
            </motion.div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </motion.div>

          <motion.div variants={item}>{children}</motion.div>

          {footer && (
            <motion.div
              className="mt-6 text-center text-sm text-muted-foreground"
              variants={item}
            >
              {footer}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
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
