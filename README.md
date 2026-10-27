# Theng Seangheng - Portfolio (React + Vite + secure Node API + Supabase)

React/Vite front end (your original portfolio, preserved) + `server/` (Express) for everything that needs secrets:
Bakong KHQR tips, Resend contact email, admin verification. Data/auth/storage: Supabase.

> **Read "Status: what is and is not done" at the bottom before deploying.**

## 1. Prerequisites (Windows + VS Code)
1. Node.js 20+ LTS (https://nodejs.org) - check with `node -v`
2. VS Code (https://code.visualstudio.com) and Git
3. Free accounts: Supabase, Google Cloud, Resend, and a Bakong Open API registration (below)

## 2. Install and run
```powershell
cd Portofolio_V5-main
npm install
copy .env.example .env      # then edit .env (section 7)
npm run dev:all             # web on http://localhost:5173 + API on http://localhost:8787
```
- `npm run dev` = front end only, `npm run dev:server` = API only.
- If the API is not running you will now see a clear message ("Is the API server running?") instead of
  `Failed to execute 'json' on 'Response': Unexpected end of JSON input`.
- The server **refuses to start** if `ADMIN_EMAIL` / `SITE_URL` are missing or a feature group
  (Supabase / Bakong / Resend) is only partly filled in; a fully empty group just disables that feature.

## 3. Database (Supabase)
1. Create a project at https://supabase.com.
2. SQL Editor -> New query -> paste all of `supabase/schema.sql` -> Run. It is safe to re-run.
   It creates tables, indexes, constraints, RLS policies, storage buckets (with size/MIME limits) and seeds the
   Spotify OLED Display ESP32 project.
3. Project Settings -> API: copy the URL, `anon` key and `service_role` key into `.env`.
   The `service_role` key is secret: never put it in a `VITE_` variable.
4. The old `supabase/original-supabase-setup.sql` is your previous script, kept for reference only.
   Do not run it after `schema.sql` (it would not undo anything but is superseded).

## 4. Google OAuth (admin sign-in)
1. https://console.cloud.google.com -> create project -> APIs & Services -> OAuth consent screen (External; add yourself as test user).
2. Credentials -> Create credentials -> OAuth client ID -> Web application.
   Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
3. Copy Client ID + Secret into Supabase -> Authentication -> Providers -> Google -> Enable.
4. Supabase -> Authentication -> URL Configuration: Site URL = your `SITE_URL`; add Redirect URLs
   `http://localhost:5173/**` and your production URL `/**`.
5. Visit `/login` (or click the small lock icon in the footer) and sign in with `Seangheng2006@gmail.com`.

## 5. Where the admin email lives (change ALL of these together)
| # | File | Setting |
|---|------|---------|
| 1 | `.env` (and your hosting provider's env settings) | `ADMIN_EMAIL=` - checked by the server (`server/lib/auth.js`) |
| 2 | `supabase/schema.sql` | function `public.admin_email()` (lowercase) - re-run the file. Every RLS policy (tables + storage) goes through `public.is_admin()`, which uses it |

That is all: there is no email in front-end JavaScript. After changing it, sign out/in. A signed-in user with any
other email gets a 404 page; direct API calls return 404; direct database/storage writes are rejected by RLS.
Note: the old `profiles.role` mechanism is no longer used for authorization.

## 6. Resend (contact form)
1. https://resend.com -> API Keys -> create key -> `RESEND_API_KEY`.
2. Testing: `RESEND_FROM=Portfolio <onboarding@resend.dev>` can only deliver to the email that owns the Resend account
   (so use `Seangheng2006@gmail.com` for the account). Production: verify your domain in Resend -> Domains and use e.g. `Portfolio <contact@yourdomain.com>`.
3. The form validates/sanitizes on the server, has a honeypot, 5 messages/hour/IP limit and a 10-minute duplicate guard.
   Submissions are stored in `contact_submissions` (admin-only) when the service role key is set.

## 7. Bakong KHQR tips
1. Register for the Bakong Open API token at https://api-bakong.nbc.gov.kh (National Bank of Cambodia developer portal) with
   your Bakong account ID; the token arrives by email and **expires - renew it when verification starts failing**.
2. `.env`: `BAKONG_ACCOUNT_ID` (e.g. `yourname@bank`), `BAKONG_MERCHANT_NAME`, `BAKONG_API_BASE_URL`, `BAKONG_API_TOKEN`.
3. `BAKONG_ENV` only controls the **label** (sandbox badge vs production) - it does not switch servers. Point
   `BAKONG_API_BASE_URL` at the environment NBC gave you. Set it to `production` only for real money.
4. How it works: server generates the QR with the official `bakong-khqr` package -> browser shows it -> browser polls
   `/api/bakong/status/:id` every 4 s -> the **server** calls Bakong `POST /v1/check_transaction_by_md5` with the token and
   marks the payment confirmed only if recipient account, currency and amount all match and the transaction hash was not used before.
   The success modal appears only for a server-confirmed payment.
5. Important: the Bakong API commonly rejects requests from non-Cambodian/datacenter IPs (HTTP 403 or empty body). If verification
   fails in production, host the server in Cambodia / on an allowed IP. The server reports this as `bakong_auth`/`bakong_bad_response`.
6. Admin -> Bakong & Payments: config status, **Test Bakong** (real 0.01 USD KHQR + clearly labelled simulated states) and the payment log.
7. Logo: `public/bakong-logo.svg` is a **placeholder**. Replace it with the official Bakong/KHQR asset from NBC.

## 8. Local testing checklist
- `npm run check:server`, `npm run lint`, `npm run build`, `npm test` (after `npm install`).
- Unauthorized admin: sign in with a different Google account -> `/dashboard` shows 404; `curl http://localhost:8787/api/admin/config` -> 401.
- Tip: enter amount -> QR appears -> pay from a banking app -> success modal after the server confirms.

## 9. Deployment
`npm run build` then `npm start` (`NODE_ENV=production`): Express serves `dist/` and `/api` from one origin.
Use Render / Railway / a VPS (or Docker). **Vercel static hosting alone will not work** for tips/contact/admin (no API);
`vercel.json` rewrites everything to `index.html`, which is what produces JSON-parse errors on `/api/*` there.
Set every variable from `.env.example` in the host's environment settings, set `SITE_URL`, and update the Supabase/Google redirect URLs.

## 10. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `Unexpected end of JSON input` / "returned an empty response" | API server not running or proxy cannot reach it: run `npm run dev:all`; check port 8787 |
| "returned a web page instead of JSON" | `/api` is being served by a static host (see Deployment) |
| `bakong_auth` | Token wrong/expired, or server IP blocked by Bakong |
| `bakong_bad_response` | Bakong returned empty/non-JSON (usually IP block) |
| Server exits at start | Read the `[env]` message: missing/partial variables |
| Signed in but 404 on /dashboard | Email is not `ADMIN_EMAIL`, or Google did not mark it verified |
| Admin writes fail with RLS error | Schema not (re)run, or `admin_email()` differs from your Google email |
| Resend 403 / not delivered | Using `onboarding@resend.dev` to an email that is not the Resend account owner |

## 11. Status: what is and is not done (honest list)
**Implemented in code:** server API (Bakong create/status/cancel, Resend contact, admin check); Bakong tip card (red header, dotted
separator, KHQR with centre logo, USD/KHR, pending/expired/cancelled/failed/network states, success modal only after server verification);
Google sign-in + server-verified admin gate + 404 for others + logout; email-based RLS in `schema.sql`; admin pages: Projects (create/edit/delete
existing + NEW publish/unpublish and reorder), Messages, Bakong & Payments (test + log), existing Certificates/Comments; EN/ខ្មែរ toggle with persistence
and DB-overridable translations; Spotify project card pointing at `heng604/Spotify-ESP32`; safe-JSON fixes; `.env.example`, `.gitignore`, SQL.

**Also implemented (second pass):** dashboard pages *Site settings & CV* (CV PDF upload to storage, validated type/size, live download link on the About page; plus
hero/about/experience/education/social/contact/SEO text fields), *Tech stack* (add/publish/delete/search), *Translations* (EN/ខ្មែរ overrides, live on reload).

**Also implemented (third pass - public pages now read the dashboard):**
- Home: hero title, description, typing words, hero image, GitHub/Facebook/Instagram links, SEO title/description.
- About: name, about text, quote, profile photo, CV (all from Site settings). Image fields have an upload button.
- Certificates (public) read the `certificates` table (published, ordered); Tech stack (public) reads `tech_stack` grouped by Category.
  While a table is empty the site shows the built-in list; use **Import built-in certificates / Import built-in stack** once in the
  dashboard to copy them into the database, then edit, hide or delete each item. Icon upload added to Tech stack.
- Empty setting = built-in default, so the site never goes blank.

**NOT done / partial:**
- Experience / education / contact-phone / contact-email / Telegram settings are stored and editable, but no public section renders them yet (the original site has none).
- Khmer/English translation covers navigation, contact, tip, footer, login and 404 strings only.
- Dashboard sidebar labels are English only; no drag-and-drop for tech stack/certificate ordering (sort_order is set on import/insert).

**NOT tested (no network in the build environment):** `npm install`, lint, build, unit tests, Supabase, Google OAuth, Resend delivery, and any
Bakong call - including a live transaction. Nothing here claims a verified live payment. Run the checklist in section 8 on your machine.
