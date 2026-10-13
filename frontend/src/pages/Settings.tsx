import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Alert } from "../components/ui";
import { useToast } from "../components/Toast";

export default function Settings() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Settings · Site2Chat";
    let active = true;
    api
      .getOpenRouterStatus()
      .then((v) => active && setConfigured(v))
      .catch((e) => active && setStatusError(e instanceof Error ? e.message : "Couldn't check your key."));
    return () => {
      active = false;
    };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = key.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setError("Enter your OpenRouter API key (10–500 characters).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.saveOpenRouterKey(trimmed);
      setKey("");
      setConfigured(true);
      setStatusError(null);
      toast.show("OpenRouter key saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the key.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await api.removeOpenRouterKey();
      setConfigured(false);
      toast.show("OpenRouter key removed");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't remove the key", "error");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="page-narrow">
      <h1 className="display" style={{ fontSize: "clamp(32px, 6vw, 44px)", marginBottom: 24 }}>
        Settings
      </h1>

      <section className="card section">
        <h2 className="display">Account</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Signed in as <strong>{session?.user.email ?? "your account"}</strong>
        </p>
        <button
          className="btn"
          onClick={async () => {
            await signOut();
            navigate("/", { replace: true });
          }}
        >
          Sign out
        </button>
      </section>

      <section className="card section">
        <h2 className="display">OpenRouter key</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Add your own key to use OpenRouter models. Usage is billed by OpenRouter. The key is stored encrypted and is
          never shown again.
        </p>

        {statusError && (
          <div style={{ marginBottom: 14 }}>
            <Alert kind="error">{statusError}</Alert>
          </div>
        )}

        {configured && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="success">A key is saved on your account.</Alert>
          </div>
        )}

        <form onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor="or-key">{configured ? "Replace key" : "API key"}</label>
            <input
              id="or-key"
              className="input"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          {error && (
            <div style={{ marginBottom: 14 }}>
              <Alert kind="error">{error}</Alert>
            </div>
          )}
          <div className="copy-row" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : configured ? "Replace key" : "Save key"}
            </button>
            {configured && (
              <button type="button" className="btn" onClick={() => void remove()} disabled={removing}>
                {removing ? "Removing…" : "Remove key"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
