import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { api, type AiStatus, type Chatbot } from "../lib/api";
import { Alert } from "./ui";

const OPENROUTER_URL = "https://openrouter.ai/";

export type ProviderIssue = "default_credits" | "own_credits" | "own_key_invalid";

/**
 * Which confirmed provider problems matter for this owner's chatbots. A problem is only relevant if at
 * least one of their chatbots uses that provider, so switching providers clears the warning naturally.
 */
export function relevantIssues(status: AiStatus | null, bots: Chatbot[] | null): ProviderIssue[] {
  if (!status) return [];
  const list = bots ?? [];
  const issues: ProviderIssue[] = [];
  // llm_provider is missing on older API versions; those chatbots use the default provider.
  if (status.default_provider.status === "credits_exhausted" && list.some((b) => b.llm_provider !== "openrouter")) {
    issues.push("default_credits");
  }
  if (list.some((b) => b.llm_provider === "openrouter")) {
    if (status.own_openrouter.status === "credits_exhausted") issues.push("own_credits");
    if (status.own_openrouter.status === "key_invalid") issues.push("own_key_invalid");
  }
  return issues;
}

/** Loads confirmed provider problems. Failures are silent: no status means no warning, never a false one. */
export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const refresh = useCallback(async () => {
    try {
      setStatus(await api.getAiStatus());
    } catch {
      setStatus(null);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { status, refresh };
}

const linkProps = { target: "_blank", rel: "noopener noreferrer" } as const;

export function ProviderNotice({ issue, showSettingsLink = true }: { issue: ProviderIssue; showSettingsLink?: boolean }) {
  if (issue === "default_credits") {
    return (
      <Alert kind="warn">
        <strong>Our default AI service is temporarily unavailable</strong>
        <p style={{ margin: "6px 0" }}>
          Your chatbot is still set up, but our default AI service is temporarily unavailable. You can get it working
          again by connecting your own OpenRouter account. Nothing needs to be recreated: your chatbot and its website
          content stay as they are. This isn't something you set up wrongly.
        </p>
        <ol style={{ margin: "6px 0 10px", paddingLeft: 20 }}>
          <li>Open an OpenRouter account.</li>
          <li>Create an API key by following OpenRouter's instructions.</li>
          <li>
            Return to Site2Chat and open your AI provider settings
            {showSettingsLink && (
              <>
                {" "}
                (<Link to="/settings">Settings</Link>)
              </>
            )}
            .
          </li>
          <li>Paste your key and save it, then choose OpenRouter for your chatbot.</li>
          <li>Try your chatbot again.</li>
        </ol>
        <a className="btn btn-sm btn-primary" href={OPENROUTER_URL} {...linkProps}>
          Set up OpenRouter <ExternalLink size={14} aria-hidden="true" />
        </a>
      </Alert>
    );
  }
  if (issue === "own_credits") {
    return (
      <Alert kind="warn">
        <strong>Your AI service needs attention</strong>
        <p style={{ margin: "6px 0 10px" }}>
          Your OpenRouter account couldn't answer this message. Please check your OpenRouter account and add credits if
          needed, or update your API key. Then try again.
        </p>
        <a className="btn btn-sm btn-primary" href={OPENROUTER_URL} {...linkProps}>
          Check OpenRouter account <ExternalLink size={14} aria-hidden="true" />
        </a>{" "}
        {showSettingsLink && (
          <Link to="/settings" className="btn btn-sm">
            Update API key
          </Link>
        )}
      </Alert>
    );
  }
  return (
    <Alert kind="warn">
      <strong>Your OpenRouter key needs to be checked</strong>
      <p style={{ margin: "6px 0 10px" }}>
        OpenRouter didn't accept the API key saved in Site2Chat. Please check that it is correct and still active, or
        replace it with a new one, then try again.
      </p>
      {showSettingsLink && (
        <Link to="/settings" className="btn btn-sm btn-primary">
          Check my key
        </Link>
      )}{" "}
      <a className="btn btn-sm" href={OPENROUTER_URL} {...linkProps}>
        Open OpenRouter <ExternalLink size={14} aria-hidden="true" />
      </a>
    </Alert>
  );
}

export function ProviderNotices({ issues, showSettingsLink }: { issues: ProviderIssue[]; showSettingsLink?: boolean }) {
  if (issues.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 12, marginBottom: 20 }} role="region" aria-label="AI provider status">
      {issues.map((i) => (
        <ProviderNotice key={i} issue={i} showSettingsLink={showSettingsLink} />
      ))}
    </div>
  );
}
