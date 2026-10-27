-- =====================================================================
-- Theng Seangheng portfolio - COMPLETE Supabase schema (idempotent: safe to re-run)
-- Run in: Supabase Dashboard > SQL Editor > New query > paste > Run
--
-- ADMIN EMAIL: change it in ONE place in this file - the function public.is_admin() below
-- (search for  ADMIN EMAIL ). Also change ADMIN_EMAIL in .env / hosting env vars.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ADMIN CHECK  (used by EVERY admin policy below, including storage)
--    The JWT is signed by Supabase Auth, so the email claim cannot be forged by the browser.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('Seangheng2006@gmail.com'); -- <== ADMIN EMAIL
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- (original) comments
create table if not exists public.portfolio_comments (
  id            bigint generated always as identity primary key,
  content       text not null check (char_length(content) between 1 and 1000),
  user_name     text not null check (char_length(user_name) between 1 and 80),
  profile_image text,
  is_pinned     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- (original) projects  + new columns
create table if not exists public.projects (
  id            bigint generated always as identity primary key,
  "Title"       text,
  "Description" text,
  "Img"         text,
  "TechStack"   jsonb default '[]'::jsonb,
  "Features"    jsonb default '[]'::jsonb,
  "Link"        text,
  "Github"      text,
  created_at    timestamptz not null default now()
);
alter table public.projects add column if not exists published  boolean not null default true;
alter table public.projects add column if not exists sort_order integer not null default 0;
alter table public.projects add column if not exists "Title_km"       text;
alter table public.projects add column if not exists "Description_km" text;
alter table public.projects add column if not exists updated_at timestamptz not null default now();
create index if not exists projects_published_order_idx on public.projects (published, sort_order);
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- (original) certificates + new columns
create table if not exists public.certificates (
  id         bigint generated always as identity primary key,
  "Img"      text,
  created_at timestamptz not null default now()
);
alter table public.certificates add column if not exists title      text;
alter table public.certificates add column if not exists published  boolean not null default true;
alter table public.certificates add column if not exists sort_order integer not null default 0;

-- (original) profiles - kept for backward compatibility; NO LONGER used for authorization
create table if not exists public.profiles (
  id   uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user'
);

create table if not exists public.tech_stack (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 80),
  icon_url   text,
  category   text not null default 'general',
  published  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_entries (
  id             bigint generated always as identity primary key,
  kind           text not null check (kind in ('about','experience','education')),
  title          text not null,
  title_km       text,
  subtitle       text,
  subtitle_km    text,
  period         text,
  description    text,
  description_km text,
  published      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

-- key/value website settings: hero, social links, contact details, SEO, Bakong recipient, general
create table if not exists public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_.]+$' and char_length(key) <= 80),
  value      jsonb not null default 'null'::jsonb,
  group_name text not null default 'general',
  is_public  boolean not null default true,
  updated_at timestamptz not null default now()
);
drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();

-- translations that override the built-in dictionary in src/i18n/translations.js
create table if not exists public.translations (
  key        text not null check (char_length(key) <= 120),
  lang       text not null check (lang in ('en','km')),
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (key, lang)
);

-- contact form submissions (PRIVATE: written by the server with the service-role key)
create table if not exists public.contact_submissions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  subject      text not null,
  message      text not null,
  status       text not null default 'received' check (status in ('received','sent','failed')),
  error        text,
  is_read      boolean not null default false,
  ip_hash      text,
  content_hash text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index if not exists contact_ip_idx      on public.contact_submissions (ip_hash, created_at desc);
create index if not exists contact_content_idx on public.contact_submissions (content_hash, created_at desc);
create index if not exists contact_created_idx on public.contact_submissions (created_at desc);

-- Bakong tip payments (PRIVATE: written/verified by the server only)
create table if not exists public.payments (
  id                uuid primary key,
  md5               text not null unique,                 -- md5 of the KHQR payload, used for verification
  qr_payload        text not null,
  amount            numeric(14,2) not null check (amount > 0),
  currency          text not null check (currency in ('USD','KHR')),
  status            text not null default 'pending' check (status in ('pending','paid','expired','cancelled','failed')),
  mode              text not null check (mode in ('sandbox','production')),
  is_test           boolean not null default false,
  recipient_name    text not null,
  recipient_account text not null,
  bill_number       text,
  tipper_name       text,
  message           text,
  bakong_hash       text unique,                          -- a Bakong transaction can settle only ONE payment
  bakong_response   jsonb,                                -- non-sensitive transaction fields only
  failure_reason    text,
  check_count       integer not null default 0,
  last_checked_at   timestamptz,
  ip_hash           text,
  expires_at        timestamptz not null,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists payments_status_idx  on public.payments (status, created_at desc);
create index if not exists payments_created_idx on public.payments (created_at desc);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.portfolio_comments  enable row level security;
alter table public.projects            enable row level security;
alter table public.certificates        enable row level security;
alter table public.profiles            enable row level security;
alter table public.tech_stack          enable row level security;
alter table public.profile_entries     enable row level security;
alter table public.site_settings       enable row level security;
alter table public.translations        enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.payments            enable row level security;

-- comments: public read + post (cannot self-pin); admin moderate
drop policy if exists "comments read"         on public.portfolio_comments;
drop policy if exists "comments insert"       on public.portfolio_comments;
drop policy if exists "comments admin update" on public.portfolio_comments;
drop policy if exists "comments admin delete" on public.portfolio_comments;
create policy "comments read"         on public.portfolio_comments for select using (true);
create policy "comments insert"       on public.portfolio_comments for insert with check (is_pinned = false);
create policy "comments admin update" on public.portfolio_comments for update using (public.is_admin()) with check (public.is_admin());
create policy "comments admin delete" on public.portfolio_comments for delete using (public.is_admin());

-- projects / certificates / tech_stack / profile_entries: public sees PUBLISHED rows only; admin full access
drop policy if exists "projects read"  on public.projects;
drop policy if exists "projects admin" on public.projects;
create policy "projects read"  on public.projects for select using (published = true or public.is_admin());
create policy "projects admin" on public.projects for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "certs read"  on public.certificates;
drop policy if exists "certs admin" on public.certificates;
create policy "certs read"  on public.certificates for select using (published = true or public.is_admin());
create policy "certs admin" on public.certificates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tech read"  on public.tech_stack;
drop policy if exists "tech admin" on public.tech_stack;
create policy "tech read"  on public.tech_stack for select using (published = true or public.is_admin());
create policy "tech admin" on public.tech_stack for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "entries read"  on public.profile_entries;
drop policy if exists "entries admin" on public.profile_entries;
create policy "entries read"  on public.profile_entries for select using (published = true or public.is_admin());
create policy "entries admin" on public.profile_entries for all using (public.is_admin()) with check (public.is_admin());

-- site_settings: public reads rows flagged is_public; admin everything
drop policy if exists "settings read"  on public.site_settings;
drop policy if exists "settings admin" on public.site_settings;
create policy "settings read"  on public.site_settings for select using (is_public = true or public.is_admin());
create policy "settings admin" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- translations: public read, admin write
drop policy if exists "translations read"  on public.translations;
drop policy if exists "translations admin" on public.translations;
create policy "translations read"  on public.translations for select using (true);
create policy "translations admin" on public.translations for all using (public.is_admin()) with check (public.is_admin());

-- profiles: a user can read only their own row (legacy table)
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (id = auth.uid());

-- contact_submissions: NO public access at all. Inserts come from the server (service role bypasses RLS).
drop policy if exists "contact admin" on public.contact_submissions;
create policy "contact admin" on public.contact_submissions for all using (public.is_admin()) with check (public.is_admin());

-- payments: NO public access. Server (service role) creates/verifies; admin can read and clean up.
drop policy if exists "payments admin read"   on public.payments;
drop policy if exists "payments admin delete" on public.payments;
create policy "payments admin read"   on public.payments for select using (public.is_admin());
create policy "payments admin delete" on public.payments for delete using (public.is_admin());

-- Defence in depth: the anon role gets no table privileges on private tables.
revoke all on public.contact_submissions from anon;
revoke all on public.payments            from anon;

-- ---------------------------------------------------------------------
-- 4. REALTIME (live comments)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.portfolio_comments;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 5. STORAGE BUCKETS (size + type limits enforced by Supabase Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-images',     'profile-images',     true,  2097152, array['image/jpeg','image/png','image/webp','image/gif']),
  ('project-images',     'project-images',     true,  5242880, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('certificate-images', 'certificate-images', true,  5242880, array['image/jpeg','image/png','image/webp']),
  ('site-assets',        'site-assets',        true,  5242880, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('cv-files',           'cv-files',           true, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images public read"           on storage.objects;
drop policy if exists "profile upload anyone"        on storage.objects;
drop policy if exists "admin upload project/cert"    on storage.objects;
drop policy if exists "admin manage images"          on storage.objects;
drop policy if exists "public read portfolio files"  on storage.objects;
drop policy if exists "anon upload comment avatars"  on storage.objects;
drop policy if exists "admin manage portfolio files" on storage.objects;

create policy "public read portfolio files" on storage.objects for select
  using (bucket_id in ('profile-images','project-images','certificate-images','site-assets','cv-files'));

-- visitors may upload a comment avatar (size/type limited by the bucket)
create policy "anon upload comment avatars" on storage.objects for insert
  with check (bucket_id = 'profile-images');

create policy "admin manage portfolio files" on storage.objects for all
  using (bucket_id in ('profile-images','project-images','certificate-images','site-assets','cv-files') and public.is_admin())
  with check (bucket_id in ('profile-images','project-images','certificate-images','site-assets','cv-files') and public.is_admin());

-- ---------------------------------------------------------------------
-- 6. SEED DATA (only inserted when missing)
-- ---------------------------------------------------------------------
insert into public.site_settings (key, value, group_name, is_public) values
  ('hero.name',               '"Theng Seangheng"',                                 'hero',    true),
  ('hero.role',               '"Network Engineer / Computer Networking and Cyber Security"', 'hero', true),
  ('contact.email',           '"Seangheng2006@gmail.com"',                         'contact', true),
  ('social.telegram',         '"https://t.me/Theng_seang_heng"',                   'social',  true),
  ('cv.url',                  '"/THENG_SEANGHENG_CV.pdf"',                         'cv',      true),
  ('seo.title',               '"Theng Seangheng | Network Engineer Portfolio"',    'seo',     true),
  ('seo.description',         '"Portfolio of Theng Seangheng - Computer Networking and Cyber Security."', 'seo', true),
  ('bakong.enabled',          'true',                                              'bakong',  true),
  ('bakong.recipient_name_en','"Theng Seangheng"',                                 'bakong',  true),
  ('bakong.recipient_name_km','"ថេង ស៊ាងហេង"',                                      'bakong',  true),
  ('bakong.city',             '"Phnom Penh"',                                      'bakong',  true),
  ('bakong.usd_min',          '0.5',                                               'bakong',  true),
  ('bakong.usd_max',          '500',                                               'bakong',  true),
  ('bakong.khr_min',          '2000',                                              'bakong',  true),
  ('bakong.khr_max',          '2000000',                                           'bakong',  true)
on conflict (key) do nothing;

-- Existing hard-coded projects become editable/unpublishable rows (Spotify repo = heng604/Spotify-ESP32).
insert into public.projects ("Title","Description","Img","TechStack","Features","Link","Github",published,sort_order)
select $q$Masatoshi Studio$q$,$q$ហាងលក់ផលិតផលឌីជីថលតាមអ៊ីនធឺណិត ដែលអ្នកប្រើអាចទិញ និងទាញយកផលិតផលដោយប្រើពិន្ទុ។ មានប្រព័ន្ធបញ្ចូលពិន្ទុតាម Bakong KHQR, ABA, Wing និង PayWay, ចូលប្រើតាម Google, ភាសាខ្មែរ/អង់គ្លេស និងផ្ទាំងគ្រប់គ្រង (Admin) ពេញលេញ។$q$,$q$/projects/masatoshi-studio.jpg$q$,$q$["React", "Vite", "Node.js", "Express", "MongoDB", "Firebase", "Bakong KHQR", "PayWay"]$q$::jsonb,$q$["ទិញ និងទាញយកផលិតផលឌីជីថលដោយប្រើប្រព័ន្ធពិន្ទុ", "បញ្ចូលពិន្ទុតាម Bakong KHQR (ផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ), ABA, Wing និង PayWay", "ចូលគណនីតាម Google និងទំព័រប្រវត្តិរូបអ្នកប្រើ", "ប្តូរភាសាបាន ខ្មែរ ↔ អង់គ្លេស", "ផ្ទាំង Admin: គ្រប់គ្រងផលិតផល, ការបញ្ជាទិញ, ការបញ្ចូលពិន្ទុ, អ្នកប្រើ, បដា និងរបាយការណ៍", "នាំចេញរបាយការណ៍ និងស្ថិតិផ្ទាំងគ្រប់គ្រង"]$q$::jsonb,$q$$q$,$q$https://github.com/heng604/tester$q$,true,1
where not exists (select 1 from public.projects where "Title" = $q$Masatoshi Studio$q$);
insert into public.projects ("Title","Description","Img","TechStack","Features","Link","Github",published,sort_order)
select $q$Spotify OLED Display ESP32$q$,$q$បង្ហាញចម្រៀងដែលកំពុងចាក់លើ Spotify ភ្លាមៗលើអេក្រង់ OLED 1.3" (SH1106 128×64) ជាមួយ lyrics ដែលស៊ីងក្រូនជាមួយភ្លេង, ប្រព័ន្ធទឹកមុខពេលទំនេរ, របារដំណើរការចម្រៀង និង equalizer។ ប្រើ Discord Bot (Python) អាន Rich Presence ហើយផ្ញើទិន្នន័យតាម HTTP JSON API ទៅ ESP32។$q$,$q$/projects/spotify-esp32.svg$q$,$q$["ESP32", "Arduino C++", "Python", "discord.py", "aiohttp", "SH1106 OLED", "lrclib API"]$q$::jsonb,$q$["បង្ហាញចម្រៀង និងអ្នកចម្រៀងដែលកំពុងចាក់ពី Spotify ភ្លាមៗ", "Lyrics ស៊ីងក្រូនជាមួយភ្លេង ទាញពី lrclib.net (មិនត្រូវការ API key)", "របារដំណើរការចម្រៀង និង equalizer លើអេក្រង់ OLED", "ទឹកមុខ/ចលនាពេលទំនេរ នៅពេលមិនមានចម្រៀងកំពុងចាក់", "ESP32 ទាញទិន្នន័យពី endpoint /now-playing រៀងរាល់ 2 វិនាទី", "ដាក់ពង្រាយលើ VPS ដើម្បីដំណើរការ 24/7 បាន"]$q$::jsonb,$q$$q$,$q$https://github.com/heng604/Spotify-ESP32.git$q$,true,2
where not exists (select 1 from public.projects where "Title" = $q$Spotify OLED Display ESP32$q$);

-- ---------------------------------------------------------------------
-- 7. HOW TO CHANGE THE ADMIN EMAIL LATER
--    1) Edit the literal in public.is_admin() (marked  ADMIN EMAIL ) and re-run that CREATE OR REPLACE.
--    2) Change ADMIN_EMAIL in .env / hosting environment variables.
--    3) Sign out and sign in again with the new Google account.
--    Storage and table policies all call public.is_admin(), so nothing else needs editing.
-- ---------------------------------------------------------------------
