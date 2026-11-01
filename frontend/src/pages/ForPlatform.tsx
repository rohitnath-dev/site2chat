import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Code, Sparkles, Globe } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

function formatPlatform(slug?: string): string {
  if (!slug) return "Your Website";
  const known: Record<string, string> = {
    wordpress: "WordPress",
    shopify: "Shopify",
    webflow: "Webflow",
    wix: "Wix",
    squarespace: "Squarespace",
    framer: "Framer",
    react: "React",
    nextjs: "Next.js",
    ghost: "Ghost",
    weebly: "Weebly",
  };
  const key = slug.toLowerCase();
  if (known[key]) return known[key];
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default function ForPlatform() {
  const { platform } = useParams<{ platform: string }>();
  const { session } = useAuth();
  const name = formatPlatform(platform);
  const cta = session ? "/create" : "/signup";

  useEffect(() => {
    const pageTitle = `How to Add an AI Chatbot to ${name} in 2 Minutes`;
    const pageDesc = `Step-by-step tutorial on how to add a custom AI chatbot to your ${name} site in 2 minutes. Ingest pages, configure AI, and embed with 1 line of code.`;
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
        <section className="container hero">
          <h1 className="display" style={{ maxWidth: "16ch" }}>
            How to Add an AI Chatbot to {name} in 2 Minutes
          </h1>
          <p className="lead" style={{ maxWidth: "54ch" }}>
            Give your {name} visitors 24/7 instant answers about your products, services, and documentation. No
            coding or manual training required.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <Link to={cta} className="btn btn-primary btn-lg">
              Get Started for {name} <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: "48px" }}>
          <h2 style={{ textAlign: "center", fontSize: "28px", marginBottom: "36px", fontFamily: "var(--font-sans)" }}>
            3-Step Integration Guide
          </h2>
          <div className="steps" aria-label="3-step guide">
            <div className="card step">
              <div className="step-num">1</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Globe size={18} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>Crawl Your {name} Site</h3>
              </div>
              <p className="muted">
                Enter your {name} domain. Site2Chat automatically navigates and indexes up to 100 pages, extracting
                clean text from articles, product listings, and support FAQs.
              </p>
            </div>

            <div className="card step">
              <div className="step-num">2</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Sparkles size={18} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>Configure AI & Persona</h3>
              </div>
              <p className="muted">
                Select your preferred model—such as ultra-fast Groq Llama 3.3 or your own OpenRouter key. Customize
                your chatbot's name, brand colors, and greeting prompt.
              </p>
            </div>

            <div className="card step">
              <div className="step-num">3</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Code size={18} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>Paste Embed Code</h3>
              </div>
              <p className="muted">
                Copy your customized one-line snippet and paste it into {name}'s header code settings or theme template.
                Your interactive chat bubble appears immediately.
              </p>
            </div>
          </div>
        </section>

        <section className="container" style={{ maxWidth: "760px", marginBottom: "64px" }}>
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "18px", marginBottom: "12px" }}>One-line embed snippet for {name}</h3>
            <p className="muted" style={{ marginBottom: "16px", fontSize: "14px" }}>
              Insert this code right before the closing <code>&lt;/body&gt;</code> tag inside your {name} dashboard:
            </p>
            <pre
              style={{
                background: "var(--surface-muted)",
                padding: "16px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                overflowX: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                lineHeight: "1.5",
                color: "var(--text)",
              }}
            >
              <code>
                {`<!-- Site2Chat Widget for ${name} -->\n<script\n  src="https://site2chat.vercel.app/widget.js"\n  data-chatbot-id="YOUR_CHATBOT_ID"\n  defer\n></script>`}
              </code>
            </pre>
          </div>
        </section>

        <section className="container" style={{ textAlign: "center", paddingBottom: "72px" }}>
          <h2 className="display" style={{ fontSize: "32px", marginBottom: "16px" }}>
            Launch your {name} chatbot in 2 minutes
          </h2>
          <p className="muted" style={{ maxWidth: "44ch", margin: "0 auto 24px" }}>
            Start answering visitor questions on autopilot with verified information from your {name} site.
          </p>
          <Link to={cta} className="btn btn-primary btn-lg">
            Create Chatbot for {name} <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
