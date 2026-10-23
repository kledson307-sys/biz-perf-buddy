# FASE 1 — Sistema de Gestão de Performance V1

## Objetivo
Evoluir o `biz-perf-buddy` existente sem reconstruí-lo do zero, preservando as regras de negócio já implementadas e preparando a aplicação para uso pessoal e futura comercialização.

## Regra principal
Nenhuma funcionalidade existente deve ser removida sem validação. A evolução deve ser incremental e reversível.

## V1 — Escopo

### 1. Dashboard executivo
- Serviços: meta, realizado, %, projeção e necessidade diária.
- Peças: meta, realizado, %, projeção e necessidade diária.
- Consolidado: serviços + peças.
- Dias úteis e dias corridos.
- Filtro por mês e departamento.
- Ranking por performance.

### 2. Gestão de performance
- Consultores.
- Técnicos/mecânicos.
- Agregados.
- Comparação meta x realizado.
- Histórico mensal.

### 3. Operação
- Controle de O.S.
- O.S. abertas.
- O.S. sem mudança.
- Importação de vendas.
- Registro de atualização das fontes.

### 4. Gestão
- Metas anuais/mensais.
- Usuários e papéis.
- Permissões.
- Relatório de fechamento.
- Reconhecimento da equipe.

## Arquitetura V1

### Frontend
React + TypeScript + TanStack Router + Recharts + Tailwind/Radix, mantendo a stack atual.

### Dados
Supabase/PostgreSQL como base atual. Não migrar de banco na V1.

### Preparação para comercialização
A partir da V1, todas as novas entidades de negócio devem considerar um `organization_id`/empresa como escopo lógico. A implantação dessa camada deve ser feita em migração controlada, depois de validar o uso atual.

## Ordem de implementação

1. **Congelar regras atuais** — documentar fórmulas e exceções.
2. **Validar dashboard** — comparar números com a planilha real do gestor.
3. **Padronizar importação** — validar colunas, tipos e duplicidades.
4. **Fortalecer testes** — criar testes para as fórmulas de performance/projeção.
5. **Separar configurações** — metas, parâmetros e exceções fora da lógica visual.
6. **Melhorar navegação** — estrutura clara para Dashboard, Performance, Operação, Relatórios e Administração.
7. **Preparar multiempresa** — somente após os itens anteriores estarem estáveis.

## Critérios de aceite

- Os valores do dashboard devem bater com a fonte oficial para um mês de referência.
- Alterar o mês não pode misturar vendas, metas ou parâmetros de meses diferentes.
- Importar o mesmo arquivo duas vezes não deve duplicar resultados.
- Usuários com papéis diferentes devem visualizar somente o que lhes pertence.
- Fórmulas de performance, projeção e necessidade diária devem possuir testes automatizados.
- O sistema deve continuar funcionando no celular.

## Fora da V1
- Marketplace.
- Cobrança/assinaturas.
- Aplicativo nativo de App Store.
- Integrações comerciais complexas.
- IA autônoma tomando decisões de gestão.

Esses itens entram somente depois de o núcleo de performance estar estável.

## Implementação inicial — 22/10/2026

- O núcleo de cálculo foi extraído para `src/lib/performance.ts`.
- Dashboard, totais e relatórios passam a usar a mesma função `calcPerformance`.
- Foram adicionados testes automatizados para realizado, meta, performance, projeção, necessidade diária, margem e cenários sem dias/metas.
- A extração reduz o risco de fórmulas divergentes entre telas à medida que o produto evoluir.


## Implementação adicional — 22/10/2026

- O núcleo de cálculo normaliza valores não finitos e dias negativos.
- Foram adicionados testes para entradas inválidas.
- Criados `.env.example` e `DEPLOYMENT_CHECKLIST.md` para orientar configuração e publicação segura.
- A publicação em produção não foi executada nesta sessão; consultar o checklist e validar no Lovable antes de liberar.
