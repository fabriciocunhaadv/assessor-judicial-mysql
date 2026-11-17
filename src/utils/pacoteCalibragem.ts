// Pacote de calibragem: um arquivo de texto (Markdown) com TUDO das comparações escolhidas (padrões, mudanças e os textos inteiros: gerado pelo Studio e lançado no Projudi),
// para o Super Admin levar ao laboratório (conversa com o Claude) e calibrar prompts e o Studio. A minuta LANÇADA é a REFERÊNCIA.
export interface DocPacote {
  id?: string; processo: string; ato?: string; geradoEm: number; promptTitulo?: string; motor?: string; por?: string;
  aproveitamentoPct?: number; coberturaPct?: number; palavrasOriginal?: number; palavrasLancado?: number; mantidas?: number; removidas?: number; acrescentadas?: number;
  dispositivoMudou?: boolean; porSecao?: { secao: string; aproveitamentoPct: number; palavrasOriginais?: number }[];
  mudancas?: { tipo: string; secao: string; original?: string; lancado?: string }[];
  assinado?: { aproveitamentoLancadaPct?: number; aproveitamentoGeradaPct?: number | null; dispositivoMudouDaLancada?: boolean; arquivo?: string; mudancas?: { tipo: string; secao: string; original?: string; lancado?: string }[] };
  textoGerado?: string; textoLancado?: string;
}
const data = (t: number) => { try { return new Date(t).toLocaleString("pt-BR"); } catch { return String(t); } };
const cerca = (t: string) => { const n = Math.max(3, ...[...String(t || "").matchAll(/`{3,}/g)].map((m) => m[0].length + 1)); const c = "`".repeat(n); return `${c}\n${String(t || "").trim()}\n${c}`; };
const media = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0);

export function montarPacoteCalibragem(docs: DocPacote[], geradoEm = Date.now()): string {
  const L: string[] = [];
  L.push("# PACOTE DE CALIBRAGEM DO STUDIO (Assessor Judicial)");
  L.push(`Gerado em ${data(geradoEm)} · ${docs.length} comparação(ões)`);
  L.push("");
  L.push("## Como ler");
  L.push("- A minuta **LANÇADA no Projudi é a REFERÊNCIA** (é a que vale: o que o juiz/assessor quis). A minuta **GERADA** é a tentativa do Studio. Quando divergem, o ajuste é no Studio/prompt.");
  L.push("- **Aproveitamento** = % das palavras da gerada que sobraram na lançada. **Cobertura** = % das palavras da lançada que o Studio já tinha acertado.");
  L.push("- Pedido ao Claude: analise as diferenças entre GERADA e LANÇADA, aponte os padrões (estrutura, tamanho, ordem, detalhe, linguagem), proponha instruções de prompt e mostre o texto EXATO antes de qualquer mudança no código.");
  L.push("");
  const apCob = docs.filter((d) => typeof d.coberturaPct === "number");
  L.push("## Resumo geral");
  L.push(`- Comparações: ${docs.length}`);
  L.push(`- Aproveitamento médio: ${media(docs.map((d) => Number(d.aproveitamentoPct) || 0))}%`);
  L.push(`- Cobertura média da lançada: ${media(apCob.map((d) => d.coberturaPct as number))}%`);
  L.push(`- Dispositivo diferente: ${docs.filter((d) => d.dispositivoMudou).length} de ${docs.length}`);
  L.push(`- Com documento assinado comparado: ${docs.filter((d) => d.assinado).length}`);
  const porAto = new Map<string, number>(); for (const d of docs) porAto.set(d.ato || "(sem ato)", (porAto.get(d.ato || "(sem ato)") || 0) + 1);
  L.push(`- Por ato: ${[...porAto.entries()].map(([k, v]) => `${k} ${v}`).join(" · ") || "-"}`);
  L.push("");
  docs.forEach((d, i) => {
    L.push("---");
    L.push(`## Comparação ${i + 1} de ${docs.length} — processo ${d.processo}`);
    L.push(`- Data: ${data(d.geradoEm)} · Ato: ${d.ato || "?"} · Prompt: ${d.promptTitulo || "(sem informação)"} · Motor: ${d.motor || "(sem informação)"}${d.por ? ` · Por: ${d.por}` : ""}`);
    L.push(`- Aproveitamento: ${d.aproveitamentoPct ?? "?"}% · Cobertura: ${d.coberturaPct ?? "?"}% · Palavras: gerada ${d.palavrasOriginal ?? "?"} / lançada ${d.palavrasLancado ?? "?"} · mantidas ${d.mantidas ?? "?"} · cortadas ${d.removidas ?? "?"} · acrescentadas ${d.acrescentadas ?? "?"}`);
    if (d.porSecao?.length) L.push(`- Por seção: ${d.porSecao.map((s) => `${s.secao} ${s.aproveitamentoPct}%`).join(" · ")}`);
    L.push(`- Dispositivo (resultado) diferente da gerada: ${d.dispositivoMudou ? "SIM" : "não"}`);
    if (d.assinado) L.push(`- Documento assinado${d.assinado.arquivo ? ` (${d.assinado.arquivo})` : ""}: manteve ${d.assinado.aproveitamentoLancadaPct ?? "?"}% da lançada${typeof d.assinado.aproveitamentoGeradaPct === "number" ? ` e ${d.assinado.aproveitamentoGeradaPct}% da gerada` : ""}${d.assinado.dispositivoMudouDaLancada ? " · dispositivo mudou na assinatura" : ""}`);
    L.push("");
    L.push("### MINUTA LANÇADA NO PROJUDI (REFERÊNCIA)");
    L.push(d.textoLancado ? cerca(d.textoLancado) : "(texto não guardado)");
    L.push("");
    L.push("### MINUTA GERADA PELO STUDIO");
    L.push(d.textoGerado ? cerca(d.textoGerado) : "(texto não guardado)");
    const mud = (d.mudancas || []).filter((m) => m.tipo !== "igual");
    if (mud.length) {
      L.push(""); L.push("### O que mudou (gerada → lançada)");
      for (const m of mud) L.push(`- **${m.tipo === "removido" ? "CORTADO" : m.tipo === "adicionado" ? "ACRESCENTADO" : "ALTERADO"}** (${m.secao})${m.original ? ` — Studio: ${String(m.original).replace(/\s+/g, " ")}` : ""}${m.lancado ? ` — Lançada: ${String(m.lancado).replace(/\s+/g, " ")}` : ""}`);
    }
    const ma = d.assinado?.mudancas || [];
    if (ma.length) {
      L.push(""); L.push("### O que mudou depois (lançada → assinada)");
      for (const m of ma) L.push(`- **${m.tipo === "removido" ? "CORTADO" : m.tipo === "adicionado" ? "ACRESCENTADO" : "ALTERADO"}** (${m.secao})${m.original ? ` — Lançada: ${String(m.original).replace(/\s+/g, " ")}` : ""}${m.lancado ? ` — Assinada: ${String(m.lancado).replace(/\s+/g, " ")}` : ""}`);
    }
    L.push("");
  });
  return L.join("\n");
}
