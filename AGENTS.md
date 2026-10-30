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
- Consultant ranking and detail panels consume the shared performance calculations; reuse the monthly consultant mix for drill-down so visual changes do not create alternate totals.
- The unchanged-O.S. warning lives only in Controle O.S. (never on Painel); it compares the latest two shared Controle O.S. snapshots using analisar, resolving departments from consultant logins; never infer stagnation from sales freshness.
- The shared notification bell reuses team O.S. reads and the seller-only minhas_os RPC; refresh on focus, timer and O.S. completion events to preserve access isolation and existing acknowledgement semantics.
- Dashboard section wrappers must have module-level component identities, with report mode passed as a prop, so freshness refreshes never reset imports or form state.
- Ranking uses compact seller cards below the desktop table breakpoint with the same computed results; keep all metrics available without horizontal scrolling.
- Open orders use one shared monthly snapshot in open_order_snapshots via auth-protected server functions and team RLS; replace the JSON snapshot atomically to avoid duplicate totals or partial imports.
- Manage the dashboard theme through the shared ThemeProvider, persist the browser choice, and apply it on root HTML with shared CSS tokens so every tab and native input stays consistent.
- Reuse `src/components/painel-ui.tsx` for dashboard formatters/UI and `src/lib/performance.ts` for main consultant, department, total and report calculations to keep tested math shared.
- Agregados data lives in its own tables (`agg_sales`, `agg_goals`, `agg_visits`) and its own component; never mix it into `daily_sales`/`goals` totals — the user tracks it separately.
- AI calls go through Lovable AI Gateway from server-only helpers in `src/lib/ai/*.server.ts`, invoked by auth-protected `createServerFn`s in `src/lib/*.functions.ts`; the browser sends computed stats, never the key.
- All daily imports (sales, open O.S., technicians, agregados) render only in the Importações tab via each component's `modo="importar"`; result tabs stay read-only and Controle O.S. keeps its own weekly import.
- Derive tab freshness from month-scoped update_log records using shared update-status helpers (sourceStatus also flags updates made today, shown as ✅/❌ per Importações block); sales views share their source, Projeção + OS requires both sales and open orders, and Controle O.S. uses its weekly cadence.
- Cumulative main-sales reports use the authenticated SECURITY INVOKER `import_sales_period` RPC to replace included consultants' period atomically and store totals on the final day; period totals cannot reconstruct daily sales.
- Brand primary and performance colors use independent semantic tokens so changing the brand never changes success/warning thresholds.
- Team WhatsApp updates open wa.me links per consultant (manager sends manually) with AI tips from `whatsapp-ia.functions.ts`; no automated bulk sending.
- Team sharing: all data tables default `user_id` to `data_owner()` (owner resolved via `team_members` by JWT email) and RLS uses `data_owner()`/`can_edit()`; never filter by `auth.uid()` directly so viewers/editors see the owner's data.
- Controle de O.S. weekly imports are stored as full JSON snapshots in `os_imports`; status, "sem mudança" and days-in-status are derived by comparing with the previous snapshot (`src/lib/os-controle.ts`).
- Installable "app version" is manifest-only (`public/manifest.webmanifest` + PNG icons in `public/icons/`, head tags in `__root.tsx`); never add a service worker or `vite-plugin-pwa` so Lovable previews stay safe.
- Seller logins: team_members papel 'vendedor' + consultant_id; data_owner() is NULL for them and they read only via SECURITY DEFINER minha_performance; accounts created by criarAcessoVendedor.
- Technician logins use team_members papel 'tecnico' + tecnico_nome; data_owner() is NULL for them and they read only via SECURITY DEFINER meu_desempenho_tecnico RPC.
- Judicial O.S. flag lives in `os_acompanhamento.acoes.__judicial` (os-controle helpers); excluded from Painel warning, bell and `minhas_os`.
- Access: shared `useAccessPresence` confirms RPC writes before seller reads; retry errors, refresh on open/focus/visible/online/timer. History refreshes; keep one owner-scoped row/day.
- Month closing lock lives in `month_locks` (helpers in `src/lib/month-lock.ts`); only the master email may insert/delete via RLS, and sales/agregados imports must check `mesTravado` before writing so closed months stay frozen.
- Navigation has 10 official sidebar tabs (order: cockpit, painel, ranking, agregados, mecanicos, pecas, controle-os, nps, metas, importacoes); Central de Gestão groups painel/proj/os and Importações & Config groups importacoes/config as sub-tabs, so legacy `setTab(...)` deep links (incl. `proj-*`) keep working.

- Subdirectories may have their own `AGENTS.md` (e.g. `src/lib/AGENTS.md`); read it before changing files there.- Desktop tabs must fit one 16:9 screen (checked at 1440×900 and 1920×1080): put long lists in `Box fit="xl:max-h-[calc(100vh-…)]"` internal scroll or collapsed <details>, never extend the page height.

- Restricted roles 'controlador' (Marcos) and 'tunap' (Geraldo) follow the chefe_oficina pattern: data_owner() is NULL and they read only via SECURITY DEFINER RPCs (`painel_oficina`, `tecnicos_carro`, `meu_nps`, `tunap_painel`); shared math in `src/lib/oficina.ts`.
