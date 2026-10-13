import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Plus, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { Brand, ConfigNotice } from "../components/ui";

/** Guards dashboard routes and provides the quiet app chrome. */
export default function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isSupabaseConfigured) return <ConfigNotice />;
  if (loading) {
    return (
      <div className="auth-main" aria-busy="true">
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <>
      <header className="app-header">
        <div className="container nav">
          <Brand to="/dashboard" />
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/dashboard" className="btn btn-ghost btn-sm">
              Dashboard
            </NavLink>
            <NavLink to="/settings" className="btn btn-ghost btn-sm" aria-label="Settings">
              <SettingsIcon size={16} />
              <span className="btn-label-hide">Settings</span>
            </NavLink>
            <Link to="/create" className="btn btn-primary btn-sm" aria-label="Create chatbot">
              <Plus size={16} aria-hidden="true" />
              <span className="btn-label-hide" aria-hidden="true">
                Create chatbot
              </span>
            </Link>
            <button
              className="icon-btn"
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut size={17} />
            </button>
          </nav>
        </div>
      </header>
      <main className="page">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </>
  );
}
