import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import AuthConfirm from "./pages/AuthConfirm";
import Dashboard from "./pages/Dashboard";
import Create from "./pages/Create";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import { useAuth } from "./lib/auth";
import { authCallback } from "./lib/supabase";

/**
 * If an email link lands on a route that doesn't handle it (for example Supabase falls back to the
 * Site URL because the requested redirect isn't on its allow-list), forward to the right screen
 * once the session has been processed.
 */
function CallbackRedirect() {
  const { loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !authCallback.isCallback) return;
    const target = authCallback.type === "recovery" ? "/forgot-password" : "/auth/confirm";
    if (pathname !== target) navigate(target, { replace: true });
  }, [loading]); // intentionally runs once, when auth finishes loading

  return null;
}

export default function App() {
  return (
    <>
      <CallbackRedirect />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/chat/:chatbotId" element={<Chat />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<Create />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
