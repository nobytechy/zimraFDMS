-- zimFDMS bridge: core tables. Plain Postgres (no Supabase-only features) so it also runs on PGlite for tests.
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
