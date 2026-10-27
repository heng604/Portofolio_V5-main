-- Run this once in Supabase: Dashboard > SQL Editor > New query > Run
-- Creates everything the portfolio needs: comments, projects, certificates,
-- admin profiles, storage buckets and security rules.

-- ========== TABLES ==========
create table if not exists public.portfolio_comments (
  id            bigint generated always as identity primary key,
  content       text not null,
  user_name     text not null,
  profile_image text,
  is_pinned     boolean not null default false,
  created_at    timestamptz not null default now()
);

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

create table if not exists public.certificates (
  id         bigint generated always as identity primary key,
  "Img"      text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id   uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user'
);

-- ========== ADMIN CHECK ==========
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ========== ROW LEVEL SECURITY ==========
alter table public.portfolio_comments enable row level security;
alter table public.projects           enable row level security;
alter table public.certificates       enable row level security;
alter table public.profiles           enable row level security;

-- comments: anyone can read and post; only admin can pin/delete
drop policy if exists "comments read"   on public.portfolio_comments;
drop policy if exists "comments insert" on public.portfolio_comments;
drop policy if exists "comments admin update" on public.portfolio_comments;
drop policy if exists "comments admin delete" on public.portfolio_comments;
create policy "comments read"   on public.portfolio_comments for select using (true);
create policy "comments insert" on public.portfolio_comments for insert with check (is_pinned = false);
create policy "comments admin update" on public.portfolio_comments for update using (public.is_admin());
create policy "comments admin delete" on public.portfolio_comments for delete using (public.is_admin());

-- projects: public read, admin write
drop policy if exists "projects read"  on public.projects;
drop policy if exists "projects admin" on public.projects;
create policy "projects read"  on public.projects for select using (true);
create policy "projects admin" on public.projects for all using (public.is_admin()) with check (public.is_admin());

-- certificates: public read, admin write
drop policy if exists "certs read"  on public.certificates;
drop policy if exists "certs admin" on public.certificates;
create policy "certs read"  on public.certificates for select using (true);
create policy "certs admin" on public.certificates for all using (public.is_admin()) with check (public.is_admin());

-- profiles: each user can read only their own row
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (id = auth.uid());

-- ========== REALTIME (live comment updates) ==========
do $$ begin
  alter publication supabase_realtime add table public.portfolio_comments;
exception when duplicate_object then null; end $$;

-- ========== STORAGE BUCKETS ==========
insert into storage.buckets (id, name, public) values
  ('profile-images',     'profile-images',     true),
  ('project-images',     'project-images',     true),
  ('certificate-images', 'certificate-images', true)
on conflict (id) do nothing;

drop policy if exists "images public read" on storage.objects;
create policy "images public read" on storage.objects for select
  using (bucket_id in ('profile-images','project-images','certificate-images'));

drop policy if exists "profile upload anyone" on storage.objects;
create policy "profile upload anyone" on storage.objects for insert
  with check (bucket_id = 'profile-images');

drop policy if exists "admin upload project/cert" on storage.objects;
create policy "admin upload project/cert" on storage.objects for insert
  with check (bucket_id in ('project-images','certificate-images') and public.is_admin());

drop policy if exists "admin manage images" on storage.objects;
create policy "admin manage images" on storage.objects for all
  using (bucket_id in ('project-images','certificate-images') and public.is_admin())
  with check (bucket_id in ('project-images','certificate-images') and public.is_admin());

-- ========== MAKE YOURSELF ADMIN ==========
-- 1) Authentication > Users > Add user (your email + password, tick "Auto Confirm")
-- 2) Then run this with your email:
-- insert into public.profiles (id, role)
--   select id, 'admin' from auth.users where email = 'YOUR_EMAIL_HERE'
--   on conflict (id) do update set role = 'admin';
