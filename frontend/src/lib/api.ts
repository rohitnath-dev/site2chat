import { supabase } from "./supabase";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
export const API_ROOT = (RAW_BASE || "https://site2chat-api.onrender.com").replace(/\/+$/, "");
const API = `${API_ROOT}/api/v1`;
const RETRY_DELAYS_MS = [1200, 3000];

export type ChatbotStatus = "pending" | "ready" | "partial" | string;

export interface Chatbot {
  id: string;
  name: string;
  description: string | null;
  website_url: string;
  public_id: string;
  status: ChatbotStatus;
}

export interface IngestResult {
  status: string;
  chatbot_id: string;
  pages_discovered: number;
  pages_saved: number;
  chunks_saved: number;
  pages_failed: number;
  failures: { url: string; error: string }[];
}

export interface ChatReply {
  status: string;
  chatbot_id: string;
  conversation_id: string;
  message: string;
  reply: string;
}

export type Provider = "groq" | "openrouter";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function friendly(status: number, detail: string | null, context: "management" | "chat"): string {
  switch (status) {
    case 0:
      return "Couldn't get a response from the server. This can be your connection, the server waking up after being idle (it can take up to a minute), or the server stopping partway through. Wait a moment and try again.";
    case 400:
      return detail || "The request couldn't be processed.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 404:
      return context === "chat"
        ? "This chatbot could not be found."
        : detail || "That item could not be found.";
    case 409:
      return detail || "This chatbot isn't ready yet.";
    case 422:
      return detail || "Some of the information entered isn't valid.";
    case 502:
      return detail || "The service couldn't complete that request. Please try again.";
    case 503:
      // The API answers 503 when it can't reach the Supabase key service to check a login token.
      // The user's session is fine at that point, so say that instead of implying they're signed out.
      if (detail && /authentication/i.test(detail)) {
        return "You're signed in, but Site2Chat's server couldn't verify your login just now. This is a server-side problem, not your account. Try again in a moment; if it keeps happening, the server's sign-in configuration needs attention.";
      }
      return detail || "The service is temporarily unavailable. Please try again shortly.";
    default:
      return detail || `Something went wrong (error ${status}).`;
  }
}

async function readDetail(res: Response): Promise<string | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    const body = JSON.parse(text);
    const d = body?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((item) => {
          const loc = Array.isArray(item?.loc) ? item.loc.filter((p: unknown) => p !== "body").join(".") : "";
          const msg = typeof item?.msg === "string" ? item.msg.replace(/^Value error, /, "") : "";
          return loc ? `${loc}: ${msg}` : msg;
        })
        .filter(Boolean)
        .join(" ");
    }
    return null;
  } catch {
    return null; // non-JSON error body
  }
}

async function getToken(forceRefresh = false): Promise<string | null> {
  if (!supabase) return null;
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  context?: "management" | "chat";
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, context = "management" } = opts;

  const send = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      return await fetch(`${API}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, friendly(0, null, context));
    }
  };

  // Read-only requests get a couple of short retries for transient failures (network drop or a 503).
  // Writes are never retried automatically, and a persistent failure is still reported.
  const sendWithRetry = async (token: string | null): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
      const canRetry = method === "GET" && attempt < RETRY_DELAYS_MS.length;
      try {
        const r = await send(token);
        if (!(canRetry && r.status === 503)) return r;
      } catch (e) {
        if (!(canRetry && e instanceof ApiError && e.status === 0)) throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  };

  let token: string | null = null;
  if (auth) {
    token = await getToken();
    if (!token) throw new ApiError(401, friendly(401, null, context));
  }

  let res = await sendWithRetry(token);

  if (auth && res.status === 401) {
    const refreshed = await getToken(true);
    if (refreshed) {
      res = await sendWithRetry(refreshed);
    }
    if (res.status === 401) {
      if (supabase) await supabase.auth.signOut();
      throw new ApiError(401, friendly(401, null, context));
    }
  }

  if (!res.ok) {
    const detail = await readDetail(res);
    throw new ApiError(res.status, friendly(res.status, detail, context));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, "The server sent an unexpected response.");
  }
}

export const api = {
  health: () => request<unknown>("/health/", { auth: false }),

  listChatbots: async (): Promise<Chatbot[]> => {
    const data = await request<{ status: string; chatbots: Chatbot[] }>("/chatbots/");
    return data.chatbots ?? [];
  },

  createChatbot: (payload: { name: string; website_url: string; description?: string }) =>
    request<Chatbot>("/chatbots/", { method: "POST", body: payload }),

  getChatbot: (id: string) => request<Chatbot>(`/chatbots/${id}`),

  updateLlmSettings: (id: string, llm_provider: Provider, llm_model: string) =>
    request<Chatbot>(`/chatbots/${id}/llm-settings`, {
      method: "PATCH",
      body: { llm_provider, llm_model },
    }),

  deleteChatbot: (id: string) =>
    request<{ status: string; message: string }>(`/chatbots/${id}`, { method: "DELETE" }),

  ingest: (id: string) => request<IngestResult>(`/chatbots/${id}/ingest`, { method: "POST" }),

  getOpenRouterStatus: async (): Promise<boolean> => {
    const data = await request<{ configured: boolean }>("/chatbots/credentials/openrouter");
    return !!data?.configured;
  },

  saveOpenRouterKey: (api_key: string) =>
    request<void>("/chatbots/credentials/openrouter", { method: "PUT", body: { api_key } }),

  removeOpenRouterKey: () =>
    request<{ status: string }>("/chatbots/credentials/openrouter", { method: "DELETE" }),

  sendChat: (chatbot_id: string, message: string, session_id: string) =>
    request<ChatReply>("/chat/", {
      method: "POST",
      auth: false,
      context: "chat",
      body: { chatbot_id, message, session_id },
    }),
};
