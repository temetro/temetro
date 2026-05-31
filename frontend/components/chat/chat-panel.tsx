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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const HEADING = "What should we build in design-ai?";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");

  // UI-only: append the user's message and a mock assistant reply.
  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: nanoid(), role: "user", text: trimmed },
    ]);
    setStatus("submitted");

    window.setTimeout(() => {
      setStatus("streaming");
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          text: `This is a **UI-only preview** of temetro. Connecting to your records and a model comes next.\n\nYou asked:\n\n> ${trimmed}`,
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
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.role === "assistant" ? (
                  <MessageResponse>{message.text}</MessageResponse>
                ) : (
                  <span className="whitespace-pre-wrap">{message.text}</span>
                )}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">{promptInput}</div>
    </div>
  );
}
