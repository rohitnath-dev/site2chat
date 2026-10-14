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

// Captured before createClient() consumes and strips the URL hash, so a password-reset
// link is still recognised even if the PASSWORD_RECOVERY event fires before we subscribe.
export const startedInRecovery =
  typeof window !== "undefined" && /(^|[#&])type=recovery(&|$)/.test(window.location.hash);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
