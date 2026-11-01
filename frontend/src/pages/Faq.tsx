import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "How does Site2Chat create a chatbot from my website?",
    answer:
      "Site2Chat reads public pages from your submitted website (up to 100 pages per crawl). It extracts clean text, splits the content into semantic chunks, and creates vector embeddings. When visitors ask questions, Site2Chat retrieves the most relevant excerpts to ground the AI's answers directly in your site's content.",
  },
  {
    question: "What AI providers and models does Site2Chat support?",
    answer:
      "Out of the box, Site2Chat provides ultra-fast inference via Groq running Llama 3.3 70B Versatile with zero configuration. You can also connect your own OpenRouter API key in Settings to use models like Claude 3.5 Sonnet, GPT-4o, and Gemini 2.5 Flash.",
  },
  {
    question: "How do I embed the chatbot on my website?",
    answer:
      "Simply copy the one-line JavaScript snippet provided in your chatbot's dashboard and paste it right before the closing </body> tag of your website. It works seamlessly on WordPress, Shopify, Webflow, Wix, Squarespace, and custom HTML/React apps.",
  },
  {
    question: "Is there a free tier or trial?",
    answer:
      "Yes! You can create and test your first chatbot completely free without entering a credit card. Ingest your website, test responses in real time, and deploy your widget in minutes.",
  },
];

export default function Faq() {
  const { session } = useAuth();
  const cta = session ? "/create" : "/signup";
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    const pageTitle = "Frequently Asked Questions · Site2Chat";
    const pageDesc =
      "Got questions about Site2Chat? Learn how website ingestion works, supported AI models (Groq, OpenRouter), embedding guides, and pricing.";
    document.title = pageTitle;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", pageDesc);
    window.scrollTo(0, 0);
  }, []);

  const toggleAccordion = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

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
          <h1 className="display" style={{ maxWidth: "16ch" }}>
            Frequently Asked Questions
          </h1>
          <p className="lead" style={{ maxWidth: "52ch" }}>
            Everything you need to know about turning your website into an intelligent AI chatbot.
          </p>
        </section>

        <section className="container" style={{ maxWidth: "780px", marginBottom: "64px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {FAQS.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={index}
                  className="card"
                  style={{
                    padding: "0",
                    overflow: "hidden",
                    border: isOpen ? "1px solid var(--accent)" : "1px solid var(--border)",
                    transition: "border-color 0.2s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(index)}
                    style={{
                      width: "100%",
                      padding: "20px 24px",
                      background: "none",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "var(--text)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "17px",
                      fontWeight: 600,
                    }}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={20}
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        flexShrink: 0,
                        color: isOpen ? "var(--accent)" : "var(--text-faint)",
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: "0 24px 22px",
                        color: "var(--text-muted)",
                        fontSize: "15px",
                        lineHeight: "1.6",
                      }}
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="container" style={{ textAlign: "center", paddingBottom: "72px" }}>
          <h2 className="display" style={{ fontSize: "32px", marginBottom: "16px" }}>
            Still have questions?
          </h2>
          <p className="muted" style={{ maxWidth: "44ch", margin: "0 auto 24px" }}>
            Try it yourself for free or drop us a message anytime.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <Link to={cta} className="btn btn-primary btn-lg">
              Create Your Chatbot <ArrowRight size={18} />
            </Link>
            <Link to="/contact" className="btn btn-ghost btn-lg">
              Contact Support
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
