# Auditoria inicial — biz-perf-buddy

## Estrutura encontrada
- 116 arquivos em `src`.
- React 19 + TypeScript.
- TanStack Start/Router.
- Supabase/PostgreSQL.
- Drizzle.
- Recharts.
- XLSX/SheetJS.
- Vitest.
- Autenticação e papéis de usuário.

## Módulos encontrados
- Dashboard principal.
- Minha Performance.
- Desempenho técnico.
- Chefe de oficina.
- Metas anuais.
- Importação de vendas.
- Mecânicos.
- Agregados.
- Controle de O.S.
- O.S. abertas.
- O.S. sem mudança.
- Rankings.
- Relatório/fechamento.
- Reconhecimento.
- Usuários e acessos.
- Notificações.
- WhatsApp.

## Fórmulas observadas
O código calcula realizado, meta, projeção, performance, percentual de projeção, média diária e necessidade para o restante do período, com opção de base em dias úteis ou dias corridos.

## Pontos de atenção
1. A execução completa do build/teste não foi validada neste ambiente porque a instalação das dependências não foi concluída dentro do limite disponível.
2. As regras de negócio devem ser congeladas antes de grandes alterações visuais.
3. Importações precisam de proteção contra duplicidade e validação de colunas.
4. A futura camada multiempresa deve ser introduzida por migração controlada, sem quebrar os dados atuais.
5. Variáveis e segredos de servidor nunca devem ser enviados ao frontend.

## Decisão
O projeto atual deve ser tratado como a base oficial da Fase 1. Não reconstruir do zero no Lovable.
