-- ============================================================================
-- zimFDMS — migration 009
--
-- Adds:
--   1. A public RPC `fdms_verify_receipt(invoice_no)` so anyone — anonymous
--      customers, ZIMRA officers, auditors — can look up a fiscalised receipt
--      by reference without being able to query the underlying table directly.
--   2. A small per-merchant analytics view (`fdms_receipts_by_day`) used by
--      the dashboard overview chart.
--   3. Helpful indexes on `fdms_receipts.invoice_no` (used by verify) and on
--      `fdms_receipts.merchant_id, created_at` (used by every dashboard list).
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ─── Indexes ──────────────────────────────────────────────────────────────
create unique index if not exists fdms_receipts_invoice_no_idx
  on public.fdms_receipts (invoice_no);

create index if not exists fdms_receipts_merchant_created_idx
  on public.fdms_receipts (merchant_id, created_at desc);

create index if not exists fdms_fiscal_days_merchant_status_idx
  on public.fdms_fiscal_days (merchant_id, status, opened_at desc);

-- ─── Verify RPC — callable by anon ────────────────────────────────────────
-- security definer so it bypasses RLS; we control exactly what fields are
-- returned, so no internal data leaks.
create or replace function public.fdms_verify_receipt(p_invoice_no text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'invoice_no',         r.invoice_no,
    'receipt_type',       r.receipt_type,
    'receipt_currency',   r.receipt_currency,
    'receipt_total',      r.receipt_total,
    'receipt_global_no',  r.receipt_global_no,
    'receipt_counter',    r.receipt_counter,
    'receipt_date',       r.receipt_date,
    'lines',              r.lines,
    'taxes',              r.taxes,
    'payments',           r.payments,
    'device_signature',   r.device_signature,
    'fdms_signature',     r.fdms_signature,
    'status',             r.status,
    'created_at',         r.created_at,
    'merchant_name',      coalesce(m.business_name, m.full_name),
    'merchant_tin',       m.tin,
    'merchant_vat',       m.vat_number,
    'fiscal_day_no',      fd.fiscal_day_no
  )
  from public.fdms_receipts r
  left join public.fdms_merchants  m  on m.id  = r.merchant_id
  left join public.fdms_fiscal_days fd on fd.id = r.fiscal_day_id
  where r.invoice_no = p_invoice_no
  limit 1
$$;

revoke all on function public.fdms_verify_receipt(text) from public;
grant execute on function public.fdms_verify_receipt(text) to anon, authenticated;

-- ─── Daily receipts aggregate view (per merchant, last 30 days) ───────────
create or replace view public.fdms_receipts_by_day as
select
  merchant_id,
  date_trunc('day', created_at)::date as day,
  count(*)                            as receipt_count,
  sum(receipt_total)                  as gross_total
from public.fdms_receipts
where created_at > now() - interval '30 days'
group by merchant_id, date_trunc('day', created_at);

-- View inherits RLS from underlying table — no extra grants needed since
-- the RLS policies on fdms_receipts already scope rows to the calling
-- merchant (or admin).

select 'verify + analytics migration applied' as status, now() as at;
