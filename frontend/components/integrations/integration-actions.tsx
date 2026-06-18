"use client";

import { FileCheck, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  getIntegration,
  sendEprescription,
  submitInsuranceClaim,
} from "@/lib/integrations";
import { notify } from "@/lib/toast";

// Renders only when the e-prescribing integration is enabled. Transmits the
// prescription as an NCPDP SCRIPT NewRx to the configured pharmacy gateway.
export function SendToPharmacyButton({ rxId }: { rxId: string }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getIntegration("eprescribe").then(
      (c) => active && setEnabled(Boolean(c?.enabled)),
    );
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  const send = async () => {
    setSending(true);
    try {
      await sendEprescription(rxId);
      notify.success(
        t("integrations.eRx.sentTitle"),
        t("integrations.eRx.sentBody"),
      );
    } catch (err) {
      notify.error(
        t("integrations.eRx.failedTitle"),
        err instanceof ApiError ? err.message : t("integrations.eRx.failedBody"),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Button disabled={sending} onClick={send} type="button">
      <Send className="size-4" />
      {sending ? t("integrations.eRx.sending") : t("integrations.eRx.send")}
    </Button>
  );
}

// Renders only when the claims integration is enabled. Submits an X12 837P claim
// for the invoice to the configured clearinghouse and reports the remittance.
export function SubmitClaimButton({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getIntegration("claims").then(
      (c) => active && setEnabled(Boolean(c?.enabled)),
    );
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await submitInsuranceClaim(invoiceId);
      notify.success(
        t("integrations.claims.submittedTitle"),
        t("integrations.claims.submittedBody", {
          status: result.claimStatus,
        }),
      );
    } catch (err) {
      notify.error(
        t("integrations.claims.failedTitle"),
        err instanceof ApiError
          ? err.message
          : t("integrations.claims.failedBody"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      disabled={submitting}
      onClick={submit}
      type="button"
      variant="outline"
    >
      <FileCheck className="size-4" />
      {submitting
        ? t("integrations.claims.submitting")
        : t("integrations.claims.submit")}
    </Button>
  );
}
