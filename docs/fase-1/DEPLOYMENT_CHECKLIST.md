# Publicação segura — Fase 1 no Lovable Cloud

## Escopo desta integração

O módulo `src/lib/performance.ts` e seus testes foram incorporados do pacote
`biz-perf-buddy-FASE-1-deploy-preparado.zip`. O Painel principal usa esse núcleo
para consultores, departamentos, totais, rankings de consultores e relatório.
As telas, importações, permissões e os cálculos específicos de técnicos,
agregados e Projeção + OS não foram substituídos.

`AUDITORIA_FASE_1.md` e `FASE_1_V1.md` são referências originais do pacote.
Suas descrições de estado, configuração e planos futuros não comprovam ações
executadas neste projeto. Multiempresa é uma proposta futura, não uma regra
adotada: o compartilhamento atual continua usando `data_owner()` / `can_edit()`.

## Ambiente gerenciado

- Manter os clientes e configurações gerados pelo Lovable Cloud.
- Não solicitar nem copiar service-role keys; elas não são disponibilizadas ao
  usuário no Lovable Cloud. Segredos privados nunca ficam no navegador.
- Não reaplicar migrações antigas ou mudar políticas de acesso por causa deste
  pacote. Esta integração não precisa de migrações ou novos segredos.
- Usar Bun para dependências e Vitest para testes. A prévia verifica a compilação
  automaticamente; não iniciar builds manuais no ambiente gerenciado.

## Conferências

- [ ] Testes de performance e regressões existentes aprovados.
- [ ] Prévia sem erros de compilação ou de execução.
- [ ] Números do Painel e ranking conferidos antes/depois com dados reais.
- [ ] Conferência de um mês fechado com a planilha oficial do gestor.
- [ ] Login e limites de acesso dos diferentes perfis conferidos antes de
  alterações futuras em permissões.
- [ ] Reimportação sem duplicação conferida antes de alterações futuras nos
  importadores.
- [ ] Publicação solicitada explicitamente e resultado conferido no link oficial.

A integração não equivale à publicação. Não marcar conferências não executadas
como concluídas nem tratar esta documentação como auditoria de segurança completa.