import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

// supabase-js appends /auth/v1/... to this value, so it must be the bare project origin
// (https://<ref>.supabase.co). A pasted value with a path (/rest/v1, /auth/v1, a trailing
// segment) makes Supabase answer "Invalid path specified in request URL". Keep only the origin.
function toOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : undefined;
  } catch {
    return undefined; // not a valid absolute URL (e.g. missing https://)
  }
}

const url = toOrigin(rawUrl);

const looksLikePlaceholder =
  !url || !key || !rawUrl || rawUrl.includes("your-project") || key.startsWith("your-");

export const isSupabaseConfigured = !looksLikePlaceholder;

// Supabase returns users from an email link with the result in the URL hash (implicit flow):
//   success: #access_token=...&type=signup|recovery|...
//   failure: #error=access_denied&error_code=otp_expired&error_description=...
// supabase-js consumes and strips that hash when the client is created, so capture it first.
// Only the type and error text are kept here; tokens are never read or stored by this code.
function readAuthCallback() {
  const empty = { isCallback: false, type: null as string | null, errorCode: null as string | null, errorMessage: null as string | null };
  if (typeof window === "undefined") return empty;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = hash.get("type");
  const hasTokens = hash.has("access_token");
  const errorCode = hash.get("error_code");
  const errorMessage = hash.get("error_description") || (hash.get("error") ? "The link could not be used." : null);
  return { isCallback: hasTokens || !!errorMessage, type, errorCode, errorMessage };
}

export const authCallback = readAuthCallback();

// Kept for the password-reset screen.
export const startedInRecovery = authCallback.type === "recovery";

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
