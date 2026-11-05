/** Conteúdo do guia de primeiro acesso (por perfil) e das novidades de cada atualização. */
export type Passo = { titulo: string; texto: string };

const GESTOR: Passo[] = [
  { titulo: "Dashboard", texto: "Visão do mês: anéis de meta (verde ≥100%, amarelo ≥85%, vermelho abaixo), ritmo diário necessário, alertas e o botão do Relatório Executivo em PDF. Cada bloco leva à aba responsável." },
  { titulo: "Central de Gestão", texto: "Painel por departamento, projeção do mês (só faturado ou com O.S. abertas) e as O.S. em aberto." },
  { titulo: "Consultores", texto: "Ranking com realizado, projeção e quanto falta por dia; qualidade e mix de passagens do departamento escolhido." },
  { titulo: "Agregados", texto: "Vendas de Limpar, Alinhamento, Oxi, Brazzo e Tunap por consultor, com conversão por passagem. Não somam no faturamento principal." },
  { titulo: "Oficina & Técnicos", texto: "Produção por técnico, mix de passagens, peças por R$ 1 de mão de obra (ideal R$ 2,50 a R$ 3,50) e RACs/retornos." },
  { titulo: "Peças & Estoque", texto: "Faturamento e margem de peças, colorida pela margem ideal de cada departamento." },
  { titulo: "Ordens de Serviço", texto: "Controle semanal das O.S.: status, dias no pátio (verde ≤20, amarelo >20, vermelho >30), judiciais e encerramento automático quando a O.S. é faturada." },
  { titulo: "NPS & Satisfação", texto: "Promotores, neutros e detratores, metas Carro 85% e Moto 88%, e a fila de follow-up." },
  { titulo: "Metas & Planejamento", texto: "Dias úteis, metas por departamento, consultor, técnico e agendamento." },
  { titulo: "Importações & Configurações", texto: "Suba aqui as planilhas do dia. O sistema reconhece pelo conteúdo; os avisos ✅/❌ mostram o que já foi atualizado hoje." },
  { titulo: "Sininho", texto: "Mostra os alertas pendentes. Toque em “Ativar avisos no aparelho” para receber o aviso no celular e o número no ícone do app." },
];

export const GUIA: Record<string, Passo[]> = {
  gestor: GESTOR,
  vendedor: [
    { titulo: "Minha Performance", texto: "Seu realizado do mês contra a meta, ritmo e quanto falta por dia, separado em Serviços e Peças." },
    { titulo: "Mix de passagens", texto: "Quantos carros você atendeu por tipo (BSI, Revisão, Garantia, Reparo) e agregados vendidos por passagem." },
    { titulo: "Detalhes", texto: "Retornos das O.S., agendamentos e NPS dos seus clientes." },
    { titulo: "Sininho", texto: "Avisa O.S. com retorno pendente. Ative os avisos no aparelho para receber no celular." },
  ],
  tecnico: [
    { titulo: "Meu Desempenho", texto: "Sua produção do mês, ticket por passagem e quanto falta por dia para a meta." },
    { titulo: "Peças por R$ 1 de M.O.", texto: "Quanto de peça saiu para cada real de mão de obra. O ideal fica entre R$ 2,50 e R$ 3,50." },
    { titulo: "Qualidade técnica", texto: "Retornos e RACs ligados às suas O.S." },
  ],
  oficina: [
    { titulo: "Pátio & O.S.", texto: "Veículos em aberto, dias no pátio, aguardando peças, orçamentos e judiciais." },
    { titulo: "Técnicos", texto: "Produção e qualidade dos técnicos, retornos por chassi e RACs." },
    { titulo: "Sininho", texto: "Diagnóstico parado há mais de 3 dias, peça há mais de 7 dias, cliente detrator agendado para amanhã e fila do testador. Ative os avisos no aparelho." },
  ],
  tunap: [
    { titulo: "Vendas Tunap", texto: "Vendas Tunap do mês por consultor e conversão por passagem." },
    { titulo: "Técnicos de Carro", texto: "Acompanhamento dos técnicos de Carro cadastrados." },
  ],
};

export function perfilGuia(papel: string | null | undefined): string {
  if (papel === "vendedor" || papel === "tecnico" || papel === "tunap") return papel;
  if (papel === "chefe_oficina" || papel === "controlador") return "oficina";
  return "gestor";
}

/** Novidades: adicione uma entrada no topo a cada atualização; a versão mais alta é mostrada uma vez por usuário. */
export type Novidade = { versao: number; data: string; itens: { titulo: string; oque: string; como: string }[] };
export const NOVIDADES: Novidade[] = [
  {
    versao: 3, data: "05/11/2026",
    itens: [
      { titulo: "Importação mais inteligente", oque: "Cada planilha agora alimenta todas as abas que pode — a de O.S. Fechadas atualiza consultores, técnicos, passagens e Controle O.S. de uma vez.", como: "Solte os arquivos em Importações e confira a lista de destinos antes de salvar." },
      { titulo: "Técnicos em uma tela", oque: "O painel dos técnicos ficou compacto: todos aparecem sem rolar, com meta, % e projeção.", como: "Abra Oficina & Técnicos e escolha Carro ou Moto." },
      { titulo: "Virada de mês e Excel", oque: "Lista do que falta preparar no mês, cópia de metas do mês anterior e exportação do mês em Excel.", como: "Metas & Planejamento › Acompanhamento & Geral." },
    ],
  },
  {
    versao: 2, data: "01/11/2026",
    itens: [
      { titulo: "Metas organizadas", oque: "Metas & Planejamento agora separa acompanhamento, consultores, técnicos e agregados/agenda.", como: "Abra Metas & Planejamento e escolha a sub-aba Técnicos para editar individualmente, aplicar em lote ou copiar metas anteriores." },
      { titulo: "Equipe técnica no mês novo", oque: "Meses vazios herdam a equipe e as metas anteriores, sem copiar produção.", como: "Selecione o mês no topo e confira as metas. Novembro já está preparado." },
      { titulo: "Acessos e mês fechado", oque: "Marcos, Delmir e Geraldo têm seus acessos operacionais corrigidos; meses fechados bloqueiam alterações técnicas.", como: "Entre com seu acesso habitual. Alterações em mês fechado exigem reabertura pelo gestor." },
    ],
  },
  {
    versao: 1, data: "01/11/2026",
    itens: [
      { titulo: "Avisos no celular e no ícone do app", oque: "O sininho agora mostra o número de alertas no ícone do app e pode avisar no celular.", como: "Abra o sininho e toque em “Ativar avisos no aparelho”. No iPhone, adicione o app à Tela de Início antes." },
      { titulo: "O.S. faturadas encerradas sozinhas", oque: "Ao importar as passagens, as O.S. faturadas saem do Controle de O.S.", como: "Importe normalmente; a mensagem mostra quantas foram encerradas." },
      { titulo: "Técnicos com passagens completas", oque: "Linhas sem técnico usam o técnico da mesma O.S., e as passagens de Moto passaram a contar.", como: "Veja em Oficina & Técnicos." },
      { titulo: "Guia da tela", oque: "Explicação de cada tela para quem está começando.", como: "Toque no botão “?” no canto da tela quando quiser rever." },
    ],
  },
];
export const VERSAO_ATUAL = Math.max(...NOVIDADES.map((n) => n.versao));

/** O que mostrar no login: guia para quem nunca viu; novidades para quem já usava e não viu a versão atual. */
export function oQueMostrar(guiaVisto: boolean, versaoVista: number): "guia" | "novidades" | null {
  if (!guiaVisto) return "guia";
  return versaoVista < VERSAO_ATUAL ? "novidades" : null;
}
