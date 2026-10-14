import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import { Alert } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Signup() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [resendLocked, setResendLocked] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  // Must be an allowed Redirect URL in Supabase Auth settings, and a real route in the SPA.
  const confirmUrl = `${window.location.origin}/auth/confirm`;

  const resend = async () => {
    if (resending || resendLocked || !supabase) return;
    setResending(true);
    setResendNote(null);
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: confirmUrl },
    });
    setResending(false);
    if (err) {
      setResendNote({ kind: "error", text: err.message });
      return;
    }
    setResendNote({ kind: "success", text: "Sent. It can take a minute to arrive, so check spam too." });
    setResendLocked(true);
    window.setTimeout(() => setResendLocked(false), 60_000);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !supabase) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: confirmUrl },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Supabase returns an obfuscated user with no identities when the email already exists.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with this email already exists. Try logging in instead.");
      return;
    }
    if (!data.session) setConfirmEmail(true);
    // If a session was returned, the auth listener redirects to the dashboard.
  };

  if (confirmEmail) {
    return (
      <AuthLayout>
        <h1 className="display">Check your email</h1>
        <p className="muted" style={{ margin: "8px 0 20px" }}>
          We sent a confirmation link to <strong>{email.trim()}</strong>. Open it to confirm your email. You'll be
          signed in and taken straight to your Site2Chat dashboard.
        </p>
        {resendNote && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind={resendNote.kind}>{resendNote.text}</Alert>
          </div>
        )}
        <div className="copy-row" style={{ flexWrap: "wrap" }}>
          <button className="btn" onClick={() => void resend()} disabled={resending || resendLocked}>
            {resending ? "Sending…" : "Resend email"}
          </button>
          <Link to="/login" className="btn btn-ghost">
            Go to log in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="display">Create your account</h1>
      <p className="muted" style={{ margin: "6px 0 22px" }}>
        Start turning your website into a chatbot.
      </p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className="hint">At least 8 characters.</span>
        </div>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="hint" style={{ marginTop: 18, textAlign: "center" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
