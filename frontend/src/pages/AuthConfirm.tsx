import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import AuthLayout from "../layouts/AuthLayout";
import { Alert } from "../components/ui";
import { useAuth } from "../lib/auth";
import { authCallback } from "../lib/supabase";

const REDIRECT_MS = 2500;

/** Landing page for the link in the Supabase confirmation email. */
export default function AuthConfirm() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const failed = !!authCallback.errorMessage;
  const confirmed = !failed && !loading && !!session;

  useEffect(() => {
    document.title = "Confirm email · Site2Chat";
  }, []);

  useEffect(() => {
    if (!confirmed) return;
    const t = window.setTimeout(() => navigate("/dashboard", { replace: true }), REDIRECT_MS);
    return () => window.clearTimeout(t);
  }, [confirmed, navigate]);

  if (failed) {
    const expired = authCallback.errorCode === "otp_expired";
    return (
      <AuthLayout>
        <h1 className="display">Link didn't work</h1>
        <div style={{ margin: "12px 0 16px" }}>
          <Alert kind="error">
            {expired
              ? "This confirmation link has expired or has already been used."
              : authCallback.errorMessage || "This confirmation link isn't valid."}
          </Alert>
        </div>
        <p className="muted" style={{ marginBottom: 18 }}>
          If you already confirmed your email, you can log in. Otherwise sign up again and we'll send a fresh link.
        </p>
        <div className="copy-row" style={{ flexWrap: "wrap" }}>
          <Link to="/login" className="btn btn-primary">
            Log in
          </Link>
          <Link to="/signup" className="btn">
            Sign up again
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (loading) {
    return (
      <AuthLayout>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }} role="status" aria-live="polite">
          <span className="spinner" />
          <span>Confirming your email…</span>
        </div>
      </AuthLayout>
    );
  }

  if (confirmed) {
    return (
      <AuthLayout>
        <div style={{ color: "var(--accent)", marginBottom: 10 }}>
          <CheckCircle2 size={32} aria-hidden="true" />
        </div>
        <h1 className="display">Email confirmed</h1>
        <p className="muted" style={{ margin: "8px 0 20px" }} role="status">
          You're signed in. Taking you to your dashboard…
        </p>
        <Link to="/dashboard" replace className="btn btn-primary">
          Continue to dashboard
        </Link>
      </AuthLayout>
    );
  }

  // Opened directly, or the link produced no session.
  return (
    <AuthLayout>
      <h1 className="display">Nothing to confirm</h1>
      <p className="muted" style={{ margin: "8px 0 20px" }}>
        We couldn't find a confirmation in this link. If you've already confirmed your email, log in to continue.
      </p>
      <div className="copy-row" style={{ flexWrap: "wrap" }}>
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
        <Link to="/signup" className="btn">
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
}
