import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";
import { api, ApiError, type Chatbot, type IngestResult, type Provider } from "../lib/api";
import { chatLink, DEFAULT_GROQ_MODEL, normalizeWebsiteUrl, suggestName } from "../lib/utils";
import { Alert, StatusBadge } from "../components/ui";
import { SharePanel } from "../components/SharePanel";

type Phase = "form" | "running" | "error" | "done";

const STAGES = [
  "Creating chatbot",
  "Connecting to website",
  "Reading available pages",
  "Preparing searchable knowledge",
  "Finishing setup",
];

export default function Create() {
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<Provider>("groq");
  const [model, setModel] = useState("");
  const [orKey, setOrKey] = useState("");
  const [orConfigured, setOrConfigured] = useState<boolean | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [phase, setPhase] = useState<Phase>("form");
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [createdBot, setCreatedBot] = useState<Chatbot | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  // Progress that must survive retries without causing duplicate work.
  const createdRef = useRef<Chatbot | null>(null);
  const llmSavedRef = useRef(false);
  const keySavedRef = useRef(false);
  const runningRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    document.title = "Create chatbot · Site2Chat";
    api
      .getOpenRouterStatus()
      .then(setOrConfigured)
      .catch(() => setOrConfigured(null));
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const onUrlChange = (value: string) => {
    setUrl(value);
    if (!nameTouched) {
      const normalized = normalizeWebsiteUrl(value);
      setName(normalized ? suggestName(normalized) : "");
    }
  };

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!normalizeWebsiteUrl(url)) errs.url = "Enter a valid website address, like https://example.com";
    if (!name.trim()) errs.name = "Give your chatbot a name.";
    else if (name.trim().length > 150) errs.name = "Use 150 characters or fewer.";
    if (description.length > 5000) errs.description = "Use 5000 characters or fewer.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (provider === "openrouter") {
      if (!model.trim()) errs.model = "Enter an OpenRouter model name.";
      if (orConfigured !== true && !keySavedRef.current) {
        const k = orKey.trim();
        if (k.length < 10 || k.length > 500) errs.orKey = "Enter your OpenRouter API key (10–500 characters).";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const run = async () => {
    if (runningRef.current) return; // avoid duplicate submissions
    runningRef.current = true;
    setError(null);
    setErrorStatus(null);
    setPhase("running");
    setStage(0);
    clearTimers();

    const normalizedUrl = normalizeWebsiteUrl(url) as string;
    const llmModel = provider === "groq" ? DEFAULT_GROQ_MODEL : model.trim();

    try {
      if (provider === "openrouter" && orConfigured !== true && !keySavedRef.current) {
        await api.saveOpenRouterKey(orKey.trim());
        keySavedRef.current = true;
        setOrConfigured(true);
        setOrKey(""); // never keep the secret around after saving
      }

      let bot = createdRef.current;
      if (!bot) {
        bot = await api.createChatbot({
          name: name.trim(),
          website_url: normalizedUrl,
          description: description.trim() || undefined,
        });
        createdRef.current = bot;
        setCreatedBot(bot);
      }

      const target: Chatbot = bot; // const keeps the non-null type inside the callbacks below

      if (!llmSavedRef.current) {
        await api.updateLlmSettings(target.id, provider, llmModel);
        llmSavedRef.current = true;
      }

      setStage(1);
      const res = await api.ingest(target.id, (job) => {
        if (job.stage === "discovering") setStage(1);
        else if (job.stage === "crawling") setStage(2);
        else if (job.stage === "embedding") setStage(3);
        else if (job.stage === "persisting") setStage(4);
        else if (job.stage === "completed" || job.status === "completed") setStage(STAGES.length);
      });
      clearTimers();
      setStage(STAGES.length);
      setResult(res);

      // Until the list refresh below confirms it, reflect the ingest outcome: the backend sets
      // "ready" when no pages failed and "partial" otherwise, so the create response's stale
      // "pending" status shouldn't be shown (or used to warn "not ready") after a successful ingest.
      const afterIngest: Chatbot = { ...target, status: res.pages_failed > 0 ? "partial" : "ready" };
      createdRef.current = afterIngest;
      setCreatedBot(afterIngest);

      // Refresh from the list endpoint so the status shown is the real stored one.
      try {
        const fresh = (await api.listChatbots()).find((b) => b.id === target.id);
        if (fresh) {
          createdRef.current = fresh;
          setCreatedBot(fresh);
        }
      } catch {
        /* the dashboard will refetch anyway */
      }
      setPhase("done");
    } catch (err) {
      clearTimers();
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setErrorStatus(err instanceof ApiError ? err.status : null);
      // Before a chatbot exists, return to the form so nothing is lost; afterwards, keep its ID and offer retry.
      setPhase(createdRef.current ? "error" : "form");
    } finally {
      runningRef.current = false;
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }
    if (validateStep2()) void run();
  };

  // ---------- Running ----------
  if (phase === "running") {
    return (
      <div className="page-narrow">
        <div className="card section fade-in" aria-live="polite">
          <h1 className="display" style={{ fontSize: 34 }}>
            Setting up your chatbot
          </h1>
          <p className="muted">
            Large websites can take a few minutes, and if the server has been idle the first step can take up to a
            minute to start. Please keep this tab open.
          </p>
          <ol className="stages">
            {STAGES.map((label, i) => {
              const cls = i < stage ? "done" : i === stage ? "active" : "";
              return (
                <li key={label} className={`stage ${cls}`}>
                  <span className="stage-dot">
                    {i < stage ? <Check size={16} /> : i === stage ? <span className="spinner" /> : <i />}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
          <p className="hint">These steps are a guide to what's happening. We'll show the real results when it finishes.</p>
        </div>
      </div>
    );
  }

  // ---------- Error after the chatbot exists ----------
  if (phase === "error" && createdBot) {
    const interrupted = errorStatus === 0;
    return (
      <div className="page-narrow">
        <div className="card section fade-in">
          <h1 className="display" style={{ fontSize: 34, marginBottom: 12 }}>
            Setup didn't finish
          </h1>
          <div style={{ marginBottom: 14 }}>
            <Alert kind="error">{error}</Alert>
          </div>
          <p className="muted" style={{ marginBottom: 18 }}>
            Your chatbot <strong>{createdBot.name}</strong> has been created, so retrying won't make a duplicate.
            {interrupted && " If the connection dropped, the server may still be working, so check your dashboard before retrying."}
          </p>
          <div className="copy-row" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => void run()}>
              Try again
            </button>
            <Link to="/dashboard" className="btn">
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Done ----------
  if (phase === "done" && result && createdBot) {
    const partial = result.status === "partial" || result.pages_failed > 0;
    return (
      <div className="page-narrow">
        <div className="card section fade-in">
          <div className="bot-title" style={{ marginBottom: 6 }}>
            <h1 className="display" style={{ fontSize: 34 }}>
              {partial ? "Ready, with a few gaps" : "Your chatbot is ready"}
            </h1>
            <StatusBadge status={createdBot.status} />
          </div>
          <p className="muted">{createdBot.name}</p>

          <div className="result-grid">
            <Stat label="Pages found" value={result.pages_discovered} />
            <Stat label="Pages saved" value={result.pages_saved} />
            <Stat label="Chunks saved" value={result.chunks_saved} />
            <Stat label="Pages failed" value={result.pages_failed} />
          </div>

          {partial && (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="warn">
                {result.pages_failed} page{result.pages_failed === 1 ? "" : "s"} couldn't be read, so the chatbot may
                miss some content. It's still usable.
                {result.failures.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Show pages</summary>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, wordBreak: "break-all" }}>
                      {result.failures.slice(0, 10).map((f) => (
                        <li key={f.url}>{f.url}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </Alert>
            </div>
          )}

          <SharePanel chatbotId={createdBot.id} name={createdBot.name} status={createdBot.status} />

          <div className="copy-row" style={{ flexWrap: "wrap" }}>
            <a
              className="btn btn-primary"
              href={chatLink(createdBot.id, createdBot.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} /> Open chat
            </a>
            <Link to="/dashboard" className="btn">
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Form ----------
  return (
    <div className="page-narrow">
      <p className="hint" style={{ marginBottom: 6 }}>
        Step {step} of 2
      </p>
      <h1 className="display" style={{ fontSize: "clamp(32px, 6vw, 44px)", marginBottom: 22 }}>
        {step === 1 ? "Which website?" : "Choose an AI provider"}
      </h1>

      {error && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={submit} noValidate className="fade-in" key={step}>
        {step === 1 ? (
          <>
            <div className="field">
              <label htmlFor="url">Website URL</label>
              <input
                id="url"
                className="input input-lg"
                inputMode="url"
                autoComplete="url"
                autoFocus
                placeholder="https://example.com"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                aria-invalid={!!fieldErrors.url}
                aria-describedby={fieldErrors.url ? "url-err" : undefined}
              />
              {fieldErrors.url && (
                <span id="url-err" className="field-error">
                  {fieldErrors.url}
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="name">Chatbot name</label>
              <input
                id="name"
                className="input"
                value={name}
                maxLength={150}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </div>
            <div className="field">
              <label htmlFor="desc">
                Description <span className="muted">(optional)</span>
              </label>
              <textarea
                id="desc"
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
            </div>
            <button className="btn btn-primary btn-lg" type="submit">
              Continue <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="seg" role="group" aria-label="AI provider">
              <button
                type="button"
                className="seg-opt"
                aria-pressed={provider === "groq"}
                onClick={() => {
                  setProvider("groq");
                  setFieldErrors({});
                }}
              >
                <strong>Groq (default)</strong>
                <span>{DEFAULT_GROQ_MODEL}</span>
              </button>
              <button
                type="button"
                className="seg-opt"
                aria-pressed={provider === "openrouter"}
                aria-expanded={provider === "openrouter"}
                onClick={() => {
                  setProvider("openrouter");
                  setFieldErrors({});
                }}
              >
                <strong>OpenRouter</strong>
                <span>Use your own key and model</span>
              </button>
            </div>

            {provider === "groq" ? (
              <p className="hint" style={{ marginBottom: 20 }}>
                Uses the platform's configured Groq key. Availability and usage limits depend on the server's
                configuration.
              </p>
            ) : (
              <div className="fade-in">
                <div className="field">
                  <label htmlFor="model">OpenRouter model</label>
                  <input
                    id="model"
                    className="input"
                    placeholder="provider/model-name"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={!!fieldErrors.model}
                  />
                  <span className="hint">We can't confirm a model is available until your chatbot uses it.</span>
                  {fieldErrors.model && <span className="field-error">{fieldErrors.model}</span>}
                </div>
                {orConfigured === true || keySavedRef.current ? (
                  <div style={{ marginBottom: 20 }}>
                    <Alert kind="success">Your saved OpenRouter key will be used.</Alert>
                  </div>
                ) : (
                  <div className="field">
                    <label htmlFor="orkey">OpenRouter API key</label>
                    <input
                      id="orkey"
                      className="input"
                      type="password"
                      autoComplete="off"
                      value={orKey}
                      onChange={(e) => setOrKey(e.target.value)}
                      aria-invalid={!!fieldErrors.orKey}
                    />
                    <span className="hint">
                      Stored encrypted on the server and tied to your account. Usage is billed by OpenRouter, not free.
                    </span>
                    {fieldErrors.orKey && <span className="field-error">{fieldErrors.orKey}</span>}
                  </div>
                )}
              </div>
            )}

            <div className="copy-row" style={{ flexWrap: "wrap" }}>
              <button type="button" className="btn btn-lg" onClick={() => setStep(1)}>
                <ArrowLeft size={18} /> Back
              </button>
              <button className="btn btn-primary btn-lg" type="submit">
                Create chatbot
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
