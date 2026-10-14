# Supabase, Render and Vercel setup for Site2Chat

Settings that live in dashboards and cannot be changed from the repository. Dashboard menus move around between
releases, so where a path below looks different, search the Supabase dashboard for the setting name.

## 1. Reliable confirmation emails (custom SMTP)

Supabase's built-in email sender is meant for trying things out. It has a very low hourly sending cap and may only
deliver to addresses belonging to your project team. When it is exhausted, sign-up either fails with
`email rate limit exceeded` or appears to succeed while nothing arrives. Public sign-ups need your own SMTP provider.

1. Pick a transactional email provider (for example Resend, Postmark, Brevo or SendGrid) and create an account.
2. **Verify a sending domain you control** with that provider. This means adding the DNS records it gives you
   (SPF, DKIM, and ideally DMARC). Without a verified domain, most providers refuse to send from your address or the mail
   lands in spam. Do not use an address on a domain you haven't verified.
3. In Supabase open **Authentication → Emails → SMTP Settings** (older dashboards: *Project Settings → Auth → SMTP*)
   and turn on **Enable custom SMTP**. Enter, from your provider's SMTP page:

   | Field | Value |
   | --- | --- |
   | Sender email | an address on your verified domain, e.g. `no-reply@YOUR-VERIFIED-DOMAIN` |
   | Sender name | `Site2Chat` |
   | Host | provided by your provider |
   | Port | provided by your provider (commonly 465 or 587) |
   | Username / Password | provided by your provider. Keep them secret; never put them in this repository |

4. **Authentication → Rate Limits:** after custom SMTP is on, the email-sending limit can be raised. Set it to what
   you realistically expect. Keep the per-user minimum interval (about 60 seconds) so resend can't be abused.
5. Send yourself a test sign-up with an address at a different provider (Gmail, Outlook) and check inbox *and* spam.

The sender display name is only "Site2Chat" in the email client once step 3 is saved.

## 2. Branded email templates

**Authentication → Emails → Templates.** Paste the HTML and set the subject for each:

| Template | Subject | Body to paste |
| --- | --- | --- |
| Confirm signup | `Confirm your Site2Chat account` | [`email-templates/confirm-signup.html`](email-templates/confirm-signup.html) |
| Reset password | `Reset your Site2Chat password` | [`email-templates/reset-password.html`](email-templates/reset-password.html) |

Both keep Supabase's `{{ .ConfirmationURL }}` link (do not replace it; it carries the one-time token), show a button
and a plain fallback link, and explain why the email was received. They use only Supabase's own variables and no
external images or fonts, so they render consistently in most mail clients. Send a test of each before relying on it.

## 3. URL configuration

**Authentication → URL Configuration**

- **Site URL:** `https://site2chat.vercel.app` (your real frontend origin, no trailing path)
- **Redirect URLs:** add `https://site2chat.vercel.app/**` (at minimum `/auth/confirm` and `/forgot-password`)

Keep **Confirm email** switched **on** (Authentication → Sign In / Providers → Email).

## 4. JWT signing keys

The API verifies logins using the project's public signing keys (`/auth/v1/.well-known/jwks.json`) and accepts
ES256/RS256 tokens. If the project still uses the legacy shared JWT secret, that endpoint publishes no keys and every
login check fails. In **Project Settings → JWT Keys** (or *API → JWT Settings*), switch to JWT signing keys.

## 5. Render (API service `site2chat-api`)

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | exactly `https://<project-ref>.supabase.co`: https, no path, no trailing text |
| `FRONTEND_ORIGINS` | `https://site2chat.vercel.app` (comma-separate several; no `*`) |
| `DATABASE_URL`, `GROQ_API_KEY`, `OPENROUTER_KEY_ENCRYPTION_KEY` | already required by the API |

After the API redeploys, open **`https://site2chat-api.onrender.com/api/v1/health/auth`**. It reports, without
exposing secrets, whether the server can fetch Supabase's signing keys:

```json
{ "status": "ok", "supabase_configured": true, "jwks_reachable": true, "jwks_http_status": 200, "jwks_key_count": 1, "failure": null }
```

If `status` is `error`, `failure` says why (wrong path, redirect, refused, timeout, or no keys). Failures during real
requests are also logged by the API as `Supabase JWKS fetch failed: …` and database failures as `Database error on …`.
Both are visible in the Render **Logs** tab.

## 6. Vercel (frontend)

- Root Directory `frontend`, framework Vite (`vercel.json` already rewrites every path to `index.html`).
- Environment variables (changing them requires a redeploy, since Vite bakes them in at build time):
  `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` (origin only), `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Optional: `VITE_SUPPORT_EMAIL` and `VITE_OPERATOR_NAME`. Until these are set, the Contact, Privacy and Terms pages
  show "to be provided" markers instead of invented details.

## 7. Database access (RLS)

The migrations create the tables with plain SQL, so Row Level Security is **off** unless you enabled it. Supabase
exposes the `public` schema through its Data API, and the publishable key is visible in the website's code, so
tables without RLS may be readable or writable by anyone. Site2Chat only ever reaches the database through its own API,
so the safe setup is RLS on with no policies.

1. **Dashboard → Advisors → Security** lists "RLS disabled in public" for each exposed table. You can also run:
   ```sql
   select c.relname, c.relrowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
   ```
2. Confirm the role in your `DATABASE_URL` (the user part, usually `postgres` or `postgres.<project-ref>`) bypasses RLS.
   Otherwise enabling RLS would block the API itself:
   ```sql
   select rolname, rolbypassrls, rolsuper from pg_roles where rolname = 'postgres';
   ```
3. Enable RLS:
   ```sql
   alter table public.chatbots              enable row level security;
   alter table public.website_pages         enable row level security;
   alter table public.document_chunks       enable row level security;
   alter table public.conversations         enable row level security;
   alter table public.messages              enable row level security;
   alter table public.user_llm_credentials  enable row level security;
   alter table public.alembic_version       enable row level security;
   ```
4. Immediately test: load the dashboard and create a chatbot. If the API starts failing, roll back with
   `alter table … disable row level security;` and check the role from step 2.

## 8. Manual checks after changing anything

1. `/api/v1/health/auth` returns `"status": "ok"`.
2. Sign up with a fresh address → check-email screen → email arrives (inbox or spam) with the Site2Chat template →
   button opens `/auth/confirm` → "Email confirmed" → dashboard loads without a warning.
3. Create a chatbot end to end; if it fails, read the Render logs for `Database error on …` or the ingest error.
4. Open the hosted chat link and send a message.
