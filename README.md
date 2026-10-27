# Theng Seangheng — Portfolio V5 (secure upgrade)

This repository is an upgrade of the uploaded React/Vite portfolio. It retains the original page/component tree, local project and certificate data, profile photos, certificate images, CV, project images, animations, and existing visual theme. New secure server-side integrations live in `server/`; database setup is in `sql/schema.sql`.

**Identity:** Theng Seangheng · Network Engineer / Computer Networking and Cyber Security  
**Contact:** Seangheng2006@gmail.com · **Telegram:** https://t.me/Theng_seang_heng · **GitHub:** https://github.com/lotoshi287-cell

## Current implementation status

- Preserved original Vite/React application, routes, public assets, sections, existing project/certificate/comment dashboard pages.
- Added Spotify OLED Display ESP32 project metadata with repository link `https://github.com/heng604/Spotify-ESP32.git` (existing project image asset reused).
- Added responsive Bakong tip card and amount/currency input. The center mark is a decorative monogram rather than an official Bakong logo; replace it with a verified official logo asset before production if required. It requests a KHQR from the server and only shows payment success after server-side MD5 transaction lookup confirms the exact amount, currency, recipient and transaction hash. Payment state is pending by default; it can expire and reports verification failures.
- Added an admin-only simulated Bakong status test. It does not call the payment API, generate a real payment, or claim money was received.
- Added Google OAuth button and exact-email checks in the client route and server admin API. Database policies use the authenticated JWT email as the authorization source.
- Replaced third-party FormSubmit contact delivery with a rate-limited server API using Resend; validates fields and stores submissions when service-role database configuration is supplied.
- Added English/Khmer language preference toggle (stored in localStorage), SQL tables for translations and CMS data, and secure RLS/storage policies.
- Added `.env.example`, `.gitignore`, and this setup guide.

**Not yet complete:** the admin CMS does not yet expose CRUD screens for every requested content category (About/Experience/Education, general site text/hero, Tech Stack, translations, social/contact/SEO settings, CV file management, payment logs, and general settings). The EN/ខ្មែរ toggle currently persists the preference and changes document language, but does not yet translate every existing hard-coded public string or dashboard label. Admin CRUD is currently the original Projects, Certificates and Comments pages plus the Bakong test page. These remaining screens/translations are explicitly not represented as completed. Contact spam protection includes server rate limiting and a honeypot; a production CAPTCHA/Turnstile integration is still recommended. Live Bakong verification has not been tested because no credentials were provided.

## Prerequisites

- Node.js 20 LTS or later and npm
- Supabase project with Auth, PostgreSQL and Storage
- Google Cloud OAuth client configured for Supabase Auth
- Resend account and a verified sender domain
- Bakong developer access/token and account ID for the chosen environment

## Windows / VS Code setup

1. Extract the ZIP and open the extracted `Portofolio_V5-main` folder in VS Code.
2. Install dependencies in the integrated terminal:

   ```powershell
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your own values. Never commit `.env`.
4. In Supabase Dashboard → SQL Editor, execute `sql/schema.sql`.
5. Configure Google OAuth and Resend as described below.
6. Start the Vite frontend in one terminal:

   ```powershell
   npm run dev
   ```

7. Start the API in a second terminal:

   ```powershell
   npm run api
   ```

   The frontend is normally at `http://localhost:5173`; API defaults to `http://localhost:8787`. If using separate ports, set `VITE_API_BASE_URL=http://localhost:8787` in `.env` and restart Vite.

8. Run checks:

   ```powershell
   npm run lint
   npm run build
   ```

## Environment variables

| Variable | Purpose / where to obtain it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL → Project Settings → API. Public frontend config. |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key → Project Settings → API. Never use the service-role key here. |
| `SUPABASE_URL` | Same project URL for the backend. |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key used to validate user sessions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-only service role key. Keep secret and never prefix it with `VITE_`. |
| `ADMIN_EMAIL` | Backend's authorized admin email; default `Seangheng2006@gmail.com`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID. Supabase Google provider also needs configuration. These are not read directly by the frontend. |
| `RESEND_API_KEY` | Resend dashboard → API Keys. Server only. |
| `RESEND_FROM_EMAIL` | Sender using a domain verified in Resend, e.g. `Portfolio <contact@yourdomain.com>`. |
| `CONTACT_TO_EMAIL` | Destination inbox, defaults to the admin email. |
| `BAKONG_MODE` | `sandbox` or `production`. Keep `sandbox` until real developer access is verified. |
| `BAKONG_API_BASE_URL` | SIT `https://sit-api-bakong.nbc.gov.kh` or production `https://api-bakong.nbc.gov.kh`. Use the official endpoint assigned for your account. |
| `BAKONG_API_TOKEN` | Bakong Open API token; backend only. Obtain through official Bakong developer onboarding/API documentation. |
| `BAKONG_ACCOUNT_ID` | Your real Bakong account ID/merchant account identifier. |
| `BAKONG_ACCOUNT_NAME` | Exact recipient display name. |
| `BAKONG_MERCHANT_CITY` | KHQR merchant city, e.g. `PHNOM PENH`. |
| `SITE_URL`, `CORS_ORIGIN`, `API_PORT` | Public site URL, allowed frontend origin(s), and local API port. |
| `VITE_API_BASE_URL` | Optional frontend API base URL when API and Vite are hosted on different origins. |

The backend checks configuration when a feature is called so the frontend can still be developed without production credentials. Do not put secrets in SQL rows, Git, frontend code, screenshots, or client-side environment variables.

## Supabase database and storage

Run `sql/schema.sql` in the Supabase SQL Editor. It creates tables, indexes, constraints, RLS policies, and public asset buckets. The schema intentionally restricts contact submissions and payment logs to the administrator/server. Public visitors can read only published projects/certificates/tech-stack entries and approved comments.

### Exact admin email configuration

Change the email in all of these places together:

1. `.env` → `ADMIN_EMAIL` (backend API authorization).
2. `src/components/ProtectedRoute.jsx` → `ADMIN_EMAIL` constant (client routing only; not a security boundary).
3. `src/Pages/Login.jsx` → `ADMIN_EMAIL` constant (login UX only; not a security boundary).
4. `sql/schema.sql` → literal inside `public.is_portfolio_admin()`; rerun the function definition in Supabase SQL Editor after changing it.

The database policy check is the authoritative write restriction for Supabase client operations. The backend also validates the bearer token using Supabase Auth before allowing admin-only API calls. Do not grant admin privileges by editing a public profile row.

## Google OAuth setup

1. In Google Cloud Console, create an OAuth consent screen and OAuth Web client.
2. In Supabase → Authentication → Providers → Google, enable Google and enter the client ID/secret.
3. Add the Supabase callback URL displayed in the provider settings to Google Cloud's authorized redirect URIs.
4. In Supabase → Authentication → URL Configuration, add local and production site URLs.
5. Sign in using `Seangheng2006@gmail.com`. Other accounts must not be granted access by a profile role or client-side flag.

## Resend contact delivery

1. Create a Resend account and verify a sending domain.
2. Create an API key and set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env`.
3. Set `CONTACT_TO_EMAIL=Seangheng2006@gmail.com`.
4. Start the API and submit a test message. The API validates and limits input, rate-limits requests, avoids exposing provider errors, and optionally stores submissions in `contact_submissions` when the server-side service role key is configured.

## Bakong KHQR setup and safety

1. Request official Bakong Open API developer access and use the API base URL/token assigned to your environment.
2. Configure `BAKONG_MODE=sandbox`, `BAKONG_API_BASE_URL`, `BAKONG_API_TOKEN`, `BAKONG_ACCOUNT_ID`, and `BAKONG_ACCOUNT_NAME`.
3. Start both Vite and the API. Generate a tip QR and scan it only with an appropriate supported test wallet/account.
4. The backend stores a unique payment reference and QR MD5, then polls `/v1/check_transaction_by_md5`. It marks success only when the official API returns a transaction with the matching amount, currency, recipient and transaction hash.
5. Keep production mode disabled until you have verified the account and API access. The dashboard test button is a UI simulation only; it does not prove that the live Bakong API works.

API reference: https://api-bakong.nbc.gov.kh/ and official KHQR SDK documentation: https://bakong.nbc.gov.kh/en/ . The SDK integration should be validated against the precise SDK release and account payload required by your Bakong account before production use.

## Deployment

- Deploy the React frontend to a static host (Vercel/Netlify) and deploy `server/index.js` as a Node service with its own environment variables. The backend must be reachable at the configured `VITE_API_BASE_URL`.
- Add production origins to `CORS_ORIGIN` and set `SITE_URL` to the public site.
- Configure Supabase Auth redirect URLs for the production domain.
- Set server secrets only in the host's secret/environment-variable settings.
- Do not use the Supabase service-role key in Vite, static hosting, or browser code.
- For the API, use HTTPS, log redaction, monitoring, and provider-specific production limits.

## Troubleshooting

- **Supabase login fails:** verify project URL/key, provider configuration, redirect URLs, and exact admin email.
- **Admin dashboard returns 404:** the Google account email must match the authorized email exactly; confirm `ADMIN_EMAIL`, `src/Pages/Login.jsx`, `src/components/ProtectedRoute.jsx`, and `public.is_portfolio_admin()` are aligned.
- **CRUD returns permission errors:** execute `sql/schema.sql`, check RLS, and verify the session's email claim. Do not turn off RLS to make it work.
- **Contact form says not configured:** set Resend API key and a verified sender address on the backend.
- **Tip generation unavailable:** check the installed `bakong-khqr` SDK version/API, account identifier format, amount rules, token, and sandbox/production base URL. Never replace a real QR with a made-up QR.
- **Payment stays pending:** check server logs and the official transaction-verification endpoint. A QR being generated does not prove payment. Do not manually change a payment to success without official matching transaction data.
- **Upload fails:** verify bucket names, allowed file types/sizes, admin JWT email and storage RLS policies.

## Original portfolio assets

The original public files are retained, including `public/Photo.png`, `public/Photo.jpeg`, the certificate gallery, `public/THENG_SEANGHENG_CV.pdf`, project imagery, SVG icons, GIF animations, Lottie JSON, sitemap, robots file, and Google verification file.

## Vercel dependency conflict fix

The original lockfile referenced `react-swipeable-views@0.14.0`, whose peer dependency range excludes React 18. The corrected project removes the stale lockfile and does not declare `react-swipeable-views`; the existing portfolio tab navigation is retained without requiring that incompatible package. Run `npm install` locally to generate a fresh `package-lock.json` before committing if you want a lockfile. The build should still be verified in your own environment with `npm run build` before production deployment.
