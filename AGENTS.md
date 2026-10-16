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
- Painel's unchanged-O.S. warning compares the latest two shared Controle O.S. snapshots using analisar, resolving departments from consultant logins; never infer stagnation from sales freshness.
- The shared notification bell reuses team O.S. reads and the seller-only minhas_os RPC; refresh on focus, timer and O.S. completion events to preserve access isolation and existing acknowledgement semantics.
- Dashboard section wrappers must have module-level component identities, with report mode passed as a prop, so freshness refreshes never reset imports or form state.
- Ranking uses compact seller cards below the desktop table breakpoint with the same computed results; keep all metrics available without horizontal scrolling.
- Open orders use one shared monthly snapshot in open_order_snapshots via auth-protected server functions and team RLS; replace the JSON snapshot atomically to avoid duplicate totals or partial imports.
- Manage the dashboard theme through the shared ThemeProvider, persist the browser choice, and apply it on root HTML with shared CSS tokens so every tab and native input stays consistent.
- Shared dashboard formatters and UI primitives live in `src/components/painel-ui.tsx`; import from there instead of redefining them in routes.
- Agregados data lives in its own tables (`agg_sales`, `agg_goals`, `agg_visits`) and its own component; never mix it into `daily_sales`/`goals` totals — the user tracks it separately.
- Agregados item catalogue (`ITENS`, with default system service codes) and the system-report parser live in `src/lib/agregados.ts`; adding an item only requires a new entry there. User-edited codes per item are stored in `agg_codes` and override the defaults.
- Agregados import replaces only the item group in the report, from month start for cumulative ranking reports (total on last day) or per sale day for item lists, so re-imports never double-count.
- System codes are matched ignoring spaces and case (`normCod`); code lists are split only on comma/semicolon/newline because some codes contain spaces.
- AI calls go through Lovable AI Gateway from server-only helpers in `src/lib/ai/*.server.ts`, invoked by auth-protected `createServerFn`s in `src/lib/*.functions.ts`; the browser sends computed stats, never the key.
- Main sales Excel/paste parsing lives in `src/lib/sales-report.ts` and the import UI in `SalesImport`; match seller login before full name to preserve existing consultant identities.
- All daily imports (sales, open O.S., technicians, agregados) render only in the Importações tab via each component's `modo="importar"`; result tabs stay read-only and Controle O.S. keeps its own weekly import.
- Derive tab freshness from month-scoped update_log records using shared update-status helpers; sales views share their source, Projeção + OS requires both sales and open orders, and Controle O.S. uses its weekly cadence so unrelated imports never clear alerts.
- Cumulative main-sales reports use the authenticated SECURITY INVOKER `import_sales_period` RPC to replace included consultants' period atomically and store totals on the final day; period totals cannot reconstruct daily sales.
- Brand primary and performance colors use independent semantic tokens so changing the brand never changes success/warning thresholds.
- Team WhatsApp updates open wa.me links per consultant (manager sends manually) with AI tips from `whatsapp-ia.functions.ts`; no automated bulk sending.
- Team sharing: all data tables default `user_id` to `data_owner()` (owner resolved via `team_members` by JWT email) and RLS uses `data_owner()`/`can_edit()`; never filter by `auth.uid()` directly so viewers/editors see the owner's data.
- Controle de O.S. weekly imports are stored as full JSON snapshots in `os_imports`; status, "sem mudança" and days-in-status are derived by comparing with the previous snapshot (`src/lib/os-controle.ts`).
- Seller aliases live in `nomeVendedor` (`src/lib/sales-report.ts`); parts margin stored in R$, % always derived as margem ÷ peças.
- Installable "app version" is manifest-only (`public/manifest.webmanifest` + PNG icons in `public/icons/`, head tags in `__root.tsx`); never add a service worker or `vite-plugin-pwa` so Lovable previews stay safe.
- Seller logins: team_members papel 'vendedor' + consultant_id; data_owner() is NULL for them and they read only via SECURITY DEFINER minha_performance; accounts created by criarAcessoVendedor.
- Technician logins use team_members papel 'tecnico' + tecnico_nome; data_owner() is NULL for them and they read only via SECURITY DEFINER meu_desempenho_tecnico RPC.
- Judicial O.S. flag lives in `os_acompanhamento.acoes.__judicial` (os-controle helpers); excluded from Painel warning, bell and `minhas_os`.
- Access frequency: `registrar_acesso` RPC writes one `access_log` row per user/day (owner-scoped).
- Open-order import keeps only `TIPOS_OK` types and applies seller aliases.
