import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

const looksLikePlaceholder =
  !url || !key || url.includes("your-project") || key.startsWith("your-");

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
