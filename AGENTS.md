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
- Shared dashboard formatters and UI primitives live in `src/components/painel-ui.tsx`; import from there instead of redefining them in routes.
- Agregados data lives in its own tables (`agg_sales`, `agg_goals`, `agg_visits`) and its own component; never mix it into `daily_sales`/`goals` totals — the user tracks it separately.
- Agregados item catalogue (`ITENS`, with default system service codes) and the system-report parser live in `src/lib/agregados.ts`; adding an item only requires a new entry there. User-edited codes per item are stored in `agg_codes` and override the defaults.
- Agregados Excel import replaces only the item group (serviços or peças) found in the report for the whole report period and stores the period total on its last day, so re-importing never double-counts and importing one group never wipes the other.
- System codes are matched ignoring spaces and case (`normCod`); code lists are split only on comma/semicolon/newline because some codes contain spaces.
- AI calls go through Lovable AI Gateway from server-only helpers in `src/lib/ai/*.server.ts`, invoked by auth-protected `createServerFn`s in `src/lib/*.functions.ts`; the browser sends computed stats, never the key.
