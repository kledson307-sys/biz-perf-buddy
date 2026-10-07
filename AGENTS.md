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
- Agregados item catalogue is the `ITENS` constant in `src/components/Agregados.tsx` keyed by a stable `item` text; adding an item only requires a new entry there.
