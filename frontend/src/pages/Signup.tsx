import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Mail } from "lucide-react";
import AuthLayout from "../layouts/AuthLayout";
import { Alert } from "../components/ui";
import { ResendConfirmation } from "../components/ResendConfirmation";
import { supabase } from "../lib/supabase";
import { describeAuthError } from "../lib/authErrors";
import { useAuth } from "../lib/auth";

export default function Signup() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

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
    // Supabase returns an obfuscated user with no identities when the email already exists.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setExisting(true);
      setError("An account with this email already exists. Log in, or reset your password if you've forgotten it.");
      return;
    }
    if (!data.session) setConfirmEmail(true);
    // If a session was returned, the auth listener redirects to the dashboard.
  };

  if (confirmEmail) {
    return (
      <AuthLayout>
        <div style={{ color: "var(--accent)", marginBottom: 10 }}>
          <Mail size={30} aria-hidden="true" />
        </div>
        <h1 className="display">Confirm your Site2Chat account</h1>
        <p className="muted" style={{ margin: "10px 0 14px" }}>
          We've asked our email service to send a confirmation link to <strong>{email.trim()}</strong>. It usually
          arrives within a few minutes, but delivery isn't guaranteed.
        </p>
        <ul className="muted" style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 14 }}>
          <li>Check spam, junk and promotions folders.</li>
          <li>Make sure the address above is spelled correctly.</li>
          <li>Open the link on this device's browser to be signed in automatically.</li>
        </ul>
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
