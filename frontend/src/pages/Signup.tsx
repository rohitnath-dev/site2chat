import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Mail } from "lucide-react";
import AuthLayout from "../layouts/AuthLayout";
import { Alert } from "../components/ui";
import { ResendConfirmation } from "../components/ResendConfirmation";
import { supabase } from "../lib/supabase";
import { classifySignUp, describeAuthError } from "../lib/authErrors";
import { useAuth } from "../lib/auth";

export default function Signup() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [resumed, setResumed] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !supabase) return;
    setError(null);
    setExisting(false);
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
      // Must be an allowed Redirect URL in Supabase Auth settings, and a real route in the SPA.
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (err) {
      setError(describeAuthError(err));
      return;
    }
    // A session means no confirmation was required; the auth listener redirects to the dashboard.
    if (data.session) return;

    const outcome = classifySignUp(data.user);
    if (outcome === "existing_confirmed") {
      // No email is sent for an address that already has a confirmed account.
      setExisting(true);
      setError("An account with this email already exists. Log in, or reset your password if you've forgotten it.");
      return;
    }
    setResumed(outcome === "existing_unconfirmed");
    setConfirmEmail(true);
  };

  if (confirmEmail) {
    return (
      <AuthLayout>
        <div style={{ color: "var(--accent)", marginBottom: 10 }}>
          <Mail size={30} aria-hidden="true" />
        </div>
        <h1 className="display">Check your email</h1>
        {resumed && (
          <div style={{ margin: "10px 0" }}>
            <Alert kind="info">
              You started signing up with this address before but never confirmed it. Use the newest email: links from
              earlier ones may no longer work.
            </Alert>
          </div>
        )}
        <p className="muted" style={{ margin: "10px 0 14px" }}>
          We've sent a confirmation link to <strong>{email.trim()}</strong>.
        </p>
        <p className="muted" style={{ margin: "0 0 14px" }}>
          The email is sent through Supabase, so the sender may appear as Supabase rather than Site2Chat. This is
          expected for our current setup.
        </p>
        <p className="muted" style={{ margin: "0 0 14px" }}>
          Open the email and click the confirmation link to verify your account and continue. Open it in this
          device's browser to be signed in automatically.
        </p>
        <p className="muted" style={{ margin: "0 0 20px" }}>
          Can't find the email? Check your spam or junk folder, or use the resend button below.
        </p>
        <ResendConfirmation email={email.trim()} initialLockSeconds={30} />
        <p className="hint" style={{ marginTop: 18 }}>
          Wrong address?{" "}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: 0, minHeight: 0, textDecoration: "underline" }}
            onClick={() => setConfirmEmail(false)}
          >
            Use a different email
          </button>
          {" · "}
          <Link to="/login">Log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="display">Create your account</h1>
      <p className="muted" style={{ margin: "6px 0 22px" }}>
        Start turning your website into a chatbot. We'll email you a link to confirm your address.
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
            <Alert kind="error">
              {error}
              {existing && (
                <div style={{ marginTop: 8 }}>
                  <Link to="/login">Log in</Link> · <Link to="/forgot-password">Reset password</Link>
                </div>
              )}
            </Alert>
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
