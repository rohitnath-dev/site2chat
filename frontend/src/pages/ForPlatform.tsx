import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Code, Sparkles, Globe } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

export const platforms = [
  "shopify",
  "wordpress",
  "webflow",
  "wix",
  "squarespace",
  "nextjs",
  "html",
] as const;

const platformDetails: Record<
  string,
  { name: string; instructions: string; location: string }
> = {
  shopify: {
    name: "Shopify",
    instructions:
      "In Shopify Admin, navigate to Online Store > Themes. Click the '...' button next to your active theme and click 'Edit code'. Open layout/theme.liquid, scroll to the bottom, and paste your Site2Chat snippet right before the closing </body> tag. Click Save.",
    location: "Online Store > Themes > Edit code > layout/theme.liquid",
  },
  wordpress: {
    name: "WordPress",
    instructions:
      "In your WordPress Admin Dashboard, navigate to Appearance > Theme File Editor (or use the WPCode plugin). Locate footer.php in the theme files list, and paste the Site2Chat script snippet directly before the closing </body> tag. Click Update File.",
    location: "Appearance > Theme File Editor > footer.php (or WPCode plugin)",
  },
  webflow: {
    name: "Webflow",
    instructions:
      "From your Webflow Dashboard, open Project Settings and click the Custom Code tab. Locate the 'Footer Code' field (code before the closing </body> tag). Paste your Site2Chat embed snippet and click Save Changes, then publish your site.",
    location: "Project Settings > Custom Code > Footer Code",
  },
  wix: {
    name: "Wix",
    instructions:
      "Go to your Wix Dashboard and select Settings > Custom Code (under Advanced). Click '+ Add Custom Code', paste your Site2Chat embed snippet, select 'All Pages', choose 'Place Code in: Body - end', and click Apply.",
    location: "Settings > Advanced > Custom Code (Body - end)",
  },
  squarespace: {
    name: "Squarespace",
    instructions:
      "In your Squarespace dashboard, navigate to Website > Website Tools > Code Injection (or Settings > Advanced > Code Injection). Scroll down to the 'Footer' section, paste the Site2Chat script snippet, and click Save.",
    location: "Website > Website Tools > Code Injection > Footer",
  },
  nextjs: {
    name: "Next.js",
    instructions:
      "In your Next.js application, open app/layout.tsx (or pages/_document.tsx). Import Script from 'next/script' and include <Script src='https://site2chat.vercel.app/widget.js' data-chatbot-id='YOUR_CHATBOT_ID' strategy='afterInteractive' /> right before the closing </body> tag.",
    location: "app/layout.tsx (or pages/_document.tsx)",
  },
  html: {
    name: "HTML",
    instructions:
      "Open your website index.html or base template in any code editor. Scroll to the bottom of the document and paste the Site2Chat <script> tag right before the closing </body> tag. Save the file and deploy.",
    location: "index.html (before </body>)",
  },
};

export function formatPlatformName(slug?: string): string {
  if (!slug) return "Your Website";
  const key = slug.toLowerCase();
  if (platformDetails[key]) return platformDetails[key].name;
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default function ForPlatform() {
  const { platform } = useParams<{ platform: string }>();
  const { session } = useAuth();
  const slug = platform || "html";
  const platformInfo = platformDetails[slug.toLowerCase()] || {
    name: formatPlatformName(slug),
    instructions: `Paste your Site2Chat embed script tag right before the closing </body> tag in your ${formatPlatformName(slug)} theme or template settings.`,
    location: `${formatPlatformName(slug)} theme or footer settings`,
  };
  const name = platformInfo.name;

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to Add an AI Chatbot to ${name} in 2 Minutes`,
    description: `Step-by-step tutorial on how to install and embed a custom AI chatbot on ${name} in 2 minutes.`,
    totalTime: "PT2M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Paste URL",
        text: `Enter your ${name} website URL into Site2Chat. Site2Chat will automatically crawl and train on your website content.`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Copy embed code",
        text: "Copy your generated 1-line script embed code snippet from the Site2Chat dashboard.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: `Paste in ${name}`,
        text: platformInfo.instructions,
      },
    ],
  };

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
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
        <section className="container hero">
          <h1 className="display" style={{ maxWidth: "18ch" }}>
            How to Add an AI Chatbot to {name} in 2 Minutes
          </h1>
          <p className="lead" style={{ maxWidth: "54ch" }}>
            Give your {name} visitors 24/7 instant answers about your products, services, and documentation. No
            coding or manual training required.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <Link to="/" className="btn btn-primary btn-lg">
              Try Site2Chat Free <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: "48px" }}>
          <h2 style={{ textAlign: "center", fontSize: "28px", marginBottom: "36px", fontFamily: "var(--font-sans)" }}>
            3-Step Guide: Paste URL → Copy embed code → Paste in {name}
          </h2>
          <div className="steps" aria-label="3-step guide">
            <div className="card step">
              <div className="step-num">1</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Globe size={18} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>Paste URL</h3>
              </div>
              <p className="muted">
                Enter your {name} domain into Site2Chat. Site2Chat automatically crawls and indexes your pages,
                extracting clean text from articles, product listings, and support FAQs.
              </p>
            </div>

            <div className="card step">
              <div className="step-num">2</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Sparkles size={18} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>Copy embed code</h3>
              </div>
              <p className="muted">
                Once trained, copy your generated 1-line script embed code snippet from your Site2Chat dashboard.
              </p>
            </div>

            <div className="card step">
              <div className="step-num">3</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Code size={18} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>Paste in {name}</h3>
              </div>
              <p className="muted">
                {platformInfo.instructions}
              </p>
            </div>
          </div>
        </section>

        <section className="container" style={{ maxWidth: "760px", marginBottom: "64px" }}>
          <div className="card" style={{ padding: "28px" }}>
            <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>Platform-Specific Instructions for {name}</h3>
            <p className="muted" style={{ marginBottom: "12px", fontSize: "14px" }}>
              <strong>Setting Location:</strong> {platformInfo.location}
            </p>
            <p className="muted" style={{ marginBottom: "16px", fontSize: "14px" }}>
              {platformInfo.instructions}
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
          <Link to="/" className="btn btn-primary btn-lg">
            Try Site2Chat Free <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
