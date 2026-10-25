-- ============================================================================
-- zimFDMS — migration 010: the real FDMS bridge
--
-- Run ONCE in Supabase → SQL editor, after install.sql and 009. Idempotent.
--  1. Bridge tables (bridge_devices / bridge_days / bridge_receipts): written ONLY by the server
--     (Netlify function, DATABASE_URL = owner role). Browsers get no direct access.
--  2. Security fixes to the original schema.
--  3. Public receipt verify RPC now reads the bridge receipts.
-- ============================================================================


-- Writes happen ONLY from the server (service role / DATABASE_URL). Receipts are append-only:
-- the signed receipt JSON can never change; only delivery status columns move queued -> accepted/rejected.

create table if not exists bridge_devices (
  device_id    integer primary key,
  merchant_id  uuid not null,
  env          text not null check (env in ('test','live')),
  state        text not null check (state in ('connected','registered')),
  data         jsonb not null,            -- sealed secrets, config, cert chain, counters (see core/store.js)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists bridge_devices_merchant_idx on bridge_devices (merchant_id);

create table if not exists bridge_days (
  device_id  integer not null references bridge_devices(device_id) on delete cascade,
  day_no     integer not null,
  status     text not null,
  data       jsonb not null,              -- day state minus receipts
  updated_at timestamptz not null default now(),
  primary key (device_id, day_no)
);

create table if not exists bridge_receipts (
  device_id          integer not null references bridge_devices(device_id) on delete cascade,
  receipt_global_no  integer not null,
  day_no             integer not null,
  receipt_counter    integer not null,
  invoice_no         text    not null,
  receipt_type       text    not null,
  currency           text    not null,
  total              numeric(18,2) not null,
  receipt_date       text    not null,    -- local 'YYYY-MM-DDTHH:mm:ss' as sent to ZIMRA
  status             text    not null check (status in ('queued','accepted','rejected')),
  error_code         text,
  data               jsonb   not null,    -- full record: receipt, qr, receiptID, server signature...
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (device_id, receipt_global_no),
  unique (device_id, day_no, receipt_counter),
  unique (device_id, invoice_no)
);
create index if not exists bridge_receipts_date_idx   on bridge_receipts (device_id, receipt_date desc);
create index if not exists bridge_receipts_status_idx on bridge_receipts (device_id, status);

-- Append-only guard: signed receipt body and identity columns are immutable; no deletes.
create or replace function bridge_receipts_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'bridge_receipts is append-only'; end if;
  if new.invoice_no <> old.invoice_no or new.total <> old.total or new.receipt_date <> old.receipt_date
     or new.day_no <> old.day_no or new.receipt_counter <> old.receipt_counter
     or (new.data->'receipt') is distinct from (old.data->'receipt') then
    raise exception 'bridge_receipts: signed receipt is immutable';
  end if;
  return new;
end $$;
drop trigger if exists bridge_receipts_guard_t on bridge_receipts;
create trigger bridge_receipts_guard_t before update or delete on bridge_receipts
  for each row execute function bridge_receipts_guard();

-- ─── 1b. Lock the bridge tables away from browsers ─────────────────────────
alter table bridge_devices  enable row level security;
alter table bridge_days     enable row level security;
alter table bridge_receipts enable row level security;
revoke all on bridge_devices, bridge_days, bridge_receipts from anon, authenticated;
-- (no policies => only the table owner / service role, i.e. the server, can touch them)

do $$ begin
  alter table bridge_devices add constraint bridge_devices_merchant_fk
    foreign key (merchant_id) references public.fdms_merchants(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- ─── 2. Security fixes ─────────────────────────────────────────────────────
-- 2a. A merchant must never be able to make themselves admin / reactivate themselves.
drop policy if exists "merchants insert self" on public.fdms_merchants;
create policy "merchants insert self" on public.fdms_merchants
  for insert with check (auth.uid() = user_id and is_admin = false and status = 'active');

create or replace function public.fdms_merchants_guard() returns trigger as $$
begin
  if not public.fdms_is_admin() and current_user in ('authenticated','anon') then
    if new.is_admin is distinct from old.is_admin or new.status is distinct from old.status
       or new.user_id is distinct from old.user_id then
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_fdms_merchants_guard on public.fdms_merchants;
create trigger trg_fdms_merchants_guard before update on public.fdms_merchants
  for each row execute function public.fdms_merchants_guard();

-- 2b. Legacy demo tables: merchants may READ their rows, but fiscal data is written by the server only.
drop policy if exists "merchant scope write" on public.fdms_fiscal_days;
drop policy if exists "merchant scope write" on public.fdms_receipts;

-- 2c. Credentials are per-merchant and live (sealed) in bridge_devices — never in a platform singleton.
alter table public.fdms_platform_settings
  drop column if exists device_id,
  drop column if exists activation_key,
  drop column if exists device_serial_no,
  drop column if exists certificate_pem,
  drop column if exists private_key_pem;

-- ─── 3. Public verify (QR target) — reads bridge receipts ──────────────────
create or replace function public.fdms_verify_receipt(p_invoice_no text)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'invoice_no',        r.invoice_no,
    'receipt_type',      r.receipt_type,
    'receipt_currency',  r.currency,
    'receipt_total',     r.total,
    'receipt_global_no', r.receipt_global_no,
    'receipt_counter',   r.receipt_counter,
    'receipt_date',      r.receipt_date,
    'lines',             r.data->'receipt'->'receiptLines',
    'taxes',             r.data->'receipt'->'receiptTaxes',
    'payments',          r.data->'receipt'->'receiptPayments',
    'device_signature',  r.data->'receipt'->'receiptDeviceSignature',
    'fdms_signature',    r.data->'serverSignature',
    'status',            r.status,
    'created_at',        r.created_at,
    'merchant_name',     coalesce(m.business_name, m.full_name),
    'merchant_tin',      m.tin,
    'merchant_vat',      m.vat_number,
    'fiscal_day_no',     r.day_no
  )
  from bridge_receipts r
  join bridge_devices d on d.device_id = r.device_id
  left join fdms_merchants m on m.id = d.merchant_id
  where r.invoice_no = p_invoice_no
  order by r.receipt_global_no desc
  limit 1
$$;
revoke all on function public.fdms_verify_receipt(text) from public;
grant execute on function public.fdms_verify_receipt(text) to anon, authenticated;

select 'bridge migration applied' as status, now() as at;
