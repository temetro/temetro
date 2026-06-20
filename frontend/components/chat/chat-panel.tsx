"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type FileUIPart,
  type ToolUIPart,
} from "ai";
import { AlertTriangle, Brain, ChevronDown, ShieldCheck, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
} from "@/components/ai-elements/attachments";
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
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  CitedResponse,
  hasCitationMarkers,
  SourcesFooter,
} from "@/components/chat/message-citations";
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
} from "@/components/ai-elements/queue";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { ActionPreviewCard } from "@/components/chat/action-preview-card";
import { AnalyticsCard } from "@/components/chat/analytics-card";
import { BatchActionPreviewCard } from "@/components/chat/batch-action-preview-card";
import { ChatHistoryPanel } from "@/components/chat/chat-history-panel";
import { ChatInput } from "@/components/chat/chat-input";
import { ClinicCard } from "@/components/chat/clinic-card";
import { InventoryListCard } from "@/components/chat/inventory-list-card";
import { ImportPreviewCard } from "@/components/chat/import-preview-card";
import { LabChartCard } from "@/components/chat/lab-chart-card";
import { PatientResult } from "@/components/chat/patient-cards";
import { RecordGraph } from "@/components/graph/record-graph";
import {
  AppointmentListCard,
  PrescriptionListCard,
  TaskListCard,
} from "@/components/chat/record-list-card";
import { VeilConfirmation } from "@/components/chat/veil-confirmation";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL_ID,
  type Effort,
  getModel,
} from "@/lib/ai-models";
import { type ChatMode, DEFAULT_MODE } from "@/lib/chat-modes";
import type { ActionPreviewData, TemetroUIMessage } from "@/lib/ai-chat";
import {
  getThread,
  notifyThreadsChanged,
  saveThread,
} from "@/lib/ai-chat-history";
import { getAiConfig } from "@/lib/ai-settings";
import { API_BASE_URL } from "@/lib/api-client";
import { getPatient } from "@/lib/patients";

// Trigger: `/patient 10293` or just `/10293` — a client-side fast-path that
// pulls records instantly without the LLM (also works offline).
const PATIENT_COMMAND = /^\/(?:patient\s+)?(\d+)$/i;

// Read a File into a FileUIPart (data URL). The backend extracts text-like
// content for the model; images/PDFs are read directly by vision providers.
function fileToPart(file: File): Promise<FileUIPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        type: "file",
        mediaType: file.type || "application/octet-stream",
        filename: file.name,
        url: reader.result as string,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ChatPanel() {
  const { t } = useTranslation();
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);
  const [effort, setEffort] = useState<Effort>(DEFAULT_EFFORT);
  // The clinician-facing "situation" mode (Chat / Analysis / Graph). The model
  // itself comes from Settings → AI; this shapes what the assistant does.
  const [mode, setMode] = useState<ChatMode>(DEFAULT_MODE);

  // Veil consent: cloud models de-identify + send data externally. We ask once
  // per session before the first such send — inline (no modal). `pendingConsent`
  // holds the message text waiting on that one-time approval.
  const [consented, setConsented] = useState(false);
  const [pendingConsent, setPendingConsent] = useState<{
    text: string;
    files: File[];
  } | null>(null);

  // Claude-style message queue: messages submitted while the assistant is busy
  // (or waiting on the Veil gate) wait here and auto-send when it goes idle.
  const [queued, setQueued] = useState<{ text: string; files: File[] }[]>([]);

  // Persisted conversation: a client-owned thread id (a fresh one per new chat),
  // saved to the server after each exchange so history survives reloads.
  const [threadId, setThreadId] = useState<string>(() => nanoid());
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;
  // Skip the auto-save that would otherwise fire right after loading a thread
  // (which would needlessly bump it to the top of the history).
  const justLoadedRef = useRef(false);

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

  // Mark a proposal/import card as committed or discarded by stamping the data
  // part, so it persists through re-render and conversation reload (and can't be
  // submitted twice). `partIndex < 0` marks every action-preview part in the
  // message (used by the batched card).
  const resolveProposal = useCallback(
    (messageId: string, partIndex: number, resolution: "added" | "discarded") => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const parts = m.parts.map((p, idx) => {
            const isTarget =
              partIndex < 0 ? p.type === "data-actionPreview" : idx === partIndex;
            if (!isTarget) return p;
            const data = (p as { data?: Record<string, unknown> }).data;
            return data ? { ...p, data: { ...data, resolved: resolution } } : p;
          }) as typeof m.parts;
          return { ...m, parts };
        }),
      );
    },
    [setMessages],
  );

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

  // Surface errors inline (and dismissible) instead of as a toast, so a failure
  // stays visible until acknowledged and isn't duplicated. Reset the dismissed
  // flag whenever a fresh error arrives.
  const [errorDismissed, setErrorDismissed] = useState(false);
  useEffect(() => {
    if (error) setErrorDismissed(false);
  }, [error]);

  const isCloudModel = (getModel(model)?.provider ?? "ollama") !== "ollama";

  // Run the LLM agent for a message (after any Veil gate) on a given model.
  const runAgentWith = useCallback(
    async (text: string, modelId: string, files: File[] = []) => {
      const fileParts = await Promise.all(files.map(fileToPart));
      sendMessage(
        { text, files: fileParts },
        { body: { model: modelId, effort, mode, threadId: threadIdRef.current } },
      );
    },
    [sendMessage, effort, mode],
  );

  const send = useCallback(
    async (text: string, files: File[] = []) => {
      const trimmed = text.trim();
      if (!trimmed && files.length === 0) return;

      // Busy or awaiting the Veil gate → queue and auto-send when idle.
      if (status === "submitted" || status === "streaming" || pendingConsent) {
        setQueued((q) => [...q, { text: trimmed, files }]);
        return;
      }

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
              ? [
                  mode === "graph"
                    ? { type: "data-recordGraph", data: patient }
                    : { type: "data-patientCard", data: patient },
                ]
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
        setPendingConsent({ text: trimmed, files });
        return;
      }
      void runAgentWith(trimmed, model, files);
    },
    [
      consented,
      isCloudModel,
      mode,
      model,
      pendingConsent,
      runAgentWith,
      setMessages,
      status,
      t,
    ],
  );

  // Drain the queue one message at a time whenever the chat returns to idle.
  useEffect(() => {
    if (status !== "ready" || pendingConsent || queued.length === 0) return;
    const [next, ...rest] = queued;
    setQueued(rest);
    if (next) void send(next.text, next.files);
  }, [status, pendingConsent, queued, send]);

  // Veil gate actions.
  const confirmConsent = useCallback(() => {
    setConsented(true);
    const pending = pendingConsent;
    setPendingConsent(null);
    if (pending) void runAgentWith(pending.text, model, pending.files);
  }, [pendingConsent, runAgentWith, model]);

  const useLocalInstead = useCallback(() => {
    setModel("ollama");
    const pending = pendingConsent;
    setPendingConsent(null);
    if (pending) void runAgentWith(pending.text, "ollama", pending.files);
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

  // Open a saved thread from `/?thread=<id>` (sidebar history); a bare `/` starts
  // a fresh chat. Driven by the URL so the sidebar links and "New chat" work.
  const requestedThread = searchParams.get("thread");
  useEffect(() => {
    if (requestedThread) {
      if (requestedThread === threadIdRef.current) return; // already open
      let active = true;
      getThread(requestedThread)
        .then((thread) => {
          if (!active) return;
          justLoadedRef.current = true;
          setThreadId(thread.id);
          setMessages(
            thread.messages.map(
              (m) =>
                ({
                  id: nanoid(),
                  role: m.role,
                  parts: m.parts,
                }) as TemetroUIMessage,
            ),
          );
        })
        .catch(() => {
          /* missing/forbidden thread → leave the current chat as-is */
        });
      return () => {
        active = false;
      };
    }
    // No ?thread → fresh chat (e.g. after "New chat").
    setThreadId(nanoid());
    setMessages([]);
  }, [requestedThread, setMessages]);

  // Auto-save the conversation a moment after it settles (covers both LLM and
  // the `/patient` fast path). Skips the redundant save right after a load.
  useEffect(() => {
    if (messages.length === 0) return;
    if (status === "submitted" || status === "streaming") return;
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    const id = setTimeout(() => {
      const firstUser = messages.find((m) => m.role === "user");
      const textPart = firstUser?.parts.find((p) => p.type === "text") as
        | { text?: string }
        | undefined;
      const title =
        (textPart?.text ?? "").trim().slice(0, 60) ||
        t("chat.history.untitled");
      saveThread(threadIdRef.current, messages, title)
        .then(notifyThreadsChanged)
        .catch(() => {
          /* a failed save shouldn't disrupt the chat */
        });
    }, 800);
    return () => clearTimeout(id);
  }, [messages, status, t]);

  const promptInput = (
    <ChatInput
      mode={mode}
      onModeChange={setMode}
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

  const errorAlert =
    error && !errorDismissed ? (
      <div
        className="flex w-full items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-destructive-foreground text-sm"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="flex-1 space-y-0.5">
          <p className="font-medium">{t("chat.error.title")}</p>
          <p className="text-destructive-foreground/90">
            {error.message || t("chat.error.body")}
          </p>
        </div>
        <button
          aria-label={t("chat.error.dismiss")}
          className="-mr-1 shrink-0 rounded-md p-1 text-destructive-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive-foreground"
          onClick={() => setErrorDismissed(true)}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
    ) : null;

  // Starter prompts shown on the empty state, each tied to an existing tool.
  const suggestions = [
    t("chat.suggestions.schedule"),
    t("chat.suggestions.tasks"),
    t("chat.suggestions.prescriptions"),
    t("chat.suggestions.import"),
  ];

  const queuePanel =
    queued.length > 0 ? (
      <Queue>
        <span className="px-1 text-muted-foreground text-xs">
          {t("chat.queue.label", { count: queued.length })}
        </span>
        <QueueList>
          {queued.map((q, i) => (
            <QueueItem key={`${i}-${q.text}`}>
              <div className="flex items-center gap-2">
                <QueueItemIndicator />
                <QueueItemContent>
                  {q.text ||
                    t("chat.queue.attachmentsOnly", { count: q.files.length })}
                </QueueItemContent>
                <QueueItemActions>
                  <QueueItemAction
                    aria-label={t("chat.queue.remove")}
                    onClick={() =>
                      setQueued((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <X className="size-3.5" />
                  </QueueItemAction>
                </QueueItemActions>
              </div>
            </QueueItem>
          ))}
        </QueueList>
      </Queue>
    ) : null;

  // Veil runs once per conversation, so the "Veil active" chip should only show
  // on the first assistant message that carries a veilNotice — not every turn.
  const firstVeilMessageId = messages.find((m) =>
    m.parts.some((p) => p.type === "data-veilNotice"),
  )?.id;

  // Render one assistant/user message: a Chain-of-Thought trace built from any
  // `data-step` parts, then the rest of the parts (text + record cards) in order.
  const renderMessage = (message: TemetroUIMessage, isLast: boolean) => {
    const steps = message.parts.filter((p) => p.type === "data-step");
    const isWorking = status === "submitted" || status === "streaming";
    // When the agent proposes many records at once (e.g. an imported file),
    // collapse them into one batched approval instead of a card per record.
    const actionPreviews = message.parts.filter(
      (p) => p.type === "data-actionPreview",
    );
    const firstActionPreviewIdx = message.parts.findIndex(
      (p) => p.type === "data-actionPreview",
    );
    // Attachments the clinician uploaded — rendered once as a chip group.
    const fileParts = message.parts.filter((p) => p.type === "file");
    const firstFileIdx = message.parts.findIndex((p) => p.type === "file");
    // Citable sources the agent retrieved for this message; the model references
    // them inline via [[src:id]] markers (rendered as chips). When it emits no
    // markers, a sources footer still attributes the retrieved records.
    const sources = message.parts
      .filter((p) => p.type === "data-source")
      .map((p) => p.data);
    const hasInlineCitations = message.parts.some(
      (p) => p.type === "text" && hasCitationMarkers(p.text),
    );
    return (
      <Message from={message.role} key={message.id}>
        <MessageContent className="w-full">
          {steps.length > 0 ? (
            <ChainOfThought
              className="mb-1"
              defaultOpen={false}
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
            if (part.type === "reasoning") {
              return (
                <Collapsible className="w-full" key={key}>
                  <CollapsibleTrigger className="group flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
                    <Brain className="size-4" />
                    {isWorking && isLast ? (
                      <Shimmer duration={1}>{t("chat.reasoning")}</Shimmer>
                    ) : (
                      t("chat.reasoning")
                    )}
                    <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                    {part.text}
                  </CollapsibleContent>
                </Collapsible>
              );
            }
            if (part.type.startsWith("tool-")) {
              const tp = part as ToolUIPart;
              return (
                <Tool key={key}>
                  <ToolHeader state={tp.state} type={tp.type} />
                  <ToolContent>
                    <ToolInput input={tp.input} />
                    <ToolOutput errorText={tp.errorText} output={tp.output} />
                  </ToolContent>
                </Tool>
              );
            }
            if (part.type === "text") {
              return message.role === "user" ? (
                <span className="whitespace-pre-wrap" key={key}>
                  {part.text}
                </span>
              ) : (
                <CitedResponse key={key} sources={sources} text={part.text} />
              );
            }
            if (part.type === "file") {
              // Render the whole message's files as one chip group, once.
              if (i !== firstFileIdx) return null;
              return (
                <Attachments className="w-full" key={key} variant="inline">
                  {fileParts.map((fp, fi) => (
                    <Attachment
                      data={{
                        ...(fp as FileUIPart),
                        id: `${message.id}-file-${fi}`,
                      }}
                      key={`${message.id}-file-${fi}`}
                    >
                      <AttachmentPreview />
                      <AttachmentInfo />
                    </Attachment>
                  ))}
                </Attachments>
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
            if (part.type === "data-recordGraph") {
              return (
                <div
                  className="w-full overflow-hidden rounded-2xl border bg-card/30"
                  key={key}
                >
                  <div className="flex items-center justify-between gap-2 px-4 pt-3">
                    <span className="font-medium text-foreground text-sm">
                      {part.data.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("chat.graphCard.label")}
                    </span>
                  </div>
                  <div className="p-3">
                    <RecordGraph patient={part.data} />
                  </div>
                </div>
              );
            }
            if (part.type === "data-labCard") {
              return <LabChartCard data={part.data} key={key} />;
            }
            if (part.type === "data-importPreview") {
              return (
                <ImportPreviewCard
                  data={part.data}
                  key={key}
                  onResolved={(r) => resolveProposal(message.id, i, r)}
                />
              );
            }
            if (part.type === "data-actionPreview") {
              if (actionPreviews.length >= 2) {
                // Render the batch once (at the first proposal), skip the rest.
                if (i !== firstActionPreviewIdx) return null;
                return (
                  <BatchActionPreviewCard
                    items={actionPreviews.map(
                      (p) => (p as { data: ActionPreviewData }).data,
                    )}
                    key={key}
                    // -1 marks every action-preview part in this message.
                    onResolved={(r) => resolveProposal(message.id, -1, r)}
                  />
                );
              }
              return (
                <ActionPreviewCard
                  data={part.data}
                  key={key}
                  onResolved={(r) => resolveProposal(message.id, i, r)}
                />
              );
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
            if (part.type === "data-inventoryList") {
              return <InventoryListCard items={part.data.items} key={key} />;
            }
            if (part.type === "data-clinicCard") {
              return <ClinicCard data={part.data} key={key} />;
            }
            if (part.type === "data-analyticsCard") {
              return <AnalyticsCard data={part.data} key={key} />;
            }
            if (part.type === "data-veilNotice") {
              // Only the first veilNotice in the whole conversation renders.
              if (message.id !== firstVeilMessageId) return null;
              return (
                <Badge className="gap-1 self-start" key={key} variant="secondary">
                  <ShieldCheck className="size-3" />
                  {t("chat.veil.activeChip", { provider: part.data.provider })}
                </Badge>
              );
            }
            return null;
          })}

          {/* Provenance footer: shown when the model cited records but placed no
              inline markers, so retrieved sources are always attributed. */}
          {sources.length > 0 && !hasInlineCitations && (
            <SourcesFooter sources={sources} />
          )}
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
      <div className="relative flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center px-4 pt-3">
          <ChatHistoryPanel />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-3xl shrink-0 flex-col items-center gap-10">
          <h1 className="text-center font-semibold text-3xl text-balance tracking-tight sm:text-4xl">
            {t("chat.heading")}
          </h1>
          <div className="flex w-full flex-col gap-3">
            {errorAlert}
            {veilGate}
            {promptInput}
            <Suggestions className="justify-center pt-1">
              {suggestions.map((s) => (
                <Suggestion key={s} onClick={send} suggestion={s} />
              ))}
            </Suggestions>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center px-4 pt-3">
        <ChatHistoryPanel />
      </div>
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
        {queuePanel}
        {promptInput}
      </div>
    </div>
  );
}
