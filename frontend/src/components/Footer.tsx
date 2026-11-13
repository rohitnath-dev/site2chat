import { Link } from "react-router-dom";
import { ExternalLink, Rocket } from "lucide-react";
import { Brand } from "./ui";
import { OPERATOR_NAME } from "../lib/site";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <Brand />
            <p className="muted">Turn a website into a chatbot you can share with a link or embed on your own site.</p>
          </div>
          <nav aria-label="Product" className="footer-col">
            <h2>Product</h2>
            <Link to="/create">Create a chatbot</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/settings">Settings</Link>
          </nav>
          <nav aria-label="Legal" className="footer-col">
            <h2>Legal</h2>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </nav>
          <nav aria-label="Support" className="footer-col">
            <h2>Support</h2>
            <Link to="/contact">Contact us</Link>
          </nav>
        </div>
        <div className="footer-base">
          <span className="footer-copy">
            © {year} Site2Chat{OPERATOR_NAME ? ` · operated by ${OPERATOR_NAME}` : ""}
          </span>
          <a
            href="https://megalaun.ch/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-badge"
            aria-label="Featured on MegaLaunch (opens in a new tab)"
          >
            <Rocket size={16} aria-hidden="true" />
            <span>
              Featured on <strong>MegaLaunch</strong>
            </span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <span className="footer-note">AI answers can be wrong. Check anything important.</span>
        </div>
      </div>
    </footer>
  );
}
