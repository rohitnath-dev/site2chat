import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { RelatedArticles } from "../components/RelatedArticles";
import { useAuth } from "../lib/auth";

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    question: "How long does it take to set up Site2Chat?",
    answer: "2 minutes.",
  },
  {
    question: "Can I train the chatbot on my own website content?",
    answer: "Yes, it scrapes your URL.",
  },
  {
    question: "Does it work on Shopify and WordPress?",
    answer: "Yes, works on any platform with a 3-line embed code.",
  },
  {
    question: "Is Site2Chat free?",
    answer: "Yes, free tier available.",
  },
];

export default function Faq() {
  const { session } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  useEffect(() => {
    const pageTitle = "Frequently Asked Questions · Site2Chat";
    const pageDesc =
      "Frequently Asked Questions about Site2Chat. Learn how long setup takes, how website training works, platform compatibility, and pricing.";
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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

        <RelatedArticles currentCategory="faq" />

        <section className="container" style={{ textAlign: "center", paddingBottom: "72px" }}>
          <h2 className="display" style={{ fontSize: "32px", marginBottom: "16px" }}>
            Ready to get started?
          </h2>
          <p className="muted" style={{ maxWidth: "44ch", margin: "0 auto 24px" }}>
            Create your chatbot in 2 minutes and test it with verified answers from your site.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-primary btn-lg">
              Try Site2Chat Free <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
