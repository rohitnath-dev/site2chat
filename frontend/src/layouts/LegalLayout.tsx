import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/ui";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";

/** Shell for static informational pages (privacy, terms, contact). */
export default function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const { session } = useAuth();

  useEffect(() => {
    document.title = `${title} · Site2Chat`;
    window.scrollTo(0, 0);
  }, [title]);

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
            <Link to="/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
          )}
        </nav>
      </header>
      <main className="shell-main">
        <article className="container prose">
          <h1 className="display">{title}</h1>
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
