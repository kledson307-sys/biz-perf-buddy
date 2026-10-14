ALTER TABLE public.agg_sales ADD COLUMN codigo text NOT NULL DEFAULT '';
ALTER TABLE public.agg_sales DROP CONSTRAINT agg_sales_consultant_id_dia_item_key;
ALTER TABLE public.agg_sales ADD CONSTRAINT agg_sales_consultant_id_dia_item_codigo_key UNIQUE (consultant_id, dia, item, codigo);