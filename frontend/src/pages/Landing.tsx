import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

export default function Landing() {
  const { session } = useAuth();
  const cta = session ? "/create" : "/signup";

  return (
    <>
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

      <main>
        <section className="container hero">
          <h1 className="display">
            Turn your website into a <em>chatbot</em>
          </h1>
          <p className="lead">
            Paste a link. Site2Chat reads your pages and gives you a chat that answers questions about your site, ready
            to share or embed.
          </p>
          <Link to={cta} className="btn btn-primary btn-lg">
            Create chatbot <ArrowRight size={18} />
          </Link>
        </section>

        <section className="container steps" aria-label="How it works">
          <div className="card step">
            <div className="step-num">1</div>
            <h3>Paste your website</h3>
            <p className="muted">Give us a URL and pick an AI provider. Groq is selected by default.</p>
          </div>
          <div className="card step">
            <div className="step-num">2</div>
            <h3>We read your pages</h3>
            <p className="muted">Your site's content is turned into knowledge the chatbot answers from.</p>
          </div>
          <div className="card step">
            <div className="step-num">3</div>
            <h3>Share or embed it</h3>
            <p className="muted">Send a chat link, or add one line of code to put a chat bubble on your site.</p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
