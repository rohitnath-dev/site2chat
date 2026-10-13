import { Link } from "react-router-dom";
import { Brand } from "../components/ui";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="container nav">
        <Brand />
      </div>
      <main className="auth-main">
        <div className="empty">
          <h1 className="display" style={{ fontSize: 48, marginBottom: 8 }}>
            Page not found
          </h1>
          <p>That page doesn't exist or has moved.</p>
          <Link to="/" className="btn btn-primary">
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
