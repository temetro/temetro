"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertTriangle } from "lucide-react";
import { nanoid } from "nanoid";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { ChatInput } from "@/components/chat/chat-input";
import { ImportPreviewCard } from "@/components/chat/import-preview-card";
import { LabChartCard } from "@/components/chat/lab-chart-card";
import { PatientResult } from "@/components/chat/patient-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL_ID,
  type Effort,
  getModel,
} from "@/lib/ai-models";
import type { TemetroUIMessage } from "@/lib/ai-chat";
import { getAiConfig } from "@/lib/ai-settings";
import { API_BASE_URL } from "@/lib/api-client";
import { getPatient } from "@/lib/patients";
import { notify } from "@/lib/toast";

// Trigger: `/patient 10293` or just `/10293` — a client-side fast-path that
// pulls records instantly without the LLM (also works offline).
const PATIENT_COMMAND = /^\/(?:patient\s+)?(\d+)$/i;

export function ChatPanel() {
  const { t } = useTranslation();
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);
  const [effort, setEffort] = useState<Effort>(DEFAULT_EFFORT);

  // Veil consent: cloud models de-identify + send data externally. We ask once
  // per session before the first such send.
  const [consented, setConsented] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const pendingSend = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<TemetroUIMessage>({
        api: `${API_BASE_URL}/api/chat`,
        credentials: "include",
      }),
    [],
  );

  const { messages, setMessages, sendMessage, status, stop, error } =
    useChat<TemetroUIMessage>({ transport });

  // Seed the model + effort from the user's saved AI config so the chat uses the
  // provider they actually configured (e.g. their Gemini default), not a stale
  // hardcoded default.
  useEffect(() => {
    let cancelled = false;
    getAiConfig()
      .then((cfg) => {
        if (cancelled) return;
        setModel(cfg.mode === "local" ? "ollama" : cfg.defaultModel);
        setEffort(cfg.defaultEffort);
      })
      .catch(() => {
        // Keep defaults; the chat still works and the backend falls back to any
        // configured provider.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pop a toast whenever a request errors, so failures are never silent.
  useEffect(() => {
    if (error) {
      notify.error(t("chat.error.title"), error.message || t("chat.error.body"));
    }
  }, [error, t]);

  const isCloudModel = (getModel(model)?.provider ?? "ollama") !== "ollama";

  // Run the LLM agent for a message (after any consent gate).
  const runAgent = useCallback(
    (text: string) => {
      sendMessage({ text }, { body: { model, effort } });
    },
    [sendMessage, model, effort],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Fast-path: `/patient <file#>` renders cards directly, no LLM.
      const match = trimmed.match(PATIENT_COMMAND);
      if (match) {
        const fileNumber = match[1];
        const userId = nanoid();
        setMessages((prev) => [
          ...prev,
          { id: userId, role: "user", parts: [{ type: "text", text: trimmed }] },
        ]);
        let patient = null;
        try {
          patient = await getPatient(fileNumber);
        } catch {
          patient = null;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: nanoid(),
            role: "assistant",
            parts: patient
              ? [{ type: "data-patientCard", data: patient }]
              : [
                  {
                    type: "text",
                    text: t("chat.patientNotFound", { fileNumber }),
                  },
                ],
          },
        ]);
        return;
      }

      // Cloud model → ask for Veil consent once before sending externally.
      if (isCloudModel && !consented) {
        pendingSend.current = trimmed;
        setConsentOpen(true);
        return;
      }
      runAgent(trimmed);
    },
    [consented, isCloudModel, runAgent, setMessages, t],
  );

  const confirmConsent = useCallback(() => {
    setConsented(true);
    setConsentOpen(false);
    const text = pendingSend.current;
    pendingSend.current = null;
    if (text) runAgent(text);
  }, [runAgent]);

  // Opening a patient from the Patients page lands here as `/?patient=<file#>`.
  const searchParams = useSearchParams();
  const requestedPatient = searchParams.get("patient");
  const handledPatientRef = useRef<string | null>(null);
  useEffect(() => {
    if (requestedPatient && handledPatientRef.current !== requestedPatient) {
      handledPatientRef.current = requestedPatient;
      send(`/patient ${requestedPatient}`);
    }
  }, [requestedPatient, send]);

  const promptInput = (
    <ChatInput
      effort={effort}
      model={model}
      onEffortChange={setEffort}
      onModelChange={setModel}
      onStop={stop}
      onSubmit={send}
      status={status}
    />
  );

  const errorAlert = error ? (
    <div
      className="flex w-full items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive-foreground"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-medium">{t("chat.error.title")}</p>
        <p className="text-destructive-foreground/90">
          {error.message || t("chat.error.body")}
        </p>
      </div>
    </div>
  ) : null;

  const consentDialog = (
    <Dialog onOpenChange={setConsentOpen} open={consentOpen}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("chat.consent.title")}</DialogTitle>
          <DialogDescription>
            {t("chat.consent.body", {
              provider: getModel(model)?.label ?? model,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <p className="text-sm text-muted-foreground">
            {t("chat.consent.veilNote")}
          </p>
        </DialogPanel>
        <DialogFooter>
          <Button onClick={() => setConsentOpen(false)} variant="outline">
            {t("chat.consent.cancel")}
          </Button>
          <Button onClick={confirmConsent}>{t("chat.consent.confirm")}</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10">
          <h1 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("chat.heading")}
          </h1>
          <div className="flex w-full flex-col gap-3">
            {errorAlert}
            {promptInput}
          </div>
        </div>
        {consentDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent className="w-full">
                {message.parts.map((part, i) => {
                  const key = `${message.id}-${i}`;
                  if (part.type === "text") {
                    return message.role === "user" ? (
                      <span className="whitespace-pre-wrap" key={key}>
                        {part.text}
                      </span>
                    ) : (
                      <MessageResponse key={key}>{part.text}</MessageResponse>
                    );
                  }
                  if (part.type === "data-patientCard") {
                    return (
                      <PatientResult
                        fileNumber={part.data.fileNumber}
                        key={key}
                        patient={part.data}
                        status="ready"
                      />
                    );
                  }
                  if (part.type === "data-labCard") {
                    return <LabChartCard data={part.data} key={key} />;
                  }
                  if (part.type === "data-importPreview") {
                    return <ImportPreviewCard data={part.data} key={key} />;
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-4">
        {errorAlert}
        {promptInput}
      </div>
      {consentDialog}
    </div>
  );
}
