import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, AlertCircle, CheckCircle2, Bot, Clock, ShieldCheck, Zap } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { RelatedArticles } from "../components/RelatedArticles";
import { useAuth } from "../lib/auth";

export const useCases = [
  "customer-support",
  "ecommerce",
  "lead-generation",
  "saas",
  "education",
] as const;

const useCaseDetails: Record<
  string,
  { name: string; problem: string; solution: string }
> = {
  "customer-support": {
    name: "Customer Support",
    problem:
      "Customer support teams are constantly overwhelmed with repetitive tier-1 inquiries regarding shipping times, business hours, and refund policies. Human agents experience burnout, ticket queues back up, and customers grow frustrated waiting hours for basic answers.",
    solution:
      "Site2Chat reads your public help center, knowledge base, and FAQ pages to deliver instant, accurate responses 24/7. Grounded strictly in your website content, it deflects up to 70% of routine questions, allowing your human team to focus on high-value issues.",
  },
  ecommerce: {
    name: "E-Commerce",
    problem:
      "Shoppers frequently abandon carts and leave online stores when they cannot quickly find sizing information, shipping estimates, or return policies. Staffing 24/7 live chat agents across global timezones is prohibitively expensive.",
    solution:
      "Site2Chat crawls your product catalogs, warranty details, and purchasing policies to serve as an instant on-site shopping assistant. It guides buyers, resolves purchasing hesitations in real time, and helps increase sales conversion rates without extra staff.",
  },
  "lead-generation": {
    name: "Lead Generation",
    problem:
      "Static lead capture forms convert poorly because modern visitors want instant answers before submitting contact details. Marketing ad spend is wasted when interested visitors bounce without interacting.",
    solution:
      "Site2Chat engages website visitors conversationally the moment they land on your site. By delivering immediate answers to pricing and feature queries, it naturally builds trust and captures high-intent qualified leads directly into your pipeline.",
  },
  saas: {
    name: "SaaS",
    problem:
      "Software onboarding suffers high drop-off when new users get stuck on complex documentation, API questions, or configuration setups. Engineering and support teams lose hours repeating explanations.",
    solution:
      "Site2Chat transforms your API docs, user manuals, and changelogs into an interactive AI copilot. New signups get instant answers to technical questions directly inside your app, slashing onboarding friction and churn.",
  },
  education: {
    name: "Education",
    problem:
      "Schools, universities, and online courses receive thousands of repetitive questions regarding admissions criteria, tuition costs, schedules, and curriculum details, overloading administrative personnel.",
    solution:
      "Site2Chat indexes course catalogs, syllabus pages, and campus guidelines to act as a 24/7 student advisor. Students and applicants get immediate answers anytime, streamlining the enrollment process and improving student experience.",
  },
};

export function formatUseCaseName(slug?: string): string {
  if (!slug) return "Your Business";
  const key = slug.toLowerCase();
  if (useCaseDetails[key]) return useCaseDetails[key].name;
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default function UseCase() {
  const { case: caseParam } = useParams<{ case: string }>();
  const { session } = useAuth();
  const slug = caseParam || "customer-support";
  const details = useCaseDetails[slug.toLowerCase()] || {
    name: formatUseCaseName(slug),
    problem:
      "Teams lose precious hours manually replying to repetitive inquiries, causing long customer wait times and lost business opportunities.",
    solution:
      "Site2Chat instantly indexes your website content to provide an automated, 24/7 chatbot that answers questions accurately and captures leads around the clock.",
  };
  const name = details.name;

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
          <h1 className="display" style={{ maxWidth: "20ch" }}>
            AI Chatbot for {name}: Automate Support and Capture Leads
          </h1>
          <p className="lead" style={{ maxWidth: "56ch" }}>
            Supercharge your {name} workflow. Site2Chat indexes your website documentation, knowledge base, and product
            pages to deliver fast, 24/7 grounded answers to every visitor inquiry.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <Link to="/" className="btn btn-primary btn-lg">
              Try Site2Chat Free <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: "48px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
              marginBottom: "40px",
            }}
          >
            <div className="card" style={{ padding: "32px", borderLeft: "4px solid var(--danger, #ef4444)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <AlertCircle size={22} color="var(--danger, #ef4444)" />
                <h2 style={{ fontSize: "22px", margin: 0, fontFamily: "var(--font-sans)" }}>The Problem</h2>
              </div>
              <p style={{ color: "var(--text-muted)", lineHeight: "1.7", margin: 0, fontSize: "16px" }}>
                {details.problem}
              </p>
            </div>

            <div className="card" style={{ padding: "32px", borderLeft: "4px solid var(--accent, #16a34a)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <CheckCircle2 size={22} color="var(--accent, #16a34a)" />
                <h2 style={{ fontSize: "22px", margin: 0, fontFamily: "var(--font-sans)" }}>The Solution</h2>
              </div>
              <p style={{ color: "var(--text-muted)", lineHeight: "1.7", margin: 0, fontSize: "16px" }}>
                {details.solution}
              </p>
            </div>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: "48px" }}>
          <h2 style={{ textAlign: "center", fontSize: "28px", marginBottom: "36px", fontFamily: "var(--font-sans)" }}>
            Why Site2Chat for {name}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
                How Site2Chat Solves {name} in 3 Steps
              </h2>
            </div>
            <ul style={{ paddingLeft: "20px", lineHeight: "1.8", color: "var(--text-muted)", margin: 0 }}>
              <li>
                <strong>1. Automated URL Scraping:</strong> Enter your domain, and Site2Chat automatically indexes up to 100 pages of products, guides, and FAQs.
              </li>
              <li>
                <strong>2. Strict Retrieval-Augmented Generation:</strong> Knowledge chunks and vector embeddings prevent hallucinations by strictly using your site facts.
              </li>
              <li>
                <strong>3. Embed in 2 Minutes:</strong> Copy the 1-line script tag and add it to your website to deploy 24/7 instant chat.
              </li>
            </ul>
          </div>
        </section>

        <RelatedArticles currentCategory="use-case" currentSlug={slug} />

        <section className="container" style={{ textAlign: "center", paddingBottom: "72px" }}>
          <h2 className="display" style={{ fontSize: "32px", marginBottom: "16px" }}>
            Automate {name} with Site2Chat today
          </h2>
          <p className="muted" style={{ maxWidth: "44ch", margin: "0 auto 24px" }}>
            Turn your site pages into an active AI assistant in less than 2 minutes.
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
