import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, MessageCircle, Plus, RefreshCw, Share2, SlidersHorizontal, Trash2 } from "lucide-react";
import { api, ApiError, type Chatbot } from "../lib/api";
import { chatLink, copyText, displayHost } from "../lib/utils";
import { Alert, Modal, StatusBadge } from "../components/ui";
import { SharePanel } from "../components/SharePanel";
import { ProviderModal } from "../components/ProviderModal";
import { useToast } from "../components/Toast";

export default function Dashboard() {
  const toast = useToast();
  const [bots, setBots] = useState<Chatbot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<number | null>(null);
  const [shareBot, setShareBot] = useState<Chatbot | null>(null);
  const [providerBot, setProviderBot] = useState<Chatbot | null>(null);
  const [deleteBot, setDeleteBot] = useState<Chatbot | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoadStatus(null);
    try {
      setBots(await api.listChatbots());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your chatbots.");
      setLoadStatus(err instanceof ApiError ? err.status : null);
      setBots((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard · Site2Chat";
    void load();
  }, [load]);

  const copyLink = async (bot: Chatbot) => {
    const ok = await copyText(chatLink(bot.id, bot.name));
    toast.show(ok ? "Chat link copied" : "Couldn't copy the link", ok ? "success" : "error");
  };

  const confirmDelete = async () => {
    if (!deleteBot || deleting) return;
    setDeleting(true);
    try {
      await api.deleteChatbot(deleteBot.id);
      toast.show(`Deleted “${deleteBot.name}”`);
      setDeleteBot(null);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't delete the chatbot", "error");
    } finally {
      setDeleting(false);
    }
  };

  const finishSetup = async (bot: Chatbot) => {
    if (retryingId) return;
    setRetryingId(bot.id);
    try {
      const res = await api.ingest(bot.id);
      toast.show(
        res.status === "partial"
          ? `Ready, but ${res.pages_failed} page${res.pages_failed === 1 ? "" : "s"} couldn't be read`
          : "Chatbot is ready",
      );
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Setup failed", "error");
    } finally {
      setRetryingId(null);
      await load();
    }
  };

  const total = bots?.length ?? 0;
  const count = (s: string) => bots?.filter((b) => b.status === s).length ?? 0;

  return (
    <>
      <div className="page-head">
        <h1 className="display">Your chatbots</h1>
        <Link to="/create" className="btn btn-primary">
          <Plus size={17} /> Create chatbot
        </Link>
      </div>

      {loadError && (
        <div style={{ marginBottom: 20 }}>
          <Alert kind={loadStatus === 503 || loadStatus === 0 ? "warn" : "error"}>
            {loadError}{" "}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void load()}>
              <RefreshCw size={14} /> Retry
            </button>
          </Alert>
        </div>
      )}

      {bots === null ? (
        <div className="bot-list" aria-busy="true" aria-label="Loading chatbots">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : bots.length === 0 && !loadError ? (
        <div className="card empty fade-in">
          <h2 className="display">No chatbots yet</h2>
          <p>Paste a website URL and Site2Chat will turn it into a chatbot you can share or embed.</p>
          <Link to="/create" className="btn btn-primary btn-lg">
            <Plus size={18} /> Create chatbot
          </Link>
        </div>
      ) : (
        bots.length > 0 && (
          <>
            <div className="stats">
              <div className="card stat">
                <div className="stat-value">{total}</div>
                <div className="stat-label">Chatbots</div>
              </div>
              <div className="card stat">
                <div className="stat-value">{count("ready")}</div>
                <div className="stat-label">Ready</div>
              </div>
              <div className="card stat">
                <div className="stat-value">{count("partial")}</div>
                <div className="stat-label">Partially ready</div>
              </div>
              <div className="card stat">
                <div className="stat-value">
                  {count("pending") + count("queued") + count("running")}
                </div>
                <div className="stat-label">Pending</div>
              </div>
            </div>

            <ul className="bot-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {bots.map((bot) => (
                <li key={bot.id} className="card bot fade-in">
                  <div className="bot-info">
                    <div className="bot-title">
                      <h3>{bot.name}</h3>
                      <StatusBadge status={bot.status} />
                    </div>
                    <a className="bot-url" href={bot.website_url} target="_blank" rel="noopener noreferrer">
                      {displayHost(bot.website_url)}
                    </a>
                    {bot.description && <p className="bot-desc">{bot.description}</p>}
                  </div>
                  <div className="bot-actions">
                    {(bot.status === "pending" || bot.status === "failed") && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => void finishSetup(bot)}
                        disabled={retryingId !== null}
                      >
                        {retryingId === bot.id ? (
                          <>
                            <span className="spinner" /> Reading site…
                          </>
                        ) : (
                          <>
                            <RefreshCw size={14} /> {bot.status === "failed" ? "Retry setup" : "Finish setup"}
                          </>
                        )}
                      </button>
                    )}
                    {(bot.status === "queued" || bot.status === "running") && (
                      <span className="btn btn-sm" style={{ opacity: 0.8, cursor: "default" }}>
                        <span className="spinner" /> Reading site…
                      </span>
                    )}
                    <a
                      className="btn btn-sm"
                      href={chatLink(bot.id, bot.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} /> Open chat
                    </a>
                    <button className="btn btn-sm" onClick={() => setShareBot(bot)}>
                      <Share2 size={14} /> Share
                    </button>
                    <button className="icon-btn" aria-label={`Copy chat link for ${bot.name}`} onClick={() => void copyLink(bot)}>
                      <Copy size={16} />
                    </button>
                    <button className="icon-btn" aria-label={`AI provider for ${bot.name}`} onClick={() => setProviderBot(bot)}>
                      <SlidersHorizontal size={16} />
                    </button>
                    <button className="icon-btn" aria-label={`Delete ${bot.name}`} onClick={() => setDeleteBot(bot)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      )}

      {shareBot && (
        <Modal title="Share chatbot" onClose={() => setShareBot(null)}>
          <p className="muted" style={{ marginBottom: 16 }}>
            <MessageCircle size={14} style={{ verticalAlign: "-2px" }} /> {shareBot.name}
          </p>
          <SharePanel chatbotId={shareBot.id} name={shareBot.name} status={shareBot.status} />
        </Modal>
      )}

      {providerBot && <ProviderModal bot={providerBot} onClose={() => setProviderBot(null)} />}

      {deleteBot && (
        <Modal title="Delete chatbot?" onClose={() => (deleting ? undefined : setDeleteBot(null))}>
          <p style={{ marginBottom: 18 }}>
            <strong>{deleteBot.name}</strong> will be permanently deleted, and its chat link and embed will stop
            working. This can't be undone.
          </p>
          <div className="copy-row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setDeleteBot(null)} disabled={deleting}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete chatbot"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
