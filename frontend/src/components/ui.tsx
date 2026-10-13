import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, Check, Info, MessageCircle, X } from "lucide-react";
import type { ChatbotStatus } from "../lib/api";

export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark" aria-hidden="true">
        <MessageCircle size={17} strokeWidth={2.2} />
      </span>
      Site2Chat
    </Link>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "warn" | "success";
  children: ReactNode;
}) {
  const Icon = kind === "error" ? AlertCircle : kind === "warn" ? AlertTriangle : kind === "success" ? Check : Info;
  const cls = kind === "info" ? "" : `alert-${kind}`;
  return (
    <div className={`alert ${cls}`} role={kind === "error" ? "alert" : undefined}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: ChatbotStatus }) {
  if (status === "ready") return <span className="badge badge-ready">Ready</span>;
  if (status === "partial") return <span className="badge badge-partial">Partially ready</span>;
  if (status === "pending") return <span className="badge">Pending</span>;
  return <span className="badge">{status}</span>;
}

export function ConfigNotice() {
  return (
    <div className="auth-main">
      <div className="card auth-card">
        <h1 className="display">Setup needed</h1>
        <p className="muted" style={{ marginBottom: 14 }}>
          Sign-in isn't configured yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>frontend/.env</code> (see{" "}
          <code>.env.example</code>), then restart the dev server or rebuild.
        </p>
        <Link to="/" className="btn">
          Back to home
        </Link>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass inline closures; keep the latest in a ref so the effect below runs once per
  // mount and doesn't re-grab focus or reset the page scroll lock on every parent re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2 className="display">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
