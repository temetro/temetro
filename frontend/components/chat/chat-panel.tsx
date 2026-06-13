"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { nanoid } from "nanoid";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
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
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ActionPreviewCard } from "@/components/chat/action-preview-card";
import { ChatInput } from "@/components/chat/chat-input";
import { ImportPreviewCard } from "@/components/chat/import-preview-card";
import { LabChartCard } from "@/components/chat/lab-chart-card";
import { PatientResult } from "@/components/chat/patient-cards";
import {
  AppointmentListCard,
  PrescriptionListCard,
  TaskListCard,
} from "@/components/chat/record-list-card";
import { VeilConfirmation } from "@/components/chat/veil-confirmation";
import { Badge } from "@/components/ui/badge";
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
  // per session before the first such send — inline (no modal). `pendingConsent`
  // holds the message text waiting on that one-time approval.
  const [consented, setConsented] = useState(false);
  const [pendingConsent, setPendingConsent] = useState<string | null>(null);

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

  // Run the LLM agent for a message (after any Veil gate) on a given model.
  const runAgentWith = useCallback(
    (text: string, modelId: string) => {
      sendMessage({ text }, { body: { model: modelId, effort } });
    },
    [sendMessage, effort],
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

      // Cloud model → inline Veil consent once before sending externally.
      if (isCloudModel && !consented) {
        setPendingConsent(trimmed);
        return;
      }
      runAgentWith(trimmed, model);
    },
    [consented, isCloudModel, model, runAgentWith, setMessages, t],
  );

  // Veil gate actions.
  const confirmConsent = useCallback(() => {
    setConsented(true);
    const text = pendingConsent;
    setPendingConsent(null);
    if (text) runAgentWith(text, model);
  }, [pendingConsent, runAgentWith, model]);

  const useLocalInstead = useCallback(() => {
    setModel("ollama");
    const text = pendingConsent;
    setPendingConsent(null);
    if (text) runAgentWith(text, "ollama");
  }, [pendingConsent, runAgentWith]);

  const cancelConsent = useCallback(() => setPendingConsent(null), []);

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

  const veilGate = pendingConsent ? (
    <VeilConfirmation
      onCancel={cancelConsent}
      onConfirm={confirmConsent}
      onUseLocal={useLocalInstead}
      provider={getModel(model)?.label ?? model}
    />
  ) : null;

  const errorAlert = error ? (
    <div
      className="flex w-full items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-destructive-foreground text-sm"
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

  // Render one assistant/user message: a Chain-of-Thought trace built from any
  // `data-step` parts, then the rest of the parts (text + record cards) in order.
  const renderMessage = (message: TemetroUIMessage, isLast: boolean) => {
    const steps = message.parts.filter((p) => p.type === "data-step");
    const isWorking = status === "submitted" || status === "streaming";
    return (
      <Message from={message.role} key={message.id}>
        <MessageContent className="w-full">
          {steps.length > 0 ? (
            <ChainOfThought
              className="mb-1"
              defaultOpen={isLast && isWorking}
              key={`${message.id}-cot`}
            >
              <ChainOfThoughtHeader>{t("chat.steps")}</ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                {steps.map((part, i) => (
                  <ChainOfThoughtStep
                    key={`${message.id}-step-${i}`}
                    label={part.data.label}
                    status={part.data.status}
                  />
                ))}
              </ChainOfThoughtContent>
            </ChainOfThought>
          ) : null}

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
            if (part.type === "data-actionPreview") {
              return <ActionPreviewCard data={part.data} key={key} />;
            }
            if (part.type === "data-appointmentList") {
              return (
                <AppointmentListCard
                  appointments={part.data.appointments}
                  key={key}
                />
              );
            }
            if (part.type === "data-taskList") {
              return <TaskListCard key={key} tasks={part.data.tasks} />;
            }
            if (part.type === "data-prescriptionList") {
              return (
                <PrescriptionListCard
                  key={key}
                  prescriptions={part.data.prescriptions}
                />
              );
            }
            if (part.type === "data-veilNotice") {
              return (
                <Badge className="gap-1 self-start" key={key} variant="secondary">
                  <ShieldCheck className="size-3" />
                  {t("chat.veil.activeChip", { provider: part.data.provider })}
                </Badge>
              );
            }
            return null;
          })}
        </MessageContent>
      </Message>
    );
  };

  // Show a "Thinking…" shimmer while a request is in flight and the assistant
  // hasn't produced visible prose yet (steps may still be streaming above it).
  const lastMessage = messages[messages.length - 1];
  const lastHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some((p) => p.type === "text" && p.text.trim().length > 0);
  const showThinking =
    (status === "submitted" || status === "streaming") && !lastHasText;

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10">
          <h1 className="text-center font-semibold text-3xl text-balance tracking-tight sm:text-4xl">
            {t("chat.heading")}
          </h1>
          <div className="flex w-full flex-col gap-3">
            {errorAlert}
            {veilGate}
            {promptInput}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message, i) =>
            renderMessage(message, i === messages.length - 1),
          )}
          {showThinking ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Shimmer duration={1}>{t("chat.thinking")}</Shimmer>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-4">
        {errorAlert}
        {veilGate}
        {promptInput}
      </div>
    </div>
  );
}
