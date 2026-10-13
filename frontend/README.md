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

- Serve `dist/` as a single-page app: every path (`/chat/:id`, `/dashboard`, …) must fall back to `index.html`.
- Set **`FRONTEND_ORIGINS`** on the Render backend to the exact deployed frontend origin
  (comma-separated for several, e.g. `https://app.example.com`) and redeploy the backend. Without it, browsers
  block calls from the deployed frontend. `http://localhost:5173` is the default for local development.
- In Supabase Auth settings, add the deployed origin to the allowed redirect URLs so email confirmation and
  password-reset links return to the app (`/dashboard` and `/forgot-password`).

## Embedding

The dashboard's **Share** panel generates the snippet. `public/widget.js` renders a floating launcher in a
Shadow DOM and opens `/chat/:chatbotId?embed=1` in an iframe, so the host site's CSS is unaffected.
