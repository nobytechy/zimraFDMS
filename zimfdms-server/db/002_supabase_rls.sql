-- Supabase only (needs auth.uid() and fdms_merchants). Run AFTER 001_core.sql.
-- Browsers get READ access to their own rows via the *_public views; the base tables hold sealed
-- secrets, so authenticated/anon get NO direct access to them at all. The server uses the DB owner role.

alter table bridge_devices  enable row level security;
alter table bridge_days     enable row level security;
alter table bridge_receipts enable row level security;
revoke all on bridge_devices, bridge_days, bridge_receipts from anon, authenticated;

alter table bridge_devices add constraint bridge_devices_merchant_fk
  foreign key (merchant_id) references fdms_merchants(id) on delete cascade not valid;

create or replace view bridge_receipts_public with (security_invoker = off) as
select r.device_id, r.receipt_global_no, r.day_no, r.receipt_counter, r.invoice_no, r.receipt_type,
       r.currency, r.total, r.receipt_date, r.status, r.error_code, r.created_at,
       r.data->'qr' as qr, r.data->'receipt' as receipt, r.data->>'receiptID' as fdms_receipt_id
from bridge_receipts r join bridge_devices d on d.device_id = r.device_id
where d.merchant_id in (select id from fdms_merchants where user_id = auth.uid());
grant select on bridge_receipts_public to authenticated;
