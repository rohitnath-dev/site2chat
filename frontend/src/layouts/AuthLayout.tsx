import type { ReactNode } from "react";
import { Brand, ConfigNotice } from "../components/ui";
import { isSupabaseConfigured } from "../lib/supabase";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="container nav">
        <Brand />
      </div>
      {isSupabaseConfigured ? (
        <main className="auth-main">
          <div className="card auth-card fade-in">{children}</div>
        </main>
      ) : (
        <ConfigNotice />
      )}
    </div>
  );
}
