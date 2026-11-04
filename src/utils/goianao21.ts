// Goianão 2027 (Edital 01/2026), AGRUPAMENTO 21 (Vara Única I): só os critérios que valem para o grupo, com a pontuação pelas fórmulas do Anexo I.
// É estimativa: a pontuação oficial sai do DataJud, no painel do TJGO (Gestão à Vista). Abaixo das faixas, o edital não prevê pontos (conferir no painel oficial).
export type Quadrante = "" | "1" | "2" | "3";
export interface Valores21 {
  meta1Novos: string; meta1Julgados: string;          // Meta Nacional 1 (conhecimento): julgados ÷ casos novos
  iadNovos: string; iadBaixados: string;              // IAD (conhecimento + execução): baixados ÷ casos novos
  antigosPendentes: string; antigosJulgados: string;  // distribuídos até 31/07/2021 e pendentes líquidos em 31/07/2026
  quadrante: Quadrante;                               // tempo médio dos pendentes líquidos, quadrante no agrupamento
  poloAtivo: string; poloPassivo: string;             // % de processos com CPF/CNPJ válido
  homNum: string; homDen: string;                     // vazio = usa os números do Studio
  peticaoDias: string;                                // média de dias até o 1º movimento de magistrado
  reuniao1: boolean; reuniao2: boolean;               // atas juntadas no PROAD
  reducaoImpressoras: string;                         // % de redução do parque de impressão
}
export const VALORES_VAZIOS: Valores21 = { meta1Novos: "", meta1Julgados: "", iadNovos: "", iadBaixados: "", antigosPendentes: "", antigosJulgados: "", quadrante: "", poloAtivo: "", poloPassivo: "", homNum: "", homDen: "", peticaoDias: "", reuniao1: false, reuniao2: false, reducaoImpressoras: "" };
export const MAXIMO_21 = 310;      // 50+50+50+50+50+20+20+20 (o Bônus Verde, até 20, é extra)
export const LIMITE_DIAMANTE = 0.95;

const num = (s: string): number | null => { const n = parseFloat(String(s ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const pct = (a: string, b: string): number | null => { const x = num(a), y = num(b); return x !== null && y !== null && y > 0 ? (x / y) * 100 : null; };
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Criterio { id: string; item: string; titulo: string; max: number; pontos: number | null; resumo: string; falta?: string; medido: boolean }
/** 90% → 30 pontos; +2 por ponto percentual acima de 90, até 100% (50). Abaixo de 90%: sem pontos previstos no edital. */
export const pontosMetaIad = (p: number) => (p < 90 ? 0 : Math.min(50, 30 + 2 * (Math.min(p, 100) - 90)));
export const pontosAntigos = (p: number) => Math.min(50, Math.floor(p / 0.5) * 0.25);
/** 25% → 10 pontos; +1 ponto a cada 0,5 ponto percentual acima de 25%, até 20. */
export const pontosHomologatorias = (p: number) => (p < 25 ? 0 : Math.min(20, 10 + Math.floor((p - 25) / 0.5)));
export const pontosQuadrante = (q: Quadrante) => (q === "1" ? 50 : q === "2" ? 35 : q === "3" ? 20 : null);
export const pontosPeticao = (dias: number) => (dias <= 10 ? 20 : dias <= 20 ? 10 : 0);
export const pontosBonusVerde = (reducao: number) => (reducao > 25 ? 20 : reducao >= 15 ? 10 : 0);

export function calcular21(v: Valores21, studio: { homologatorias: number; julgamentos: number }): { criterios: Criterio[]; total: number; maximoAvaliado: number; bonus: Criterio; percentual: number; diamante: number; faltaDiamante: number } {
  const c: Criterio[] = [];
  const meta = pct(v.meta1Julgados, v.meta1Novos);
  c.push({ id: "meta1", item: "2.2", titulo: "Meta Nacional 1", max: 50, medido: meta !== null, pontos: meta === null ? null : r2(pontosMetaIad(meta)), resumo: meta === null ? "Informe casos novos e processos julgados (de conhecimento)." : `${meta.toFixed(2)}% de cumprimento`,
    falta: meta !== null && meta < 100 ? `Para 100%: mais ${Math.max(0, Math.ceil(num(v.meta1Novos)! - num(v.meta1Julgados)!))} julgamento(s).` : undefined });
  const iad = pct(v.iadBaixados, v.iadNovos);
  c.push({ id: "iad", item: "2.3", titulo: "Índice de Atendimento à Demanda (IAD)", max: 50, medido: iad !== null, pontos: iad === null ? null : r2(pontosMetaIad(iad)), resumo: iad === null ? "Informe casos novos e baixados (conhecimento + execução)." : `${iad.toFixed(2)}% de atendimento`,
    falta: iad !== null && iad < 100 ? `Para 100%: mais ${Math.max(0, Math.ceil(num(v.iadNovos)! - num(v.iadBaixados)!))} baixa(s).` : undefined });
  const ant = pct(v.antigosJulgados, v.antigosPendentes);
  c.push({ id: "antigos", item: "2.4", titulo: "Julgar ou baixar processos com 5 anos ou mais", max: 50, medido: ant !== null, pontos: ant === null ? null : r2(pontosAntigos(ant)), resumo: ant === null ? "Informe os pendentes líquidos distribuídos até 31/07/2021 e quantos já foram julgados ou baixados." : `${ant.toFixed(2)}% julgados ou baixados`,
    falta: ant !== null && ant < 100 ? `Faltam ${Math.max(0, num(v.antigosPendentes)! - num(v.antigosJulgados)!)} processo(s) antigo(s) para 100%.` : undefined });
  const q = pontosQuadrante(v.quadrante);
  c.push({ id: "tempo", item: "2.6", titulo: "Tempo médio dos pendentes líquidos", max: 50, medido: q !== null, pontos: q, resumo: q === null ? "Informe o quadrante da unidade no agrupamento (painel de Desempenho)." : `${v.quadrante}º quadrante do agrupamento`,
    falta: q !== null && q < 50 ? "Para subir de quadrante: reduzir o tempo médio dos processos pendentes mais antigos." : undefined });
  const pa = num(v.poloAtivo), pp = num(v.poloPassivo), poloMedido = pa !== null || pp !== null;
  c.push({ id: "polo", item: "2.12", titulo: "Saneamento de polo", max: 50, medido: poloMedido, pontos: poloMedido ? (pa !== null && pa >= 98 ? 10 : 0) + (pp !== null && pp >= 98 ? 40 : 0) : null,
    resumo: poloMedido ? `Ativo ${pa === null ? "—" : pa.toFixed(2) + "%"} · Passivo ${pp === null ? "—" : pp.toFixed(2) + "%"} com CPF/CNPJ válido` : "Informe os percentuais de CPF/CNPJ válido (meta: 98% em cada polo).",
    falta: poloMedido && ((pa ?? 0) < 98 || (pp ?? 0) < 98) ? "Meta: 98% ou mais em cada polo (ativo vale 10; passivo, 40)." : undefined });
  const hn = num(v.homNum), hd = num(v.homDen), usaStudio = hn === null || hd === null;
  const hom = usaStudio ? (studio.julgamentos > 0 ? (studio.homologatorias / studio.julgamentos) * 100 : null) : pct(v.homNum, v.homDen);
  const nH = usaStudio ? studio.homologatorias : hn!, nD = usaStudio ? studio.julgamentos : hd!;
  c.push({ id: "hom", item: "2.13", titulo: "Sentenças homologatórias de acordo", max: 20, medido: hom !== null, pontos: hom === null ? null : pontosHomologatorias(hom),
    resumo: hom === null ? "Ainda não há sentenças no período (o Studio conta as que passam por ele)." : `${hom.toFixed(2)}% (${nH} homologatória(s) de ${nD} sentença(s) terminativa(s))${usaStudio ? " · números do Studio" : " · números informados"}`,
    falta: hom !== null && hom < 25 ? `Mínimo de 25% para pontuar: faltam ${Math.max(0, Math.ceil(0.25 * nD - nH + 1e-9))} homologação(ões) neste total.` : undefined });
  const dias = num(v.peticaoDias);
  c.push({ id: "peticao", item: "2.20", titulo: "Análise das petições iniciais", max: 20, medido: dias !== null, pontos: dias === null ? null : pontosPeticao(dias), resumo: dias === null ? "Informe a média de dias (conclusão até o 1º movimento do magistrado)." : `Média de ${dias} dia(s)`,
    falta: dias !== null && dias > 10 ? "Para 20 pontos: média de até 10 dias." : undefined });
  const reun = (v.reuniao1 ? 10 : 0) + (v.reuniao2 ? 10 : 0);
  c.push({ id: "reuniao", item: "2.18", titulo: "Alinhamento entre Gabinete e Escrivania", max: 20, medido: true, pontos: reun, resumo: `${(v.reuniao1 ? 1 : 0) + (v.reuniao2 ? 1 : 0)} de 2 reuniões com ata`, falta: reun < 20 ? "Atas no PROAD até o dia 7 do mês seguinte a cada período." : undefined });
  const red = num(v.reducaoImpressoras);
  const bonus: Criterio = { id: "verde", item: "2.19", titulo: "Bônus Verde (extra)", max: 20, medido: red !== null, pontos: red === null ? null : pontosBonusVerde(red), resumo: red === null ? "Habilitação por PROAD até 30/11/2026." : `${red}% de redução de impressoras` };
  const total = r2(c.reduce((n, x) => n + (x.pontos || 0), 0) + (bonus.pontos || 0));
  const maximoAvaliado = c.filter((x) => x.medido).reduce((n, x) => n + x.max, 0);
  const diamante = MAXIMO_21 * LIMITE_DIAMANTE;
  return { criterios: c, total, maximoAvaliado, bonus, percentual: r2((total / MAXIMO_21) * 100), diamante, faltaDiamante: r2(Math.max(0, diamante - total)) };
}
