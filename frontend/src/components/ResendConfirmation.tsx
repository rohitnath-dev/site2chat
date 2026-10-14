import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "../lib/supabase";
import { describeAuthError, isRateLimited, retryAfterSeconds } from "../lib/authErrors";
import { Alert } from "./ui";

const COOLDOWN_SECONDS = 60;

/**
 * Asks Supabase to send the confirmation email again.
 * A success here means the request was accepted, not that mail was delivered, and the copy says so.
 */
export function ResendConfirmation({ email, initialLockSeconds = 0 }: { email: string; initialLockSeconds?: number }) {
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(initialLockSeconds);
  const [note, setNote] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);

  const resend = async () => {
    if (busy || seconds > 0 || !supabase) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) {
      setNote({ kind: "error", text: describeAuthError(error) });
      if (isRateLimited(error)) setSeconds(retryAfterSeconds(error) ?? COOLDOWN_SECONDS);
      return;
    }
    setNote({
      kind: "success",
      text: "Request sent. If it doesn't show up within a few minutes, check spam or promotions. We can't see whether it was delivered.",
    });
    setSeconds(COOLDOWN_SECONDS);
  };

  return (
    <div>
      {note && (
        <div style={{ marginBottom: 12 }} aria-live="polite">
          <Alert kind={note.kind}>{note.text}</Alert>
        </div>
      )}
      <button className="btn" type="button" onClick={() => void resend()} disabled={busy || seconds > 0}>
        <Mail size={16} aria-hidden="true" />
        {busy ? "Sending…" : seconds > 0 ? `Resend in ${seconds}s` : "Resend confirmation email"}
      </button>
    </div>
  );
}
