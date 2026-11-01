import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Bot, Clock, ShieldCheck, Target, Zap } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

function formatUseCase(slug?: string): string {
  if (!slug) return "Your Business";
  const known: Record<string, string> = {
    "customer-support": "Customer Support",
    "lead-generation": "Lead Generation",
    ecommerce: "E-Commerce",
    saas: "SaaS",
    "internal-docs": "Internal Documentation",
    "real-estate": "Real Estate",
    healthcare: "Healthcare",
    education: "Education",
  };
  const key = slug.toLowerCase();
  if (known[key]) return known[key];
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default function UseCase() {
  const { case: caseParam } = useParams<{ case: string }>();
  const { session } = useAuth();
  const name = formatUseCase(caseParam);
  const cta = session ? "/create" : "/signup";

  useEffect(() => {
    const pageTitle = `AI Chatbot for ${name}: Automate Support and Capture Leads`;
    const pageDesc = `Deploy a dedicated AI chatbot for ${name}. Automate customer questions 24/7, capture high-intent leads, and train instantly on your existing website content.`;
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
          <h1 className="display" style={{ maxWidth: "18ch" }}>
            AI Chatbot for {name}: Automate Support and Capture Leads
          </h1>
          <p className="lead" style={{ maxWidth: "56ch" }}>
            Supercharge your {name} workflow. Site2Chat indexes your website documentation, knowledge base, and product
            pages to deliver fast, 24/7 grounded answers to every visitor inquiry.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <Link to={cta} className="btn btn-primary btn-lg">
              Build Your {name} Chatbot <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: "48px" }}>
          <h2 style={{ textAlign: "center", fontSize: "28px", marginBottom: "36px", fontFamily: "var(--font-sans)" }}>
            Why Site2Chat for {name}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
              marginBottom: "36px",
            }}
          >
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Clock size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: "18px" }}>24/7 Autonomous Answers</h3>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Eliminate waiting times. Prospective clients and customers receive instant, accurate answers even when
                your human team is offline.
              </p>
            </div>

            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <ShieldCheck size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: "18px" }}>Grounded in Your Content</h3>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Prevent hallucinations with strict retrieval-augmented generation (RAG) that cites and draws strictly
                from your ingested website pages.
              </p>
            </div>

            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Target size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: "18px" }}>Higher Lead Conversion</h3>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Engage visitors at their moment of peak interest. Fast answers remove friction and guide prospects
                naturally toward signing up or purchasing.
              </p>
            </div>

            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Zap size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: "18px" }}>Zero Training Overhead</h3>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Never waste hours building decision trees or copying text chunks manually. Just paste your website URL
                and let Site2Chat do the rest.
              </p>
            </div>
          </div>
        </section>

        <section className="container" style={{ maxWidth: "820px", marginBottom: "64px" }}>
          <div className="card" style={{ padding: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <Bot size={22} color="var(--accent)" />
              <h2 style={{ fontSize: "20px", margin: 0, fontFamily: "var(--font-sans)" }}>
                How {name} Automation Works
              </h2>
            </div>
            <p style={{ color: "var(--text)", lineHeight: "1.6", marginBottom: "16px" }}>
              Site2Chat connects your online presence with modern AI intelligence. When your site changes or adds new
              features, re-crawl your domain with a single click to keep the knowledge base up-to-date.
            </p>
            <ul style={{ paddingLeft: "20px", lineHeight: "1.7", color: "var(--text-muted)" }}>
              <li>Extracts pages, documentation, and pricing tables automatically.</li>
              <li>Generates fast embeddings optimized for semantic search.</li>
              <li>Delivers answers via shareable chat URL or floating website widget.</li>
              <li>Lets you bring your own LLM keys or use lightning-fast Groq defaults.</li>
            </ul>
          </div>
        </section>

        <section className="container" style={{ textAlign: "center", paddingBottom: "72px" }}>
          <h2 className="display" style={{ fontSize: "32px", marginBottom: "16px" }}>
            Automate {name} with Site2Chat today
          </h2>
          <p className="muted" style={{ maxWidth: "44ch", margin: "0 auto 24px" }}>
            Turn your site pages into an active AI assistant in less than 2 minutes.
          </p>
          <Link to={cta} className="btn btn-primary btn-lg">
            Create Your {name} Chatbot <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
