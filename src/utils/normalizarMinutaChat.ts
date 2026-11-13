// A IA do chat às vezes devolve a minuta inteira dentro de UM campo (ex.: tudo no "title"), deixando relatório, fundamentação e dispositivo vazios ou iguais aos antigos.
// Aí a minuta de cima não muda e o título vira um bloco sem formatação. Esta função separa o bloco nas três partes e avisa quando, no fim, o texto não mudou.
export interface MinutaChat { title?: string; relatorio?: string; fundamentacao?: string; dispositivo?: string; closing?: string; fullFormattedText?: string; [k: string]: any }
const CAMPOS = ["title", "relatorio", "fundamentacao", "dispositivo", "closing"] as const;
const compacta = (s: any) => String(s ?? "").replace(/\s+/g, " ").trim();
const RE_REL = /(?:^|[\s.])(?:I\s*[-–.]\s*)?RELAT[ÓO]RIO\b[\s:.\-–]*/, RE_FUN = /(?:^|[\s.])(?:II\s*[-–.]\s*)?FUNDAMENTA[ÇC][ÃA]O\b[\s:.\-–]*/, RE_DIS = /(?:^|[\s.])(?:III\s*[-–.]\s*)?DISPOSITIVO\b[\s:.\-–]*/;

/** Separa um texto corrido com os títulos RELATÓRIO, FUNDAMENTAÇÃO e DISPOSITIVO (nessa ordem, em maiúsculas). Devolve null se não achar os três. */
export function separarPartes(texto: string): { antes: string; relatorio: string; fundamentacao: string; dispositivo: string } | null {
  const t = String(texto || "");
  const m1 = RE_REL.exec(t); if (!m1) return null;
  const i1 = m1.index + (m1[0].match(/^[\s.]/) ? 1 : 0), f1 = m1.index + m1[0].length;
  const resto1 = t.slice(f1), m2 = RE_FUN.exec(resto1); if (!m2) return null;
  const i2 = f1 + m2.index + (m2[0].match(/^[\s.]/) ? 1 : 0), f2 = f1 + m2.index + m2[0].length;
  const resto2 = t.slice(f2), m3 = RE_DIS.exec(resto2); if (!m3) return null;
  const i3 = f2 + m3.index + (m3[0].match(/^[\s.]/) ? 1 : 0), f3 = f2 + m3.index + m3[0].length;
  return { antes: t.slice(0, i1).trim(), relatorio: t.slice(f1, i2).trim(), fundamentacao: t.slice(f2, i3).trim(), dispositivo: t.slice(f3).trim() };
}

export function normalizarMinutaDoChat(nova: MinutaChat | undefined | null, atual: MinutaChat | undefined | null): { minuta: MinutaChat; reparada: boolean; semMudanca: boolean } {
  const m: MinutaChat = { ...(nova || {}) }; let reparada = false;
  // 1) algum campo com a minuta inteira? (texto longo com os três títulos)
  const candidatos: (keyof MinutaChat)[] = [...CAMPOS, "fullFormattedText"];
  for (const campo of candidatos) {
    const v = String(m[campo] ?? ""); if (v.length < 600) continue;
    const partes = separarPartes(v); if (!partes) continue;
    const ehCampoDeSecao = campo === "relatorio" || campo === "fundamentacao" || campo === "dispositivo";
    if (campo === "fullFormattedText" && (compacta(m.relatorio) && compacta(m.fundamentacao) && compacta(m.dispositivo))) continue;      // o texto completo é só consequência: as partes já vieram
    if (ehCampoDeSecao && partes.relatorio.length < 20 && partes.fundamentacao.length < 20) continue;      // seção que apenas cita a palavra "dispositivo"
    m.relatorio = partes.relatorio; m.fundamentacao = partes.fundamentacao; m.dispositivo = partes.dispositivo;
    if (campo === "title") m.title = compacta(atual?.title) ? atual!.title : (partes.antes.split(/\n| {2,}/)[0] || "").slice(0, 160);
    reparada = true; break;
  }
  if (compacta(m.title).length > 300) { m.title = compacta(atual?.title) ? atual!.title : compacta(m.title).slice(0, 160); reparada = true; }
  // 2) o texto da minuta de fato mudou?
  const igual = (k: "relatorio" | "fundamentacao" | "dispositivo") => compacta(m[k] ?? atual?.[k]) === compacta(atual?.[k]);
  const semMudanca = !!atual && igual("relatorio") && igual("fundamentacao") && igual("dispositivo");
  return { minuta: m, reparada, semMudanca };
}
