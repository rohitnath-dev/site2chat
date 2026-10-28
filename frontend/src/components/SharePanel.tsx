import { useState } from "react";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { chatLink, copyText, embedSnippet } from "../lib/utils";
import { useToast } from "./Toast";
import { Alert } from "./ui";

export function SharePanel({
  chatbotId,
  name,
  status,
}: {
  chatbotId: string;
  name: string;
  status?: string;
}) {
  const toast = useToast();
  const link = chatLink(chatbotId, name);
  const snippet = embedSnippet(chatbotId, name);
  const [sharing, setSharing] = useState(false);
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const preview = (() => {
    try {
      const u = new URL(link);
      return `${u.host}${u.pathname}`;
    } catch {
      return link;
    }
  })();

  const share = async () => {
    if (sharing) return;
    if (typeof navigator.share !== "function") {
      const ok = await copyText(link);
      toast.show(
        ok
          ? "Sharing isn't available in this browser, so the link was copied instead."
          : "Sharing isn't available here and the link couldn't be copied. Select it and copy it manually.",
        ok ? "success" : "error",
      );
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: name, text: `Chat with ${name} on Site2Chat`, url: link });
    } catch (err) {
      // Closing the share sheet is not an error.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const ok = await copyText(link);
        toast.show(
          ok ? "Couldn't open the share menu, so the link was copied instead." : "Couldn't share the link. Select it and copy it manually.",
          ok ? "success" : "error",
        );
      }
    } finally {
      setSharing(false);
    }
  };

  const copy = async (text: string, what: string) => {
    const ok = await copyText(text);
    toast.show(ok ? `${what} copied` : "Couldn't copy. Select the text and copy it manually.", ok ? "success" : "error");
  };

  return (
    <div>
      {status === "pending" && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="warn">
            This chatbot isn't ready yet. Chat won't respond until its website has been read successfully.
          </Alert>
        </div>
      )}

      <div className="copy-block">
        <div className="label" style={{ marginBottom: 6 }}>
          Hosted chat link
        </div>
        <div className="link-preview" title={link}>
          <span>{preview}</span>
        </div>
        <div className="share-actions">
          <button type="button" className="btn btn-sm" onClick={() => copy(link, "Link")}>
            <Copy size={15} aria-hidden="true" /> Copy link
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void share()} disabled={sharing}>
            <Share2 size={15} aria-hidden="true" /> Share
          </button>
          <a className="btn btn-sm" href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} aria-hidden="true" /> Open
          </a>
        </div>
      </div>

      <div className="copy-block">
        <div className="label" style={{ marginBottom: 6 }}>
          Embed on your website
        </div>
        <pre className="code">{snippet}</pre>
        <div className="copy-row">
          <button type="button" className="btn btn-sm" onClick={() => copy(snippet, "Embed snippet")}>
            <Copy size={15} /> Copy snippet
          </button>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          Paste this just before the closing <code>&lt;/body&gt;</code> tag on every page where the chat bubble should
          appear. A chat launcher will show up in the bottom corner.
        </p>
      </div>

      {isLocal && (
        <Alert kind="warn">
          These links use <code>{window.location.origin}</code>, which only works on this computer. After you publish
          the frontend, copy them again from the live site.
        </Alert>
      )}
    </div>
  );
}
