"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import {
  createChatSession,
  getChatMessages,
  getChatSessions,
  streamChatMessage,
  ApiError,
} from "@/lib/api";
import type { ChatMessage } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { IconButton } from "@/components/ds/icon-button";
import { cn } from "@/lib/utils";

const QUICK = [
  "Summarize this chapter",
  "Quiz me on this lesson",
  "What should I learn next?",
];

export function AiTutorFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Open AI tutor"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-pill bg-terracotta text-white shadow-card-hover md:bottom-8 md:right-8"
    >
      <MessageCircle className="h-6 w-6" strokeWidth={1.7} />
    </button>
  );
}

export function AiTutorPanel({
  courseId,
  open,
  onClose,
}: {
  courseId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const sessions = await getChatSessions(courseId);
        let sid = sessions[0]?.id;
        if (!sid) {
          const created = await createChatSession(courseId);
          sid = created.id;
        }
        if (cancelled) return;
        setSessionId(sid);
        const msgs = await getChatMessages(sid);
        if (!cancelled) setMessages(msgs);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.detail : "Could not open chat.");
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [open, courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, open]);

  async function send(text: string) {
    if (!sessionId || !text.trim() || streaming) return;
    const content = text.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      },
    ]);
    setStreaming(true);
    setStreamText("");
    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    await streamChatMessage(
      sessionId,
      content,
      {
        onDelta: (d) => {
          acc += d;
          setStreamText(acc);
        },
        onDone: (messageId) => {
          setMessages((prev) => [
            ...prev,
            {
              id: messageId || Date.now() + 1,
              role: "assistant",
              content: acc,
              created_at: new Date().toISOString(),
            },
          ]);
          setStreamText("");
          setStreaming(false);
        },
        onError: (msg) => {
          setError(msg);
          setStreaming(false);
          setStreamText("");
        },
      },
      controller.signal
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-near-black/40 sm:items-stretch">
      <button
        type="button"
        aria-label="Close tutor backdrop"
        className="absolute inset-0 sm:hidden"
        onClick={onClose}
      />
      <div className="relative flex h-[92vh] w-full max-w-md flex-col rounded-t-card-lg bg-white shadow-card-hover sm:h-full sm:rounded-none">
        <div className="mx-auto mt-2 h-1 w-10 rounded-pill bg-border-gray sm:hidden" />
        <div className="flex h-16 items-center justify-between border-b border-border-gray px-4">
          <div>
            <h2 className="text-card-title text-heading">AI Tutor</h2>
            <p className="text-caption text-muted-gray">Grounded in your course</p>
          </div>
          <IconButton aria-label="Close" variant="light" size={44} onClick={onClose}>
            <X className="h-5 w-5" strokeWidth={1.7} />
          </IconButton>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !streaming ? (
            <p className="py-8 text-center text-body text-muted-gray">
              Ask anything about this course — try a quick action below.
            </p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[90%] rounded-card-sm px-3 py-2",
                m.role === "user"
                  ? "ml-auto bg-terracotta text-white"
                  : "bg-light-gray text-heading"
              )}
            >
              {m.role === "assistant" ? (
                <Markdown className="text-body text-heading">{m.content}</Markdown>
              ) : (
                <p className="text-body text-white">{m.content}</p>
              )}
            </div>
          ))}
          {streaming && streamText ? (
            <div className="max-w-[90%] rounded-card-sm bg-light-gray px-3 py-2">
              <Markdown className="text-body text-heading">{streamText}</Markdown>
            </div>
          ) : null}
          {streaming && !streamText ? (
            <div className="flex items-center gap-2 text-caption text-muted-gray">
              <Loader2 className="h-4 w-4 animate-spin text-terracotta" />
              Thinking…
            </div>
          ) : null}
          {error ? <p className="text-caption text-promo">{error}</p> : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border-gray px-4 py-3">
          <div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto">
            {QUICK.map((q) => (
              <button
                key={q}
                disabled={streaming || !sessionId}
                onClick={() => void send(q)}
                className="min-h-11 shrink-0 rounded-pill bg-light-gray px-3 py-2 text-caption text-heading disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the tutor…"
              disabled={streaming || !sessionId}
              className="h-12 flex-1 rounded-pill border border-border-gray bg-off-white px-4 text-body text-heading outline-none focus:border-terracotta disabled:opacity-60"
            />
            <IconButton
              type="submit"
              aria-label="Send"
              variant="terracotta"
              size={48}
              disabled={streaming || !input.trim() || !sessionId}
            >
              <Send className="h-4 w-4" strokeWidth={1.7} />
            </IconButton>
          </form>
        </div>
      </div>
    </div>
  );
}
