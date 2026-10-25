-- DRAFT (untested) schema for the multi-merchant bridge. Replaces the singleton fdms_platform_settings.
-- Principle: browsers get READ-ONLY access. All writes come from the server using the service role,
-- after FDMS has answered. Private keys are stored SEALED (AES-GCM, see src/core/secrets.js) — never plain.

create table if not exists fdms_devices (
  device_id            integer primary key,                  -- ZIMRA deviceID (unique per device)
  merchant_id          uuid not null references fdms_merchants(id) on delete cascade,
  env                  text not null check (env in ('test','live')),
  base_url             text not null,
  serial_no            text not null,
  state                text not null check (state in ('connected','registered')),
  mode                 text check (mode in ('Online','Offline')),
  activation_key_sealed text,
  private_key_sealed   text,
  cert_pem             text,
  cert_valid_till      timestamptz,
  fdms_cert_chain      jsonb,
  config               jsonb,                                -- last getConfig
  last_global_no       integer not null default 0,
  last_day_no          integer not null default 0,
  created_at           timestamptz not null default now()
);

create table if not exists fdms_days (
  device_id     integer not null references fdms_devices(device_id) on delete cascade,
  day_no        integer not null,
  status        text not null check (status in ('FiscalDayOpened','FiscalDayCloseInitiated','FiscalDayClosed','FiscalDayCloseFailed')),
  opened_local  text not null,                               -- 'YYYY-MM-DDTHH:mm:ss' local, as sent to ZIMRA
  closed_local  text,
  open_sent     boolean not null default false,
  file_seq      integer not null default 0,
  counters      jsonb, device_signature jsonb, server_signature jsonb, close_error text,
  primary key (device_id, day_no)
);

create table if not exists fdms_receipts (
  device_id          integer not null references fdms_devices(device_id) on delete cascade,
  receipt_global_no  integer not null,
  day_no             integer not null,
  receipt_counter    integer not null,
  invoice_no         text not null,
  receipt              jsonb not null,                       -- exact JSON that was signed/sent
  status             text not null check (status in ('queued','accepted','rejected')),
  receipt_id         bigint,                                 -- FDMS receiptID
  server_date        text, server_signature jsonb, server_sig_verified boolean,
  error_code         text,
  qr                 jsonb,
  created_at         timestamptz not null default now(),
  primary key (device_id, receipt_global_no),                -- no duplicates, ever
  unique (device_id, day_no, receipt_counter),
  unique (device_id, invoice_no)                             -- RCPT013
);

alter table fdms_devices  enable row level security;
alter table fdms_days     enable row level security;
alter table fdms_receipts enable row level security;
-- merchants may only READ their own rows (and never the *_sealed columns: expose a view without them)
create policy "own devices read"  on fdms_devices  for select using (merchant_id in (select id from fdms_merchants where user_id = auth.uid()));
create policy "own days read"     on fdms_days     for select using (device_id in (select device_id from fdms_devices where merchant_id in (select id from fdms_merchants where user_id = auth.uid())));
create policy "own receipts read" on fdms_receipts for select using (device_id in (select device_id from fdms_devices where merchant_id in (select id from fdms_merchants where user_id = auth.uid())));
revoke select (activation_key_sealed, private_key_sealed) on fdms_devices from anon, authenticated;
-- NO insert/update/delete policies => only the service role (server) can write.

-- Per-device lock for the store.lock() contract:  select pg_advisory_xact_lock(device_id);
