import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import { Alert } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { session, recovery } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && !recovery) {
    return <Navigate to={from && from.startsWith("/") ? from : "/dashboard"} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !supabase) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(
        /not confirmed/i.test(err.message)
          ? "Please confirm your email first. Check your inbox for the confirmation link."
          : /invalid login/i.test(err.message)
            ? "That email and password don't match."
            : err.message,
      );
    }
    // On success the auth listener updates the session and this page redirects.
  };

  return (
    <AuthLayout>
      <h1 className="display">Welcome back</h1>
      <p className="muted" style={{ margin: "6px 0 22px" }}>
        Log in to manage your chatbots.
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="hint" style={{ marginTop: 18, textAlign: "center" }}>
        <Link to="/forgot-password">Forgot password?</Link> · <Link to="/signup">Create account</Link>
      </p>
    </AuthLayout>
  );
}
