import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

function formatCompetitor(slug?: string): string {
  if (!slug) return "Competitor";
  const known: Record<string, string> = {
    tidio: "Tidio",
    chatbase: "Chatbase",
    intercom: "Intercom",
    zendesk: "Zendesk",
    crisp: "Crisp",
    drift: "Drift",
    botpress: "Botpress",
    voiceflow: "Voiceflow",
  };
  const key = slug.toLowerCase();
  if (known[key]) return known[key];
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default function VsCompetitor() {
  const { competitor } = useParams<{ competitor: string }>();
  const { session } = useAuth();
  const name = formatCompetitor(competitor);
  const cta = session ? "/create" : "/signup";

  useEffect(() => {
    const pageTitle = `Site2Chat vs ${name}: Which Website Chatbot is Better in 2026?`;
    const pageDesc = `Compare Site2Chat vs ${name}. Discover setup times, features, pricing, and see which AI website chatbot is best for your site in 2026.`;
    document.title = `${pageTitle} · Site2Chat`;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", pageDesc);
    window.scrollTo(0, 0);
  }, [name]);

  return (
    <div className="shell">
      <header className="container nav">
        <Brand />
        <nav className="nav-links" aria-label="Main">
          {session ? (
            <Link to="/dashboard" className="btn btn-sm">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="shell-main">
        <section className="container hero" style={{ paddingBottom: "32px" }}>
          <h1 className="display" style={{ maxWidth: "18ch" }}>
            Site2Chat vs {name}: Which Website Chatbot is Better in 2026?
          </h1>
          <p className="lead" style={{ maxWidth: "56ch" }}>
            Looking for the right AI chatbot solution? Compare Site2Chat and {name} on setup speed, accuracy,
            AI provider flexibility, and total cost of ownership.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "8px" }}>
            <Link to={cta} className="btn btn-primary btn-lg">
              Try Site2Chat Free <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="container" style={{ maxWidth: "860px", marginBottom: "48px" }}>
          <div className="card" style={{ padding: "28px", overflowX: "auto" }}>
            <h2 style={{ fontSize: "22px", marginBottom: "20px" }}>Feature Comparison</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 14px", color: "var(--text-faint)", fontWeight: 600 }}>Feature</th>
                  <th style={{ padding: "12px 14px", color: "var(--accent)", fontWeight: 700 }}>Site2Chat</th>
                  <th style={{ padding: "12px 14px", color: "var(--text)", fontWeight: 600 }}>{name}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 500 }}>Setup Time</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Under 2 minutes
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Hours to days of setup</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 500 }}>Knowledge Ingestion</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Auto-crawls up to 100 pages
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Manual files or complex sync</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 500 }}>AI Model Freedom</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Groq (Llama 3.3) & OpenRouter BYOK
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>
                    <X size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Proprietary / locked vendor models
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 500 }}>Website Hallucination Control</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Strict RAG grounded in crawled URLs
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Requires extensive prompt tuning</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 500 }}>Embed Experience</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Lightweight 1-line script tag
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Heavy JS bundle with multi-step SDK</td>
                </tr>
                <tr>
                  <td style={{ padding: "14px", fontWeight: 500 }}>Pricing Structure</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Free tier & direct inference
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Costly seat licenses & conversation limits</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="container" style={{ maxWidth: "860px", marginBottom: "64px" }}>
          <div className="card" style={{ padding: "32px", background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
            <h2 style={{ fontSize: "20px", color: "var(--accent)", marginBottom: "12px", fontFamily: "var(--font-sans)", fontWeight: 700 }}>
              The 2026 Verdict
            </h2>
            <p style={{ fontSize: "17px", lineHeight: "1.6", color: "var(--text)", margin: 0 }}>
              If you want an accurate AI chatbot trained directly from your website pages in two minutes without complex setup or expensive per-seat pricing, Site2Chat is the clear winner. {name} excels at legacy ticketing, but Site2Chat dominates automated website answers fast.
            </p>
          </div>
        </section>

        <section className="container" style={{ textAlign: "center", paddingBottom: "64px" }}>
          <h2 className="display" style={{ fontSize: "32px", marginBottom: "16px" }}>
            Ready to upgrade your website chat?
          </h2>
          <p className="muted" style={{ maxWidth: "44ch", margin: "0 auto 24px" }}>
            Paste your URL and test your custom AI chatbot in under 120 seconds. No credit card required.
          </p>
          <Link to={cta} className="btn btn-primary btn-lg">
            Create Chatbot Now <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
