## Lib rules
- Agregados catalogue (`ITENS`) and parser live in `src/lib/agregados.ts`; add items there. User codes in `agg_codes` override defaults.
- Agregados import replaces only the item group in the report, from month start for cumulative ranking reports (total on last day) or per sale day for item lists, so re-imports never double-count.
- System codes are matched ignoring spaces and case (`normCod`); code lists are split only on comma/semicolon/newline because some codes contain spaces.
- Main sales Excel/paste parsing lives in `src/lib/sales-report.ts` and the import UI in `SalesImport`; match seller login before full name to preserve existing consultant identities.
- Seller aliases live in `nomeVendedor` (`src/lib/sales-report.ts`); parts margin stored in R$, % always derived as margem ÷ peças.
- Open-order import keeps only `TIPOS_OK` types and applies seller aliases.
- Agendamento reports (D+1/D0) are recognised by content in `src/lib/agendamento.ts` (D+1 when period date > print date) and stored as rows `mes = "agenda-AAAA-MM"` in `oficina_mes.diario` keyed `tipo:data`, because migrations could not be created in this environment; move to a dedicated table when possible.
