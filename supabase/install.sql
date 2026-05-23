-- ============================================================================
-- zimFDMS — single re-runnable schema for the shared Supabase project.
--
-- Reuses Noby's existing shared project. Tables prefixed `fdms_` so they don't
-- collide with cag_*, re_* (Ridgecrest), churchzim_*, or noby-portfolio tables.
--
-- Apply in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Then create the demo admin auth user (see comment near the bottom).
-- ============================================================================

create extension if not exists "pgcrypto";

-- updated_at helper -------------------------------------------------------
create or replace function public.fdms_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ─── Singleton platform settings (admin-edited) ─────────────────────────
create table if not exists public.fdms_platform_settings (
  id                integer primary key default 1 check (id = 1),
  mode              text not null default 'demo' check (mode in ('demo','real')),
  zimra_base_url    text default 'https://fdmsapi.zimra.co.zw',
  device_id         integer,
  activation_key    text,
  device_serial_no  text,
  certificate_pem   text,
  private_key_pem   text,        -- never exposed via RLS — admin reads only
  is_enabled        boolean not null default true,
  updated_at        timestamptz not null default now()
);
insert into public.fdms_platform_settings (id) values (1) on conflict (id) do nothing;
drop trigger if exists trg_fdms_platform_settings_touch on public.fdms_platform_settings;
create trigger trg_fdms_platform_settings_touch before update on public.fdms_platform_settings
  for each row execute function public.fdms_touch_updated_at();

-- ─── Merchants ─────────────────────────────────────────────────────────
create table if not exists public.fdms_merchants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  full_name       text not null,
  phone           text not null unique,
  phone_verified  boolean not null default false,
  business_name   text,
  tin             text,
  vat_number      text,
  is_admin        boolean not null default false,
  status          text not null default 'active' check (status in ('active','suspended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists fdms_merchants_phone_idx on public.fdms_merchants(phone);
drop trigger if exists trg_fdms_merchants_touch on public.fdms_merchants;
create trigger trg_fdms_merchants_touch before update on public.fdms_merchants
  for each row execute function public.fdms_touch_updated_at();

-- ─── Per-merchant fiscal days ───────────────────────────────────────────
create table if not exists public.fdms_fiscal_days (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references public.fdms_merchants(id) on delete cascade,
  fiscal_day_no   integer not null,
  status          text not null default 'FiscalDayOpened'
                  check (status in ('FiscalDayOpened','FiscalDayCloseInitiated','FiscalDayClosed','FiscalDayCloseFailed')),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  receipt_count   integer not null default 0,
  totals          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists fdms_fiscal_days_merchant_idx on public.fdms_fiscal_days(merchant_id, fiscal_day_no);

-- ─── Per-merchant receipts ──────────────────────────────────────────────
create table if not exists public.fdms_receipts (
  id                 uuid primary key default gen_random_uuid(),
  merchant_id        uuid not null references public.fdms_merchants(id) on delete cascade,
  fiscal_day_id      uuid references public.fdms_fiscal_days(id) on delete set null,
  receipt_global_no  integer not null,
  receipt_counter    integer not null,
  receipt_type       text not null check (receipt_type in ('FiscalInvoice','CreditNote','DebitNote')),
  receipt_currency   text not null,
  receipt_total      numeric(19,2) not null,
  invoice_no         text not null,
  receipt_date       timestamptz not null default now(),
  buyer              jsonb,
  lines              jsonb not null default '[]'::jsonb,
  taxes              jsonb not null default '[]'::jsonb,
  payments           jsonb not null default '[]'::jsonb,
  device_signature   jsonb,
  fdms_signature     jsonb,
  status             text not null default 'submitted'
                     check (status in ('submitted','accepted','failed','queued')),
  raw_response       jsonb,
  created_at         timestamptz not null default now()
);
create index if not exists fdms_receipts_merchant_idx on public.fdms_receipts(merchant_id, created_at desc);
create index if not exists fdms_receipts_day_idx on public.fdms_receipts(fiscal_day_id);

-- ─── API keys (per-merchant) ────────────────────────────────────────────
create table if not exists public.fdms_api_keys (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.fdms_merchants(id) on delete cascade,
  label         text not null,
  key_prefix    text not null,
  key_hash      text not null,        -- bcrypt of full key — never store plain key
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);
create index if not exists fdms_api_keys_merchant_idx on public.fdms_api_keys(merchant_id);

-- ─── Webhook endpoints ──────────────────────────────────────────────────
create table if not exists public.fdms_webhooks (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.fdms_merchants(id) on delete cascade,
  url           text not null,
  secret        text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── Roles & RLS ────────────────────────────────────────────────────────
alter table public.fdms_platform_settings enable row level security;
alter table public.fdms_merchants         enable row level security;
alter table public.fdms_fiscal_days       enable row level security;
alter table public.fdms_receipts          enable row level security;
alter table public.fdms_api_keys          enable row level security;
alter table public.fdms_webhooks          enable row level security;

-- Helper: is the current jwt the admin email?
create or replace function public.fdms_is_admin() returns boolean as $$
  select (auth.jwt() ->> 'email') = 'admin@zimfdms.local'
$$ language sql stable;

-- Merchants can read + update their own row
drop policy if exists "merchants read self" on public.fdms_merchants;
create policy "merchants read self" on public.fdms_merchants
  for select using (auth.uid() = user_id or public.fdms_is_admin());

drop policy if exists "merchants insert self" on public.fdms_merchants;
create policy "merchants insert self" on public.fdms_merchants
  for insert with check (auth.uid() = user_id);

drop policy if exists "merchants update self" on public.fdms_merchants;
create policy "merchants update self" on public.fdms_merchants
  for update using (auth.uid() = user_id or public.fdms_is_admin())
              with check (auth.uid() = user_id or public.fdms_is_admin());

-- Fiscal days / receipts / api_keys / webhooks: scoped to the merchant
do $$
declare t text;
begin
  for t in select unnest(array['fdms_fiscal_days','fdms_receipts','fdms_api_keys','fdms_webhooks']) loop
    execute format('drop policy if exists "merchant scope select" on public.%I', t);
    execute format('create policy "merchant scope select" on public.%I for select using (merchant_id in (select id from public.fdms_merchants where user_id = auth.uid()) or public.fdms_is_admin())', t);
    execute format('drop policy if exists "merchant scope write" on public.%I', t);
    execute format('create policy "merchant scope write" on public.%I for all using (merchant_id in (select id from public.fdms_merchants where user_id = auth.uid()) or public.fdms_is_admin()) with check (merchant_id in (select id from public.fdms_merchants where user_id = auth.uid()) or public.fdms_is_admin())', t);
  end loop;
end $$;

-- Platform settings — admin only (reads and writes)
drop policy if exists "platform settings admin" on public.fdms_platform_settings;
create policy "platform settings admin" on public.fdms_platform_settings
  for all using (public.fdms_is_admin()) with check (public.fdms_is_admin());

-- ============================================================================
-- DEMO ADMIN BOOTSTRAP
-- After running this script:
--   1. Supabase → Auth → Users → Add user
--        email:    admin@zimfdms.local
--        password: 1975              (PIN — change later)
--        auto-confirm: yes
--   2. Link the auth user to a merchant row marked as admin:
--        insert into public.fdms_merchants (user_id, full_name, phone, is_admin)
--          select id, 'zimFDMS Admin', '+263000000000', true
--          from auth.users where email = 'admin@zimfdms.local';
-- ============================================================================

select 'zimFDMS schema applied' as status, now() as at;
