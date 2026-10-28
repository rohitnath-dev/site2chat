import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle, RefreshCw, Send, Square } from "lucide-react";
import { api, ApiError, type ChatStage } from "../lib/api";
import { getSessionId, isUuid } from "../lib/utils";
import { Alert } from "../components/ui";
import { useAuth } from "../lib/auth";

interface Msg {
  id: number;
  role: "user" | "bot";
  text: string;
}

interface Failure {
  text: string;
  message: string;
  status: number | null;
  code: string | null;
  /** Partial reply left on screen by an interrupted stream; removed when the user retries. */
  partialId: number | null;
}

// Labels only for stages the backend actually reports. "sending" is the time before the first report.
const STAGE_LABELS: Record<"sending" | ChatStage, string> = {
  sending: "Sending your question…",
  searching: "Searching website content…",
  preparing: "Preparing an answer…",
};
const SLOW_AFTER_MS = 8000;

// Raw HTML is never rendered (react-markdown's default). Images are dropped so a reply can't load remote
// content; links open in a new tab; wide tables scroll inside the bubble instead of widening the page.
const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node: _node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
};

function BotMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
}

export default function Chat() {
  const { chatbotId = "" } = useParams();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const { session } = useAuth();
  const label = (params.get("name") || "").trim().slice(0, 80) || "Website assistant";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [stage, setStage] = useState<"sending" | ChatStage>("sending");
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const validId = isUuid(chatbotId);

  useEffect(() => {
    document.title = `${label} · Site2Chat`;
  }, [label]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: sending ? "auto" : "smooth", block: "end" });
  }, [messages, sending, failure, stage]);

  // Leaving the page cancels the request, which also stops the server from generating further.
  useEffect(() => () => abortRef.current?.abort(), []);

  // If one stage lasts unusually long, say so honestly instead of leaving the same text on screen.
  useEffect(() => {
    setSlow(false);
    if (!sending || streamingId !== null) return;
    const t = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [sending, stage, streamingId]);

  const deliver = useCallback(
    async (text: string, dropId: number | null = null) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      setFailure(null);
      setStage("sending");
      if (dropId !== null) setMessages((m) => m.filter((x) => x.id !== dropId));

      const controller = new AbortController();
      abortRef.current = controller;
      let botId: number | null = null;
      let reply = "";
      let frame = 0;
      const paint = () => {
        frame = 0;
        const shown = reply;
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, text: shown } : x)));
      };

      try {
        await api.streamChat(
          chatbotId,
          text,
          getSessionId(chatbotId),
          {
            onStage: setStage,
            onText: (piece) => {
              reply += piece;
              if (botId === null) {
                // First text: replace the status line with the answer straight away.
                const id = nextId.current++;
                botId = id;
                setMessages((m) => [...m, { id, role: "bot", text: reply }]);
                setStreamingId(id);
              } else if (!frame) {
                frame = window.requestAnimationFrame(paint); // at most one re-render per frame
              }
            },
          },
          controller.signal,
        );
        if (botId === null) throw new ApiError(502, "The chatbot returned an empty reply. Please try again.");
      } catch (err) {
        if (!controller.signal.aborted) {
          setFailure({
            text,
            message: err instanceof Error ? err.message : "Something went wrong.",
            status: err instanceof ApiError ? err.status : null,
            code: err instanceof ApiError ? (err.code ?? null) : null,
            partialId: botId,
          });
        }
      } finally {
        if (frame) window.cancelAnimationFrame(frame);
        if (botId !== null) paint(); // make sure the final text is what is on screen
        abortRef.current = null;
        sendingRef.current = false;
        setStreamingId(null);
        setSending(false);
      }
    },
    [chatbotId],
  );

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sendingRef.current || !validId) return;
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text }]);
    setInput("");
    void deliver(text);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const notReady = failure?.status === 409;
  const notFound = failure?.status === 404;

  return (
    <div className="chat-shell">
      {!embed && (
        <header className="chat-head">
          <span className="brand-mark" aria-hidden="true">
            <MessageCircle size={17} strokeWidth={2.2} />
          </span>
          <h1>{label}</h1>
        </header>
      )}

      <div className="chat-scroll">
        <div className="chat-inner">
          {!validId ? (
            <Alert kind="error">This chat link isn't valid.</Alert>
          ) : (
            <>
              {messages.length === 0 && !failure && (
                <div className="chat-empty">
                  <h2 className="display">Ask me anything</h2>
                  <p>I'm your AI assistant. How can I help?</p>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.role === "user" ? "msg-user" : "msg-bot md"}`}>
                  {m.role === "user" ? m.text : <BotMarkdown text={m.text} />}
                </div>
              ))}

              {sending && streamingId === null && (
                <div className="msg msg-bot msg-status" role="status" aria-live="polite" key={stage}>
                  {STAGE_LABELS[stage]}
                  {slow && <span> This is taking longer than usual.</span>}
                </div>
              )}

              {failure && !sending && (
                <div className="msg-error">
                  <Alert kind={notReady ? "warn" : "error"}>
                    <div>
                      {notReady
                        ? "This chatbot isn't ready yet. Its website is still being set up, so check back soon."
                        : notFound
                          ? "This chatbot could not be found. It may have been removed."
                          : failure.message}
                    </div>
                    {failure.code === "chatbot_unavailable" && session && !embed && (
                      <p style={{ marginTop: 8 }}>
                        Is this your chatbot? <Link to="/settings">Open your AI provider settings</Link> to see how to fix
                        this.
                      </p>
                    )}
                    {!notFound && (
                      <button
                        className="btn btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={() => void deliver(failure.text, failure.partialId)}
                      >
                        <RefreshCw size={14} /> Try again
                      </button>
                    )}
                  </Alert>
                </div>
              )}
            </>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form className="chat-form" onSubmit={submit}>
        <div className="chat-form-inner">
          <label htmlFor="chat-input" className="sr-only">
            Your message
          </label>
          <textarea
            id="chat-input"
            className="textarea"
            rows={1}
            maxLength={4000}
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={!validId}
          />
          {sending ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generating"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!input.trim() || !validId}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>

      <p className="chat-foot">
        <a href={window.location.origin} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
          Create your own chatbot with Site2Chat
        </a>
      </p>
    </div>
  );
}
