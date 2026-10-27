# Theng Seangheng - Portfolio (React + Vite + Express API + Supabase)

Original portfolio (all pages, images, animations, styling kept) upgraded with:
Bakong KHQR tips with server-side verification, Resend contact form, Google-only admin sign-in,
admin dashboard (projects, certificates, comments, messages, payments, settings, translations),
EN / ខ្មែរ toggle, and a complete Supabase schema with row-level security.

> **Honest status:** see [Known gaps](#known-gaps) and [What was and was not tested](#what-was-and-was-not-tested) before deploying.

## Architecture

```
Browser (React/Vite)  --/api-->  Express API (server/, api/)  -->  Supabase (service role), Resend, Bakong Open API
        |                                                              
        +--- Supabase JS (anon key + user JWT) --> tables/storage protected by RLS (public.is_admin())
```

- `src/` - the original React app, extended (not replaced).
- `server/` - Express API: contact (Resend), Bakong QR create / status / cancel, admin test. **All secrets live here.**
- `api/index.js` - Vercel serverless entry that mounts the same Express app.
- `supabase/schema.sql` - tables, indexes, constraints, RLS, storage buckets, seed data.
- `supabase/original-setup.sql` - your previous SQL, kept for reference only.

Every `/api/*` response is JSON (including 404/500). The frontend wrapper `src/utils/api.js` also handles empty or HTML
responses with a readable message. This fixes `Failed to execute 'json' on 'Response': Unexpected end of JSON input`
(see Troubleshooting for the causes).

## 1. Prerequisites (Windows + VS Code)

1. Node.js **20.6 or newer** (LTS from https://nodejs.org) - check with `node -v`.
2. VS Code + Git (optional but recommended).
3. Free accounts: Supabase, Google Cloud, Resend, and a Bakong Open API account (NBC).

## 2. Install and run

```powershell
cd Portofolio_V5-main
copy .env.example .env      # then edit .env (see section 3)
npm install
npm run dev                 # starts API on :3001 and Vite on :5173
```

Open http://localhost:5173. `npm run dev` runs BOTH servers; the browser only talks to Vite, which proxies `/api` to Express.
Other commands: `npm run lint`, `npm test`, `npm run build`, `npm run server` (API only), `npm run dev:web` (Vite only).

## 3. Environment variables (`.env`, never commit it)

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL`, `SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | same page, `anon` / publishable key (public by design, protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role` key. **Secret.** Server only |
| `ADMIN_EMAIL` | the one Google account allowed in the dashboard |
| `SITE_URL` | `http://localhost:5173` locally, your domain in production |
| `IP_HASH_SALT` | any long random string |
| `RESEND_API_KEY` | https://resend.com/api-keys |
| `RESEND_FROM_EMAIL` | `Portfolio <onboarding@resend.dev>` for tests, or an address on a domain verified in Resend |
| `CONTACT_TO_EMAIL` | where messages are delivered (`Seangheng2006@gmail.com`) |
| `BAKONG_MODE` | `sandbox` or `production` |
| `BAKONG_API_BASE_URL` | optional; defaults to NBC sandbox / production host for the chosen mode |
| `BAKONG_API_TOKEN` | Bakong Open API portal after registering (tokens expire; renew when needed) |
| `BAKONG_ACCOUNT_ID` | your Bakong account id, format `name@bank` |
| `BAKONG_MERCHANT_NAME/CITY/MOBILE_NUMBER` | QR recipient details (name max 25 chars) |

Startup validation: `npm run server` refuses to start if `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` or `SITE_URL`
are missing, and prints which Resend/Bakong variables are missing (those features then answer `503 not_configured` as JSON).
`GET /api/health` lists missing variable **names** (never values).

## 4. Database (Supabase)

1. Create a project at https://supabase.com.
2. SQL Editor > New query > paste all of `supabase/schema.sql` > **Run**. It is idempotent (safe to re-run).
3. It creates tables (`projects`, `certificates`, `tech_stack`, `profile_entries`, `site_settings`, `translations`,
   `portfolio_comments`, `contact_submissions`, `payments`, legacy `profiles`), indexes, constraints, RLS policies,
   storage buckets (`profile-images`, `project-images`, `certificate-images`, `site-assets`, `cv-files`) and seeds your two
   existing projects (Spotify repo = `https://github.com/heng604/Spotify-ESP32.git`).
4. Authentication > Providers > **Email**: turn OFF "Enable sign ups" / disable the provider so Google is the only way in.

## 5. Google OAuth (admin sign-in)

1. Google Cloud Console > APIs & Services > OAuth consent screen (External, add your email as test user).
2. Credentials > Create credentials > OAuth client ID > Web application.
   Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (copy it from Supabase > Authentication > Providers > Google).
3. Paste Client ID and Client Secret into Supabase > Authentication > Providers > Google > Enable.
4. Supabase > Authentication > URL Configuration: Site URL = your `SITE_URL`; add `http://localhost:5173/**` and your production URL under Redirect URLs.
5. Visit `/login`, sign in with `Seangheng2006@gmail.com`.

**Access rules:** not signed in -> `/login`; signed in with any other account -> 404-style page;
the admin e-mail -> dashboard. The decision is made by the API (`/api/admin/me`) **and** by database RLS; the browser never compares e-mails.

### Where the admin email lives (change ALL of these together)

| # | File / place | What to change |
|---|---|---|
| 1 | `supabase/schema.sql`, function `public.is_admin()` (line marked `-- <== ADMIN EMAIL`) | replace the e-mail literal, re-run that `create or replace function` in the SQL editor. All table policies and all storage policies call this one function, so they follow automatically |
| 2 | `.env` / hosting env var `ADMIN_EMAIL` | same address (server-side API gate) |
| 3 | `.env.example` | documentation only |

Then sign out and sign in with the new Google account. No frontend file contains the admin e-mail.

## 6. Resend (contact form)

1. Create an API key -> `RESEND_API_KEY`.
2. Quick test: keep `RESEND_FROM_EMAIL=Portfolio <onboarding@resend.dev>`; Resend only delivers to the e-mail you signed up to Resend with.
3. Production: verify a domain in Resend, then use an address on it.
4. The form (name, email, subject, message) is validated and sanitised on the server, honeypot-protected, limited to
   3 requests/min/IP (memory) and 5 messages/hour/visitor (database), de-duplicated (same message within 10 min = 409), stored in
   `contact_submissions` (admin-only) and sent with `reply-to` = visitor. If e-mail fails the message is still stored and the visitor sees an error.

## 7. Bakong KHQR tips

1. Register at the NBC Bakong Open API portal, obtain a token, and note your Bakong account id.
2. Set `BAKONG_*` in `.env`. Start with `BAKONG_MODE=sandbox`.
3. Dashboard > Settings > "Bakong recipient": Latin name (<=25 chars), Khmer name shown on the card, min/max amounts, on/off.
4. Flow: visitor picks USD/KHR and amount -> `POST /api/bakong/create` builds a real KHQR with the official `bakong-khqr` SDK
   (dynamic QR with amount, currency, expiry, bill number) -> the page shows the QR in the red-header Bakong card and polls
   `GET /api/bakong/status/:id` every 4 s (backs off on errors, pauses in hidden tabs).
5. The server calls the Bakong Open API (`check_transaction_by_md5`) with the **server-side token**. A payment becomes `paid` only if a transaction
   is found AND recipient, currency and amount match. A Bakong transaction hash can settle only one payment (unique constraint),
   so duplicates are rejected. The green-check success modal appears only after the server reports `paid`.
6. States handled: pending, paid, expired (QR validity `BAKONG_QR_EXPIRES_MINUTES`), cancelled, failed (mismatch/duplicate), network errors, invalid amounts.
7. Dashboard > Payments > **Test Bakong**: "Generate test QR" creates a real KHQR flagged as a test (still verified through the real API);
   "Preview states" buttons are clearly labelled **SIMULATED UI PREVIEW - NOT A PAYMENT**. Sandbox payments are labelled TEST MODE on the public page.

## 8. Dashboard (`/login` -> `/dashboard`)

Projects (create/edit/image upload/publish-unpublish/reorder/delete with confirmation), Certificates, Comments (pin/delete),
Messages (search, filter, read/unread, reply, delete), Payments (search, filters, test panel), Settings (hero text, contact details,
social links, CV upload, SEO, Bakong recipient, general), Translations (EN/KM overrides). Uploads: drag-and-drop with type/size validation,
preview, stored in Supabase Storage buckets with enforced MIME and size limits.

## 9. Deployment

**Vercel (recommended, files already included):** import the repo, add every variable from `.env.example` in Project Settings > Environment Variables,
deploy. `vercel.json` rewrites `/api/*` to the Express function and everything else to the SPA. Set `SITE_URL` to your production URL.

**Any Node host / VPS:** `npm run build`, serve `dist/` with a web server that proxies `/api` to `npm run server` (port `PORT`).

Production checklist: `BAKONG_MODE=production` + production token/base URL, verified Resend domain, Supabase redirect URLs, Email provider disabled.

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Unexpected end of JSON input` | The browser called `/api/...` and got an empty body. Typical causes: API server not running (use `npm run dev`, not `npm run dev:web`); host rewriting `/api` to `index.html` (use the included `vercel.json`); an old build calling a route that does not exist. With this version the API always answers JSON and the UI shows the real reason |
| `503 not_configured` + `missing: [...]` | Fill those variables in `.env`, restart `npm run dev` |
| Tips: "Bakong rejected the request" | Token invalid/expired, wrong base URL for the chosen mode, or the host's IP is blocked by Bakong (some deployments report the API only accepts Cambodian IPs; if so run the API on a Cambodian VPS). Verify against current NBC docs |
| Tips: "Could not create the payment record" | `supabase/schema.sql` not run, or wrong `SUPABASE_SERVICE_ROLE_KEY` |
| QR does not scan | Use the account id exactly as shown in your banking app; KHR must be whole numbers; recipient name <= 25 chars |
| Contact: "email could not be delivered" | Resend key wrong, or `onboarding@resend.dev` used with a recipient that is not your Resend account e-mail |
| Signed in but see a 404 page | Not the admin e-mail (`ADMIN_EMAIL` and `public.is_admin()`), or API unreachable |
| Google login loops back | Supabase redirect URLs / Google redirect URI mismatch |
| Projects missing after unpublishing all | The built-in local projects are only a fallback when the database returns zero rows |

## Known gaps

Being explicit about what is **not** finished in this delivery:

- **Public page text is not fully translated.** The EN/ខ្មែរ toggle and persistence work, and navbar, contact form, tips, footer, login and dashboard labels are translated.
  The existing Home, About, Portfolio, Experience text is still the original hard-coded text and does not switch language yet.
- **No admin CRUD yet** for About / Experience / Education / Tech stack (database tables `profile_entries` and `tech_stack` exist with RLS, but no forms or public wiring), and no hero-text wiring: `hero.*` settings are stored but Home.jsx still uses its original text.
  Settings that ARE wired to the public site: CV link, social URLs (Facebook, Instagram, GitHub), SEO title/description/image, all Bakong settings.
- The social links card has no Telegram entry; your Telegram link is stored as a setting only.
- The existing GitHub link on the site is `github.com/heng604`; you gave `lotoshi287-cell` as your username - the original link was kept. Change it in Dashboard > Settings.
- Comments, Certificates dashboards are the originals (certificates still come from `src/data/certificates.js` on the public page).
- Rate limiting for tips/status is in-memory per server instance; contact limits are database-backed.

## What was and was not tested

See the delivery notes in the chat. In short: server pure logic has unit tests (`npm test`), all JS/JSX parses. `npm install`, `npm run build`, `npm run lint`,
SQL execution, Google sign-in, Resend delivery and real Bakong transactions were **not** run in the build environment (no network access).
