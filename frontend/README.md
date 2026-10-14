# Site2Chat frontend

React + Vite + TypeScript app for the Site2Chat API.

## Setup

```bash
cd frontend
cp .env.example .env   # fill in the Supabase values
npm install
npm run dev            # http://localhost:5173
npm run build          # production build in dist/
npm run preview
```

Environment variables (all public, none are secrets):

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend base URL, e.g. `https://site2chat-api.onrender.com` |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key. Never use a secret or service-role key here. |

## Deploying

Full dashboard settings (custom SMTP, branded email templates, redirect URLs, Render/Vercel variables, database RLS)
are in [`../docs/supabase-setup.md`](../docs/supabase-setup.md).

- Serve `dist/` as a single-page app: every path (`/chat/:id`, `/dashboard`, …) must fall back to `index.html`.
  On Vercel, `vercel.json` in this folder does that (set the project's Root Directory to `frontend`).
- Set **`FRONTEND_ORIGINS`** on the Render backend to the exact deployed frontend origin
  (comma-separated for several, e.g. `https://app.example.com`) and redeploy the backend. Without it, browsers
  block calls from the deployed frontend. `http://localhost:5173` is the default for local development.
- In Supabase → Authentication → URL Configuration, set **Site URL** to the deployed origin and add
  `https://<your-origin>/**` (or at least `/auth/confirm` and `/forgot-password`) to **Redirect URLs**.
  Confirmation emails return to `/auth/confirm`; password-reset emails return to `/forgot-password`.
- Keep "Confirm email" enabled. The confirmation template should use `{{ .ConfirmationURL }}`.
- Supabase's built-in email sender is for testing only: it is heavily rate-limited and may only deliver to
  your project team's addresses. For real users, configure **Authentication → SMTP Settings** with your own provider.
- On Render, `SUPABASE_URL` must be exactly `https://<project-ref>.supabase.co` (no path, https). The API checks logins
  against `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`; if that request fails it answers 503
  "Authentication service is temporarily unavailable."

## Embedding

The dashboard's **Share** panel generates the snippet. `public/widget.js` renders a floating launcher in a
Shadow DOM and opens `/chat/:chatbotId?embed=1` in an iframe, so the host site's CSS is unaffected.
