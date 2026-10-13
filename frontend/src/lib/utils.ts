export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/** Accepts "example.com" or a full URL. Returns a normalized http(s) URL or null. */
export function normalizeWebsiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    // The backend rejects embedded credentials and non-default ports, so catch them early.
    if (u.username || u.password || u.port) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function suggestName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0] || host;
    const pretty = base.replace(/[-_]+/g, " ");
    return `${pretty.charAt(0).toUpperCase()}${pretty.slice(1)} assistant`;
  } catch {
    return "Website assistant";
  }
}

export function displayHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}

export function chatLink(chatbotId: string, name?: string): string {
  const q = name ? `?name=${encodeURIComponent(name)}` : "";
  return `${window.location.origin}/chat/${chatbotId}${q}`;
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function embedSnippet(chatbotId: string, name: string): string {
  return [
    "<script",
    `  src="${window.location.origin}/widget.js"`,
    `  data-chatbot-id="${chatbotId}"`,
    `  data-chatbot-name="${escapeAttr(name)}"`,
    "  defer",
    "></script>",
  ].join("\n");
}

/** Per-browser, per-chatbot client-side session identifier (not a credential). */
export function getSessionId(chatbotId: string): string {
  const key = `site2chat:session:${chatbotId}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
