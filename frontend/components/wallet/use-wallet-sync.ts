"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api-client";
import {
  getWalletLink,
  getWalletUpdate,
  pushWalletUpdate,
  type WalletUpdate,
} from "@/lib/wallet-updates";

export type WalletSyncState =
  | "idle"
  | "pending"
  | "approved"
  | "denied"
  | "error";

// Shared wallet-sync logic for create/edit dialogs. It resolves whether the
// selected patient has a linked wallet, then (after the primary save) can push
// the change to their phone and poll until they approve/deny it — the same
// mechanism as the standalone WalletPushDialog, lifted out for reuse.
export function useWalletSync(fileNumber: string | null | undefined) {
  const [linked, setLinked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [state, setState] = useState<WalletSyncState>("idle");
  const [update, setUpdate] = useState<WalletUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve link status whenever the chosen patient changes. A 404 simply means
  // "not wallet-backed", so failures collapse to `linked = false`.
  useEffect(() => {
    if (!fileNumber) {
      setLinked(false);
      return;
    }
    let active = true;
    setChecking(true);
    getWalletLink(fileNumber)
      .then(() => {
        if (active) setLinked(true);
      })
      .catch(() => {
        if (active) setLinked(false);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [fileNumber]);

  // Poll the pushed update until the patient approves/denies it.
  useEffect(() => {
    if (state !== "pending" || !update || update.resolvedAt) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const fresh = await getWalletUpdate(update.id);
        if (!active) return;
        setUpdate(fresh);
        if (fresh.status === "approved") setState("approved");
        else if (fresh.status === "denied") setState("denied");
        if (fresh.resolvedAt) clearInterval(timer);
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [state, update]);

  const push = useCallback(
    async (changes: string[]) => {
      if (!fileNumber) return;
      setError(null);
      setState("pending");
      try {
        const created = await pushWalletUpdate({ fileNumber, changes });
        setUpdate(created);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "generic");
        setState("error");
      }
    },
    [fileNumber],
  );

  const reset = useCallback(() => {
    setState("idle");
    setUpdate(null);
    setError(null);
  }, []);

  return { linked, checking, state, update, error, push, reset };
}

export type UseWalletSync = ReturnType<typeof useWalletSync>;
