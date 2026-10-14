export interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/** Seconds Supabase asks us to wait ("you can only request this after 52 seconds"), if it said. */
export function retryAfterSeconds(err: AuthErrorLike): number | null {
  const m = /after\s+(\d+)\s+seconds?/i.exec(err.message || "");
  return m ? Math.min(parseInt(m[1], 10), 3600) : null;
}

/** True when Supabase refused because too many emails or requests were made recently. */
export function isRateLimited(err: AuthErrorLike): boolean {
  const code = (err.code || "").toLowerCase();
  return (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    err.status === 429 ||
    /rate limit/i.test(err.message || "")
  );
}

/** Turns a Supabase Auth error into a message a person can act on. */
export function describeAuthError(err: AuthErrorLike): string {
  const code = (err.code || "").toLowerCase();
  const msg = err.message || "";

  if (isRateLimited(err)) {
    const wait = retryAfterSeconds(err);
    if (wait !== null) {
      // Per-address cooldown: an email was requested for this address moments ago.
      return `An email was requested for this address a moment ago. Please wait ${wait} seconds before asking for another, and check your inbox and spam folder in the meantime.`;
    }
    if (/email rate limit/i.test(msg) || code === "over_email_send_rate_limit") {
      // Project-wide limit: the email service has hit its sending cap, which is common with Supabase's built-in sender.
      return "Our email service has reached its sending limit for now, so no new email was sent. Please try again later. This can take up to an hour.";
    }
    return "Too many attempts in a short time. Wait a minute, then try again.";
  }
  if (code === "email_address_not_authorized" || /not authorized/i.test(msg)) {
    return "Confirmation emails can't be sent to this address right now. Try a different address.";
  }
  if (code === "email_address_invalid" || /email address .* is invalid/i.test(msg)) {
    return "That email address doesn't look valid.";
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (code === "weak_password") {
    return "That password is too weak. Choose a longer or less common one.";
  }
  if (code === "signup_disabled") {
    return "New sign-ups are turned off right now.";
  }
  if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (code === "invalid_credentials" || /invalid login/i.test(msg)) {
    return "That email and password don't match.";
  }
  if (/error sending (confirmation|email)/i.test(msg) || code === "unexpected_failure") {
    return "We couldn't send the confirmation email, so nothing was sent. The email service may be busy or not set up yet. Wait a few minutes and try again.";
  }
  return msg || "Something went wrong. Please try again.";
}

export interface SignUpUser {
  identities?: unknown[] | null;
  created_at?: string;
  email_confirmed_at?: string | null;
}

export type SignUpOutcome = "existing_confirmed" | "existing_unconfirmed" | "new";

/**
 * Supabase answers a successful sign-up the same way in several situations.
 * - existing_confirmed: the address already has a confirmed account. Supabase returns a placeholder user
 *   with no identities and sends no confirmation email.
 * - existing_unconfirmed: an earlier sign-up was never confirmed. Supabase accepts the request again.
 * - new: a fresh account was created.
 * In every case a success only means the request was accepted. It says nothing about delivery.
 */
export function classifySignUp(user: SignUpUser | null | undefined, now: number = Date.now()): SignUpOutcome {
  if (user && Array.isArray(user.identities) && user.identities.length === 0) return "existing_confirmed";
  const created = user?.created_at ? Date.parse(user.created_at) : NaN;
  if (user && !user.email_confirmed_at && Number.isFinite(created) && now - created > 2 * 60_000) {
    return "existing_unconfirmed";
  }
  return "new";
}
