ALTER TABLE public.update_log ADD COLUMN IF NOT EXISTS mes text;
COMMENT ON COLUMN public.update_log.mes IS 'Month of the updated data (YYYY-MM); NULL for legacy records and weekly O.S. control.';
CREATE INDEX IF NOT EXISTS update_log_owner_month_at_idx ON public.update_log (user_id, mes, at DESC);