/** Contador no ícone do app e avisos nativos do aparelho para o sininho (sem service worker). */
type Nav = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
const KEY = "avisos-ja-emitidos";

export function atualizarBadge(n: number) {
  const nav = navigator as Nav;
  try {
    if (n > 0) void nav.setAppBadge?.(n).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  } catch { /* navegador sem suporte */ }
}

export const avisosSuportados = () => typeof window !== "undefined" && "Notification" in window;
export const avisosAtivos = () => avisosSuportados() && Notification.permission === "granted";

export async function ativarAvisos(): Promise<boolean> {
  if (!avisosSuportados()) return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Separa os alertas ainda não avisados; mantém só ids ainda pendentes para não repetir. */
export function novosParaAvisar(ids: string[], jaEmitidos: string[]): { novos: string[]; guardar: string[] } {
  const set = new Set(jaEmitidos);
  return { novos: ids.filter((id) => !set.has(id)), guardar: ids };
}

export function avisarNovos(items: { id: string; titulo: string; texto: string; feito: boolean }[]) {
  const pend = items.filter((i) => !i.feito);
  let ant: string[] | null = null;
  try { ant = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { ant = null; }
  const { novos, guardar } = novosParaAvisar(pend.map((i) => i.id), ant ?? []);
  localStorage.setItem(KEY, JSON.stringify(guardar));
  if (ant === null || !avisosAtivos() || !novos.length) return; // primeira leitura não dispara avalanche
  const lista = pend.filter((i) => novos.includes(i.id));
  const titulo = lista.length === 1 ? lista[0]!.titulo : `${lista.length} novos alertas na HAUS MOTORS`;
  const body = lista.length === 1 ? lista[0]!.texto : lista.slice(0, 3).map((i) => i.titulo).join("\n");
  try {
    const n = new Notification(titulo, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "sininho" });
    n.onclick = () => { window.focus(); n.close(); };
    navigator.vibrate?.(200);
  } catch { /* alguns celulares só permitem com o app instalado */ }
}
