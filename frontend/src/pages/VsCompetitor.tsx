import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

export const competitors = [
  "tidio",
  "intercom",
  "drift",
  "manychat",
  "chatbot-com",
  "landbot",
  "tars",
  "wonderchat",
  "chatbase",
] as const;

const competitorNames: Record<string, string> = {
  tidio: "Tidio",
  intercom: "Intercom",
  drift: "Drift",
  manychat: "ManyChat",
  "chatbot-com": "Chatbot.com",
  landbot: "Landbot",
  tars: "TARS",
  wonderchat: "Wonderchat",
  chatbase: "Chatbase",
};

export function formatCompetitorName(slug?: string): string {
  if (!slug) return "Competitor";
  const key = slug.toLowerCase();
  if (competitorNames[key]) return competitorNames[key];
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default function VsCompetitor() {
  const { competitor } = useParams<{ competitor: string }>();
  const { session } = useAuth();
  const name = formatCompetitorName(competitor);
  const slug = competitor || "competitor";

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Site2Chat vs ${name}: Which Website Chatbot is Better in 2026?`,
    description: `Site2Chat is a fast, no-code AI chatbot builder that trains on your website content and embeds in 2 minutes. ${name} is better for enterprise sales teams with complex workflows.`,
    author: {
      "@type": "Organization",
      name: "Site2Chat",
    },
    publisher: {
      "@type": "Organization",
      name: "Site2Chat",
      url: "https://site2chat.vercel.app",
    },
    datePublished: "2026-01-01T00:00:00Z",
    dateModified: "2026-11-04T00:00:00Z",
    mainEntityOfPage: `https://site2chat.vercel.app/vs/${slug}`,
  };

  useEffect(() => {
    const pageTitle = `Site2Chat vs ${name}: Which Website Chatbot is Better in 2026?`;
    const pageDesc = `Site2Chat is a fast, no-code AI chatbot builder that trains on your website content and embeds in 2 minutes. ${name} is better for enterprise sales teams with complex workflows.`;
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
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
          <h1 className="display" style={{ maxWidth: "22ch" }}>
            Site2Chat vs {name}: Which Website Chatbot is Better in 2026?
          </h1>
          <p className="lead" style={{ maxWidth: "60ch" }}>
            <strong>
              Site2Chat is a fast, no-code AI chatbot builder that trains on your website content and embeds in 2 minutes. {name} is better for enterprise sales teams with complex workflows.
            </strong>
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "16px" }}>
            <Link to="/" className="btn btn-primary btn-lg">
              Try Site2Chat Free <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="container" style={{ maxWidth: "860px", marginBottom: "48px" }}>
          <div className="card" style={{ padding: "28px", overflowX: "auto" }}>
            <h2 style={{ fontSize: "22px", marginBottom: "20px" }}>Comparison Table</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 14px", color: "var(--text-faint)", fontWeight: 600 }}>Criteria</th>
                  <th style={{ padding: "12px 14px", color: "var(--accent)", fontWeight: 700 }}>Site2Chat</th>
                  <th style={{ padding: "12px 14px", color: "var(--text)", fontWeight: 600 }}>{name}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 600 }}>Pricing</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Free tier available & flexible pricing
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Expensive per-seat / enterprise tiers</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 600 }}>Setup Time</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    2 minutes
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Hours to days of configuration</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 600 }}>AI Training</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Automatic URL scraping of website content
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Manual decision trees, intents, or complex sync</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px", fontWeight: 600 }}>No-Code</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    100% No-code instant embed
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>
                    <X size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Complex workflow builders or developer integration
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "14px", fontWeight: 600 }}>Platform Support</td>
                  <td style={{ padding: "14px", color: "var(--accent)", fontWeight: 600 }}>
                    <Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    Any website (Shopify, WordPress, Webflow, etc.)
                  </td>
                  <td style={{ padding: "14px", color: "var(--text-muted)" }}>Restricted ecosystem or heavy custom SDKs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="container" style={{ maxWidth: "860px", marginBottom: "64px" }}>
          <div className="card" style={{ padding: "32px", background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
            <h2 style={{ fontSize: "20px", color: "var(--accent)", marginBottom: "12px", fontFamily: "var(--font-sans)", fontWeight: 700 }}>
              Verdict
            </h2>
            <p style={{ fontSize: "17px", lineHeight: "1.6", color: "var(--text)", margin: 0, fontWeight: 500 }}>
              Use Site2Chat for quick, content-trained chatbots. Use {name} for enterprise sales.
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
          <Link to="/" className="btn btn-primary btn-lg">
            Try Site2Chat Free <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
