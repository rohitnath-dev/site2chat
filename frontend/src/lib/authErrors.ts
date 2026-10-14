export interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
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
    return "Too many emails or attempts in a short time. Wait a few minutes, then try again.";
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
    return "We couldn't send the confirmation email. The email service may be busy or not set up yet. Wait a few minutes and try again.";
  }
  return msg || "Something went wrong. Please try again.";
}
