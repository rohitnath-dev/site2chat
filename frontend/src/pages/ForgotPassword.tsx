import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import { Alert } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function ForgotPassword() {
  const { recovery: recoveryFlag, session } = useAuth();
  const recovery = recoveryFlag && !!session; // only offer a new password when the reset link produced a session
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !supabase) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/forgot-password`,
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  const setNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !supabase) return;
    setError(null);
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPassword("");
    navigate("/dashboard", { replace: true });
  };

  if (recovery) {
    return (
      <AuthLayout>
        <h1 className="display">Set a new password</h1>
        <form onSubmit={setNewPassword} noValidate style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="hint">At least 8 characters.</span>
          </div>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="error">{error}</Alert>
            </div>
          )}
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (sent) {
    return (
      <AuthLayout>
        <h1 className="display">Check your email</h1>
        <p className="muted" style={{ margin: "8px 0 20px" }}>
          If an account exists for <strong>{email.trim()}</strong>, a password reset link is on its way.
        </p>
        <Link to="/login" className="btn">
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="display">Reset your password</h1>
      <p className="muted" style={{ margin: "6px 0 22px" }}>
        Enter your email and we'll send you a reset link.
      </p>
      <form onSubmit={requestReset} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="hint" style={{ marginTop: 18, textAlign: "center" }}>
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
