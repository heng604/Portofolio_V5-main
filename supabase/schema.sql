-- =====================================================================
-- Theng Seangheng portfolio - COMPLETE Supabase schema (idempotent: safe to re-run)
-- Run in: Supabase Dashboard > SQL Editor > New query > paste > Run
--
-- ADMIN EMAIL: change it in ONE place in this file: the function public.admin_email()
-- below, then re-run the file. Also change ADMIN_EMAIL in .env (server check).
-- =====================================================================

-- ---------- ADMIN IDENTITY (single source of truth in the database) ----------
create or replace function public.admin_email()
returns text language sql immutable as $$ select 'seangheng2006@gmail.com'::text $$;   -- <== CHANGE HERE (lowercase)

-- True only if the signed-in JWT has the admin email AND the provider verified it.
-- Replaces the older profiles.role check, so every existing policy that calls is_admin()
-- now enforces the email rule at database level.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email') = public.admin_email(), false)
     and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- ORIGINAL TABLES (kept) ----------
create table if not exists public.portfolio_comments (
  id bigint generated always as identity primary key,
  content text not null check (char_length(content) between 1 and 1000),
  user_name text not null check (char_length(user_name) between 1 and 80),
  profile_image text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id bigint generated always as identity primary key,
  "Title" text, "Description" text, "Img" text,
  "TechStack" jsonb default '[]'::jsonb, "Features" jsonb default '[]'::jsonb,
  "Link" text, "Github" text,
  created_at timestamptz not null default now()
);
alter table public.projects add column if not exists is_published boolean not null default true;
alter table public.projects add column if not exists sort_order integer not null default 0;
alter table public.projects add column if not exists translations jsonb not null default '{}'::jsonb; -- {"km":{"Title":"..","Description":".."}}
create index if not exists projects_order_idx on public.projects (is_published, sort_order, id desc);

create table if not exists public.certificates (
  id bigint generated always as identity primary key,
  "Img" text, created_at timestamptz not null default now()
);
alter table public.certificates add column if not exists title text;
alter table public.certificates add column if not exists is_published boolean not null default true;
alter table public.certificates add column if not exists sort_order integer not null default 0;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user'
);

-- ---------- NEW TABLES ----------
-- Key/value site content: hero text, about, experience, education, social links, contact
-- details, SEO metadata, CV url, section titles ... Each value is editable from the dashboard.
create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_.-]{1,80}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tech_stack (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  icon_url text, category text not null default 'general',
  is_published boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tech_stack_order_idx on public.tech_stack (is_published, sort_order);

-- UI translations. namespace.key + language -> text
create table if not exists public.translations (
  id bigint generated always as identity primary key,
  lang text not null check (lang in ('en','km')),
  key text not null check (char_length(key) between 1 and 120),
  value text not null,
  unique (lang, key)
);

-- Contact form submissions (written ONLY by the server with the service role).
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, subject text not null, message text not null,
  status text not null default 'received' check (status in ('received','sent','email_failed')),
  is_read boolean not null default false,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists contact_created_idx on public.contact_submissions (created_at desc);

-- Bakong tip payments. Holds NO secrets (the Bakong token lives only in .env on the server).
create table if not exists public.payments (
  id uuid primary key,
  md5 text not null unique,
  qr text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('USD','KHR')),
  recipient_account text not null,
  bill_number text,
  status text not null default 'pending' check (status in ('pending','confirmed','expired','cancelled','failed')),
  is_test boolean not null default false,
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  txn_hash text unique,              -- unique => the same Bakong transaction can never confirm two payments
  payer_account text,
  failure_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);
create index if not exists payments_created_idx on public.payments (created_at desc);
create index if not exists payments_status_idx on public.payments (status);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.portfolio_comments  enable row level security;
alter table public.projects            enable row level security;
alter table public.certificates        enable row level security;
alter table public.profiles            enable row level security;
alter table public.site_settings       enable row level security;
alter table public.tech_stack          enable row level security;
alter table public.translations        enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.payments            enable row level security;

-- comments: public read + post (never pinned); admin pin/delete
drop policy if exists "comments read" on public.portfolio_comments;
drop policy if exists "comments insert" on public.portfolio_comments;
drop policy if exists "comments admin update" on public.portfolio_comments;
drop policy if exists "comments admin delete" on public.portfolio_comments;
create policy "comments read" on public.portfolio_comments for select using (true);
create policy "comments insert" on public.portfolio_comments for insert with check (is_pinned = false);
create policy "comments admin update" on public.portfolio_comments for update using (public.is_admin()) with check (public.is_admin());
create policy "comments admin delete" on public.portfolio_comments for delete using (public.is_admin());

-- projects / certificates / tech_stack: public reads PUBLISHED rows only; admin everything
drop policy if exists "projects read" on public.projects;
drop policy if exists "projects admin" on public.projects;
create policy "projects read" on public.projects for select using (is_published or public.is_admin());
create policy "projects admin" on public.projects for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "certs read" on public.certificates;
drop policy if exists "certs admin" on public.certificates;
create policy "certs read" on public.certificates for select using (is_published or public.is_admin());
create policy "certs admin" on public.certificates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tech read" on public.tech_stack;
drop policy if exists "tech admin" on public.tech_stack;
create policy "tech read" on public.tech_stack for select using (is_published or public.is_admin());
create policy "tech admin" on public.tech_stack for all using (public.is_admin()) with check (public.is_admin());

-- site_settings: public reads only is_public rows; admin everything
drop policy if exists "settings read" on public.site_settings;
drop policy if exists "settings admin" on public.site_settings;
create policy "settings read" on public.site_settings for select using (is_public or public.is_admin());
create policy "settings admin" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- translations: public read; admin write
drop policy if exists "translations read" on public.translations;
drop policy if exists "translations admin" on public.translations;
create policy "translations read" on public.translations for select using (true);
create policy "translations admin" on public.translations for all using (public.is_admin()) with check (public.is_admin());

-- contact_submissions + payments: NO public policy at all (anon/authenticated non-admin get nothing).
-- The server uses the service role (bypasses RLS). The admin may read/update/delete via the API.
drop policy if exists "contact admin" on public.contact_submissions;
create policy "contact admin" on public.contact_submissions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "payments admin read" on public.payments;
create policy "payments admin read" on public.payments for select using (public.is_admin());

-- profiles: a user may read only their own row (kept for compatibility)
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (id = auth.uid());

-- ---------- REALTIME ----------
do $$ begin alter publication supabase_realtime add table public.portfolio_comments;
exception when duplicate_object then null; end $$;

-- ---------- STORAGE ----------
-- Buckets with server-enforced size + MIME limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-images',     'profile-images',     true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('project-images',     'project-images',     true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('certificate-images', 'certificate-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('site-files',         'site-files',         true, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images public read" on storage.objects;
create policy "images public read" on storage.objects for select
  using (bucket_id in ('profile-images','project-images','certificate-images','site-files'));

-- visitors may upload a comment avatar (small, image-only, enforced by bucket limits)
drop policy if exists "profile upload anyone" on storage.objects;
create policy "profile upload anyone" on storage.objects for insert with check (bucket_id = 'profile-images');

drop policy if exists "admin upload project/cert" on storage.objects;
drop policy if exists "admin manage images" on storage.objects;
drop policy if exists "admin manage files" on storage.objects;
create policy "admin manage files" on storage.objects for all
  using (bucket_id in ('project-images','certificate-images','site-files') and public.is_admin())
  with check (bucket_id in ('project-images','certificate-images','site-files') and public.is_admin());

-- ---------- SEED: Spotify OLED Display ESP32 (editable/publishable/reorderable from the dashboard) ----------
-- Rows in this table override the built-in card of the same title (see src/data/projects.js).
insert into public.projects ("Title","Description","Img","TechStack","Features","Link","Github", is_published, sort_order)
select 'Spotify OLED Display ESP32',
  'Shows the currently playing Spotify track on a 1.3" SH1106 OLED driven by an ESP32, with time-synced lyrics, a progress bar and an idle animation.',
  '/projects/spotify-esp32.svg',
  '["ESP32","Arduino C++","Python","discord.py","aiohttp","SH1106 OLED","lrclib API"]'::jsonb,
  '["Live track + artist from Spotify","Synced lyrics from lrclib.net (no API key)","Progress bar and equalizer","Idle animation","ESP32 polls /now-playing every 2 seconds","Deployable on a VPS for 24/7 use"]'::jsonb,
  '', 'https://github.com/heng604/Spotify-ESP32', true, 0
where not exists (select 1 from public.projects where "Title" = 'Spotify OLED Display ESP32');
