<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Open orders use one shared monthly snapshot in open_order_snapshots via auth-protected server functions and team RLS; replace the JSON snapshot atomically to avoid duplicate totals or partial imports.
- Manage the dashboard theme through the shared ThemeProvider, persist the browser choice, and apply it on root HTML with shared CSS tokens so every tab and native input stays consistent.
- Shared dashboard formatters and UI primitives live in `src/components/painel-ui.tsx`; import from there instead of redefining them in routes.
- Agregados data lives in its own tables (`agg_sales`, `agg_goals`, `agg_visits`) and its own component; never mix it into `daily_sales`/`goals` totals — the user tracks it separately.
- Agregados item catalogue (`ITENS`, with default system service codes) and the system-report parser live in `src/lib/agregados.ts`; adding an item only requires a new entry there. User-edited codes per item are stored in `agg_codes` and override the defaults.
- Agregados Excel import replaces only the item group (serviços or peças) found in the report for the whole report period; ranking reports store the period total on its last day, item-list reports (one row per sale) store each sale on its own day — so re-importing never double-counts and importing one group never wipes the other.
- System codes are matched ignoring spaces and case (`normCod`); code lists are split only on comma/semicolon/newline because some codes contain spaces.
- AI calls go through Lovable AI Gateway from server-only helpers in `src/lib/ai/*.server.ts`, invoked by auth-protected `createServerFn`s in `src/lib/*.functions.ts`; the browser sends computed stats, never the key.
- Main sales Excel/paste parsing lives in `src/lib/sales-report.ts` and the import UI in `SalesImport`; match seller login before full name to preserve existing consultant identities.
- Render SalesImport inside the Painel tab, excluded from print reports; the stale-data action opens Painel and scrolls to its import section so updates have one entry point.
- Cumulative main-sales reports use the authenticated SECURITY INVOKER `import_sales_period` RPC to replace included consultants' period atomically and store totals on the final day; period totals cannot reconstruct daily sales.
- Brand primary and performance colors use independent semantic tokens so changing the brand never changes success/warning thresholds.
- Team WhatsApp updates open wa.me links per consultant (manager sends manually) with AI tips from `whatsapp-ia.functions.ts`; no automated bulk sending.
- Team sharing: all data tables default `user_id` to `data_owner()` (owner resolved via `team_members` by JWT email) and RLS uses `data_owner()`/`can_edit()`; never filter by `auth.uid()` directly so viewers/editors see the owner's data.
- Controle de O.S. weekly imports are stored as full JSON snapshots in `os_imports`; status, "sem mudança" and days-in-status are derived by comparing with the previous snapshot (`src/lib/os-controle.ts`).
- Main sales report aliases (e.g. NAILTON.R/THIERRY.S → NAILTON/THIERRY) live in `nomeVendedor` in `src/lib/sales-report.ts`; parts margin is stored as R$ in `daily_sales.margem_pecas` and % is always derived as margem ÷ peças so totals aggregate correctly.
