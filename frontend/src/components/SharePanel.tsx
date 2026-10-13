import { Copy, ExternalLink } from "lucide-react";
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
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

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
        <pre className="code">{link}</pre>
        <div className="copy-row">
          <button className="btn btn-sm" onClick={() => copy(link, "Link")}>
            <Copy size={15} /> Copy link
          </button>
          <a className="btn btn-sm" href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Open
          </a>
        </div>
      </div>

      <div className="copy-block">
        <div className="label" style={{ marginBottom: 6 }}>
          Embed on your website
        </div>
        <pre className="code">{snippet}</pre>
        <div className="copy-row">
          <button className="btn btn-sm" onClick={() => copy(snippet, "Embed snippet")}>
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
