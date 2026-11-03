## Lib rules
- Technician month continuity uses SECURITY INVOKER inicializar_tecnicos_mes for entirely empty unlocked months, copying the immediately preceding roster/groups/targets with zero production; copiar_metas_tecnicos updates only existing targets. Goals sub-tabs reuse existing editors and separate data sources.
- Agregados catalogue (`ITENS`) and parser live in `src/lib/agregados.ts`; add items there. User codes in `agg_codes` override defaults.
- Agregados import replaces only the item group in the report, from month start for cumulative ranking reports (total on last day) or per sale day for item lists, so re-imports never double-count.
- System codes are matched ignoring spaces and case (`normCod`); code lists are split only on comma/semicolon/newline because some codes contain spaces.
- Main sales Excel/paste parsing lives in `src/lib/sales-report.ts` and the import UI in `SalesImport`; match seller login before full name to preserve existing consultant identities.
- Seller aliases live in `nomeVendedor` (`src/lib/sales-report.ts`); parts margin stored in R$, % always derived as margem ÷ peças.
- Open-order import keeps only `TIPOS_OK` types and applies seller aliases.
- Agendamento reports (D+1/D0) are recognised by content in `src/lib/agendamento.ts` (D+1 when period date > print date) and stored as rows `mes = "agenda-AAAA-MM"` in `oficina_mes.diario` keyed `tipo:data`, because migrations could not be created in this environment; move to a dedicated table when possible.

- Executive PDF report: analysis rules in `src/lib/relatorio-executivo.ts` (pure, tested) and jsPDF drawing in `relatorio-executivo-pdf.ts`, dynamically imported from `RelatorioExecutivo` in the Cockpit; it reuses Dashboard-computed values, never lets text invent numbers, and keeps a fixed 4-page layout (overflow trimmed, not paginated) so the closing/signature page always exists.
- Passagens: lines with empty Produtivo inherit the technician of the same O.S.; importing Passagens auto-closes matching active Controle O.S. items (`osFaturadasAtivas` → `__encerrado` with `auto: true`) because billed O.S. are finished.
- Oficina bell (Marcos/Delmir) reads only SECURITY DEFINER RPCs (`painel_oficina`, `oficina_agenda_alertas`, `meu_nps`) since data_owner() is NULL for them.
- Sininho/avisos: `src/lib/aviso-aparelho.ts` sets the app badge and native notifications without a service worker, deduping ids in localStorage.
- First-access guide and release notes live in `src/lib/guia.ts` (bump `NOVIDADES` version per release); seen state is per email in localStorage.
