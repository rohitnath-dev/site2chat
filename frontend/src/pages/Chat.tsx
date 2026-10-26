import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { MessageCircle, RefreshCw, Send } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { getSessionId, isUuid } from "../lib/utils";
import { Alert } from "../components/ui";

interface Msg {
  id: number;
  role: "user" | "bot";
  text: string;
}

interface Failure {
  text: string;
  message: string;
  status: number | null;
}

export default function Chat() {
  const { chatbotId = "" } = useParams();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const label = (params.get("name") || "").trim().slice(0, 80) || "Website assistant";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const validId = isUuid(chatbotId);

  useEffect(() => {
    document.title = `${label} · Site2Chat`;
  }, [label]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, failure]);

  const deliver = useCallback(
    async (text: string) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      setFailure(null);
      try {
        const res = await api.sendChat(chatbotId, text, getSessionId(chatbotId));
        setMessages((m) => [...m, { id: nextId.current++, role: "bot", text: res.reply }]);
      } catch (err) {
        setFailure({
          text,
          message: err instanceof Error ? err.message : "Something went wrong.",
          status: err instanceof ApiError ? err.status : null,
        });
      } finally {
        sendingRef.current = false;
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
                <div key={m.id} className={`msg ${m.role === "user" ? "msg-user" : "msg-bot"}`}>
                  {m.text}
                </div>
              ))}

              {sending && (
                <div className="msg msg-bot" aria-label="Assistant is typing">
                  <span className="typing">
                    <i />
                    <i />
                    <i />
                  </span>
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
                    {!notFound && (
                      <button
                        className="btn btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={() => void deliver(failure.text)}
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
          <button
            className="btn btn-primary"
            type="submit"
            disabled={sending || !input.trim() || !validId}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
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
