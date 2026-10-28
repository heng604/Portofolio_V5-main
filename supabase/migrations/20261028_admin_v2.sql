-- Admin v2: audit log, payment hardening, content-change triggers, tip/section settings seed.
-- SAFE to re-run. Non-destructive: no drops of tables or data. Requires supabase/schema.sql to have been applied first.

-- 1) Audit log (read by the admin only; written by triggers / the server's service role) --------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null default 'system',
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, created_at desc);
alter table public.audit_logs enable row level security;
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs for select using (public.is_admin());
-- no insert/update/delete policy: nobody except the service role / SECURITY DEFINER triggers can write or erase it.

-- 2) Trigger that records every admin edit to content + settings -------------------------------------------------
create or replace function public.log_content_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid text; payload jsonb;
begin
  if tg_op = 'DELETE' then rid := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'key'); payload := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then rid := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'key'); payload := jsonb_build_object('new', to_jsonb(new));
  else rid := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'key'); payload := jsonb_build_object('new', to_jsonb(new)); end if;
  insert into public.audit_logs (actor_email, action, entity, entity_id, details)
  values (coalesce(lower(auth.jwt() ->> 'email'), 'system'), lower(tg_op), tg_table_name, rid, payload);
  return null;
end $$;
revoke all on function public.log_content_change() from public;

do $$
declare t text;
begin
  foreach t in array array['projects','certificates','tech_stack','site_settings','translations'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
      execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.log_content_change()', t);
    end if;
  end loop;
end $$;

-- 3) Payments hardening ---------------------------------------------------------------------------------------
alter table public.payments add column if not exists updated_at timestamptz not null default now();
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_payments_touch on public.payments;
create trigger trg_payments_touch before update on public.payments for each row execute function public.touch_updated_at();

-- A confirmed payment must carry its confirmation time; txn_hash is already UNIQUE (no double credit).
do $$ begin
  alter table public.payments add constraint payments_confirmed_has_time check (status <> 'confirmed' or confirmed_at is not null) not valid;
exception when duplicate_object then null; end $$;
-- A confirmed payment can never be changed back (prevents fabricating / reversing evidence through the API).
create or replace function public.payments_lock_confirmed() returns trigger language plpgsql as $$
begin
  if old.status = 'confirmed' and (new.status <> 'confirmed' or new.amount <> old.amount or new.currency <> old.currency or new.txn_hash is distinct from old.txn_hash) then
    raise exception 'confirmed payments are immutable';
  end if;
  return new;
end $$;
drop trigger if exists trg_payments_lock on public.payments;
create trigger trg_payments_lock before update on public.payments for each row execute function public.payments_lock_confirmed();
create index if not exists payments_confirmed_idx on public.payments (confirmed_at desc) where status = 'confirmed';

-- RLS: admin may READ payments from the browser; all writes go through the server (service role). Nothing public.
alter table public.payments enable row level security;
drop policy if exists "payments admin read" on public.payments;
create policy "payments admin read" on public.payments for select using (public.is_admin());

-- 4) Default (public) settings used by the new Appearance page. Existing values are never overwritten. ---------------
insert into public.site_settings (key, value, is_public) values
  ('section_about',     '{"text":"show"}', true),
  ('section_portfolio', '{"text":"show"}', true),
  ('section_tip',       '{"text":"show"}', true),
  ('section_contact',   '{"text":"show"}', true)
on conflict (key) do nothing;
