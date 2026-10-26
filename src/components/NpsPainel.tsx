import { Button } from "@/components/ui/button";

const COLUNAS = ["O.S.", "Data Faturamento", "Cliente", "Telefone", "Consultor", "Nota", "Verbalização"];

export function NpsPainel() {
  const modelo = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + COLUNAS.join(";") + "\n"], { type: "text/csv;charset=utf-8" }));
    a.download = "modelo-nps.csv"; a.click();
  };
  const cards = [["NPS geral", "—"], ["Promotores (9-10)", "—"], ["Neutros (7-8)", "—"], ["Detratores (0-6)", "—"]];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-card p-4">
        <div><h2 className="font-semibold">NPS & Satisfação do Cliente</h2><p className="text-sm text-muted-foreground">Aguardando primeira importação das pesquisas.</p></div>
        <Button variant="outline" onClick={modelo}>Baixar modelo de planilha</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([l, v]) => <div key={l} className="lux-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold text-muted-foreground">{v}</p></div>)}
      </div>
      <section className="lux-card p-4">
        <h3 className="mb-1 font-semibold">Régua preventiva (15 dias após faturamento)</h3>
        <p className="mb-3 text-xs text-muted-foreground">Alerta aos 13 dias: o consultor liga antes do cliente receber a pesquisa da montadora.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr>{["O.S.", "Cliente", "Telefone", "Consultor", "Faturamento", "Pesquisa em", "Contato feito", "Reforçou nota", "Classificação"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead>
          <tbody><tr><td colSpan={9} className="px-2 py-8 text-center text-muted-foreground">Nenhuma O.S. na régua ainda.</td></tr></tbody></table></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="lux-card p-4"><h3 className="font-semibold">Raio-X de verbalizações</h3><p className="mt-2 text-sm text-muted-foreground">Elogios e ofensores aparecerão aqui.</p></section>
        <section className="lux-card p-4"><h3 className="font-semibold">Ranking por consultor</h3><p className="mt-2 text-sm text-muted-foreground">Disponível após a importação.</p></section>
      </div>
    </div>
  );
}
