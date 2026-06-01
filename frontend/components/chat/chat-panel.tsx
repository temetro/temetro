"use client";

import { nanoid } from "nanoid";
import type { ChatStatus } from "ai";
import { useCallback, useState } from "react";

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
import { PatientResult } from "@/components/chat/patient-cards";
import { getPatient, type Patient } from "@/lib/patients";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; kind: "text"; text: string }
  | {
      id: string;
      role: "assistant";
      kind: "patient";
      fileNumber: string;
      status: "loading" | "ready" | "not-found";
      patient?: Patient;
    };

const HEADING = "Which patient would you like to look up?";

// Trigger: `/patient 10293` or just `/10293` pulls up records.
const PATIENT_COMMAND = /^\/(?:patient\s+)?(\d+)$/i;

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: nanoid(), role: "user", text: trimmed },
    ]);

    const match = trimmed.match(PATIENT_COMMAND);

    // Patient lookup: append a loading card set, then fill it in once the
    // (mock) record comes back.
    if (match) {
      const fileNumber = match[1];
      const resultId = nanoid();
      setStatus("submitted");
      setMessages((prev) => [
        ...prev,
        {
          id: resultId,
          role: "assistant",
          kind: "patient",
          fileNumber,
          status: "loading",
        },
      ]);

      const patient = await getPatient(fileNumber);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === resultId &&
          message.role === "assistant" &&
          message.kind === "patient"
            ? {
                ...message,
                status: patient ? "ready" : "not-found",
                patient: patient ?? undefined,
              }
            : message
        )
      );
      setStatus("ready");
      return;
    }

    // UI-only: mock assistant reply for anything that isn't a command.
    setStatus("submitted");
    window.setTimeout(() => {
      setStatus("streaming");
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          kind: "text",
          text: `This is a **UI-only preview** of temetro. Try \`/patient 10293\` to pull up a patient's records.\n\nYou asked:\n\n> ${trimmed}`,
        },
      ]);
      window.setTimeout(() => setStatus("ready"), 250);
    }, 500);
  }, []);

  const handleStop = useCallback(() => setStatus("ready"), []);

  const promptInput = (
    <ChatInput onStop={handleStop} onSubmit={send} status={status} />
  );

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10">
          <h1 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {HEADING}
          </h1>
          {promptInput}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message) => {
            if (message.role === "assistant" && message.kind === "patient") {
              return (
                <Message from="assistant" key={message.id}>
                  <MessageContent className="w-full">
                    <PatientResult
                      fileNumber={message.fileNumber}
                      onPatientUpdated={(updated) =>
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === message.id &&
                            m.role === "assistant" &&
                            m.kind === "patient"
                              ? { ...m, patient: updated, status: "ready" }
                              : m
                          )
                        )
                      }
                      patient={message.patient}
                      status={message.status}
                    />
                  </MessageContent>
                </Message>
              );
            }

            return (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.role === "user" ? (
                    <span className="whitespace-pre-wrap">{message.text}</span>
                  ) : (
                    <MessageResponse>{message.text}</MessageResponse>
                  )}
                </MessageContent>
              </Message>
            );
          })}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">{promptInput}</div>
    </div>
  );
}
