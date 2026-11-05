import { Link } from "react-router-dom";

interface RelatedArticlesProps {
  currentCategory?: "competitor" | "platform" | "use-case" | "faq";
  currentSlug?: string;
}

const platforms = [
  { slug: "shopify", name: "Shopify" },
  { slug: "wordpress", name: "WordPress" },
  { slug: "webflow", name: "Webflow" },
  { slug: "wix", name: "Wix" },
  { slug: "squarespace", name: "Squarespace" },
  { slug: "nextjs", name: "Next.js" },
  { slug: "html", name: "HTML" },
];

const competitors = [
  { slug: "tidio", name: "Tidio" },
  { slug: "intercom", name: "Intercom" },
  { slug: "drift", name: "Drift" },
  { slug: "manychat", name: "ManyChat" },
  { slug: "chatbot-com", name: "Chatbot.com" },
  { slug: "landbot", name: "Landbot" },
  { slug: "tars", name: "TARS" },
  { slug: "wonderchat", name: "Wonderchat" },
  { slug: "chatbase", name: "Chatbase" },
];

const useCases = [
  { slug: "customer-support", name: "Customer Support" },
  { slug: "ecommerce", name: "E-Commerce" },
  { slug: "lead-generation", name: "Lead Generation" },
  { slug: "saas", name: "SaaS" },
  { slug: "education", name: "Education" },
];

export function RelatedArticles({ currentCategory, currentSlug }: RelatedArticlesProps) {
  return (
    <section className="container" style={{ margin: "48px auto", maxWidth: "960px" }}>
      <div className="card" style={{ padding: "32px" }}>
        <h2 style={{ fontSize: "22px", marginBottom: "20px", fontFamily: "var(--font-sans)" }}>
          Related Resources & Integrations
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
          <div>
            <h3 style={{ fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: "12px" }}>
              Platform Guides
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              {platforms.map((p) => (
                <li key={p.slug}>
                  <Link
                    to={`/for/${p.slug}`}
                    style={{
                      color: currentCategory === "platform" && currentSlug === p.slug ? "var(--text)" : "var(--accent)",
                      fontWeight: currentCategory === "platform" && currentSlug === p.slug ? 700 : 500,
                      textDecoration: "none",
                      fontSize: "14px",
                    }}
                  >
                    AI Chatbot for {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: "12px" }}>
              Comparisons
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              {competitors.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/vs/${c.slug}`}
                    style={{
                      color: currentCategory === "competitor" && currentSlug === c.slug ? "var(--text)" : "var(--accent)",
                      fontWeight: currentCategory === "competitor" && currentSlug === c.slug ? 700 : 500,
                      textDecoration: "none",
                      fontSize: "14px",
                    }}
                  >
                    Site2Chat vs {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: "12px" }}>
              Use Cases & FAQ
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              {useCases.map((u) => (
                <li key={u.slug}>
                  <Link
                    to={`/use-case/${u.slug}`}
                    style={{
                      color: currentCategory === "use-case" && currentSlug === u.slug ? "var(--text)" : "var(--accent)",
                      fontWeight: currentCategory === "use-case" && currentSlug === u.slug ? 700 : 500,
                      textDecoration: "none",
                      fontSize: "14px",
                    }}
                  >
                    {u.name} Chatbot
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/faq"
                  style={{
                    color: currentCategory === "faq" ? "var(--text)" : "var(--accent)",
                    fontWeight: currentCategory === "faq" ? 700 : 500,
                    textDecoration: "none",
                    fontSize: "14px",
                  }}
                >
                  Frequently Asked Questions
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
