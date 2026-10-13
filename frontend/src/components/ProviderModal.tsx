import { useEffect, useState, type FormEvent } from "react";
import { api, type Chatbot, type Provider } from "../lib/api";
import { DEFAULT_GROQ_MODEL } from "../lib/utils";
import { Alert, Modal } from "./ui";
import { useToast } from "./Toast";
import { Link } from "react-router-dom";

export function ProviderModal({ bot, onClose }: { bot: Chatbot; onClose: () => void }) {
  const toast = useToast();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [model, setModel] = useState("");
  const [orConfigured, setOrConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getOpenRouterStatus()
      .then((v) => active && setOrConfigured(v))
      .catch(() => active && setOrConfigured(null));
    return () => {
      active = false;
    };
  }, []);

  const choose = (p: Provider) => {
    setProvider(p);
    setError(null);
    setModel(p === "groq" ? DEFAULT_GROQ_MODEL : "");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !provider) return;
    const trimmed = model.trim();
    if (!trimmed) {
      setError("Enter a model name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateLlmSettings(bot.id, provider, trimmed);
      toast.show("AI provider updated");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings.");
      setSaving(false);
    }
  };

  return (
    <Modal title="AI provider" onClose={onClose}>
      <p className="muted" style={{ marginBottom: 16 }}>
        The current provider for <strong>{bot.name}</strong> isn't shown here, so choose one to change it.
      </p>
      <form onSubmit={submit} noValidate>
        <div className="seg" role="group" aria-label="Provider">
          <button type="button" className="seg-opt" aria-pressed={provider === "groq"} onClick={() => choose("groq")}>
            <strong>Groq</strong>
            <span>Uses the platform's Groq key</span>
          </button>
          <button
            type="button"
            className="seg-opt"
            aria-pressed={provider === "openrouter"}
            onClick={() => choose("openrouter")}
          >
            <strong>OpenRouter</strong>
            <span>Uses your own key</span>
          </button>
        </div>

        {provider && (
          <div className="field">
            <label htmlFor="pm-model">Model</label>
            <input
              id="pm-model"
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === "groq" ? DEFAULT_GROQ_MODEL : "provider/model-name"}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="hint">We don't check that a model name is available until the chatbot uses it.</span>
          </div>
        )}

        {provider === "openrouter" && orConfigured === false && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="warn">
              No OpenRouter key is saved yet. Add one in <Link to="/settings">Settings</Link> or chat replies will fail.
              OpenRouter usage is billed by OpenRouter.
            </Alert>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        <div className="copy-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !provider}>
            {saving ? "Saving…" : "Save provider"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
