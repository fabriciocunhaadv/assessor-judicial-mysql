// FONTES PENDENTES: o que os autos (e as minutas) citam e o Studio ainda NÃO tem na base: leis federais/estaduais/municipais, Constituições, tratados, súmulas e temas.
// Todo motor (análise normal, Turbo, Lupa, Gigantes, Mesa) alimenta a mesma lista por um único middleware; o Super Admin vê, edita (CRUD), manda a extensão buscar ou envia o arquivo.
// Só guarda IDENTIFICADORES (tipo, número, ano, ente) e contagens: nenhum trecho do processo, nome de parte ou CPF.
import express from "express";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";
import { LEIS } from "./fontesOficiais";
import { listarOutrasLeis, leiDoCatalogo, salvarArquivoComoLei } from "./outrasLeis";
import { listarPrecedentes } from "./precedentesDb";
import { CORE_BINDING_PRECEDENTS } from "../src/utils/bindingPrecedents";
import { extrairCitacoes, type CitacaoFonte } from "../src/utils/citacoesFontes";

const COL = "fontes_pendentes", COL_CFG = "settings", ID_CFG = "fontes_busca";
export type StatusFonte = "pendente" | "ignorada" | "incluida";
export interface FontePendente { id: string; chave: string; tipo: string; esfera: string; ente: string; numero: string; ano: number; orgao: string; rotulo: string; status: StatusFonte; ocorrencias: number; motores: Record<string, number>; primeira: number; ultima: number; tentativas: { em: number; via: string; resultado: string }[]; link?: string; nota?: string }
/** Sites onde a extensão procura leis estaduais e municipais (o Super Admin edita a lista). Só endereços https de sites que a extensão pode abrir (veja `HOSTS_BUSCA`). */
export interface FonteDeBusca { id: string; nome: string; esfera: "estadual" | "municipal"; ente: string; url: string; ativa: boolean }
/** Os mesmos sites que o manifest da extensão declara como acesso opcional: a extensão não consegue abrir outros, então a lista não aceita outros. */
export const HOSTS_BUSCA = ["acessoainformacao.montesclarosdegoias.go.leg.br", "leisestaduais.com.br", "leis.org", "www.lexml.gov.br", "normas.leg.br", "goias.gov.br", "www.planalto.gov.br", "legis.senado.leg.br", "www2.camara.leg.br"];
const FONTES_PADRAO: FonteDeBusca[] = [
  { id: "mcgo-camara", nome: "Câmara de Montes Claros de Goiás (leis municipais)", esfera: "municipal", ente: "Montes Claros de Goiás", url: "https://acessoainformacao.montesclarosdegoias.go.leg.br/cidadao/legislacao/leis", ativa: true },
  { id: "leisestaduais-go", nome: "Leis Estaduais · Goiás", esfera: "estadual", ente: "Goiás", url: "https://leisestaduais.com.br/go", ativa: true },
];

const slug = (s: string) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const idDaChave = (chave: string) => slug(chave).slice(0, 180) || "fonte";
const lerTodos = async (): Promise<FontePendente[]> => { await garantirDocs(); const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col=? LIMIT 5000", [COL]); return rows.map((r) => { try { return JSON.parse(r.data) as FontePendente; } catch { return null; } }).filter(Boolean) as FontePendente[]; };
const lerUm = async (id: string): Promise<FontePendente | null> => { await garantirDocs(); const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col=? AND id=?", [COL, id]); try { return rows[0] ? JSON.parse(rows[0].data) : null; } catch { return null; } };
const gravar = async (f: FontePendente) => { await garantirDocs(); await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [COL, f.id, JSON.stringify(f), Date.now()]); };

// ---------- "já tem na base?" ----------
export interface ContextoBase { outras: { esfera: string; ente: string; tipo: string; numero: string; ano: number }[]; precedentes: { tribunal: string; type: string; number: string }[] }
const num = (s: string) => String(s || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
const mesmoEnte = (a: string, b: string) => !a || !b || slug(a) === slug(b);
/** Pura (testável): a fonte citada já existe nas leis do Planalto, em "Outras leis" ou na base de súmulas/teses? */
export function jaTemNaBase(c: Pick<CitacaoFonte, "tipo" | "esfera" | "ente" | "numero" | "ano" | "orgao" | "rotulo">, base: ContextoBase): boolean {
  if (c.tipo === "constituição") return c.esfera === "federal" || base.outras.some((o) => /constitui/i.test(o.tipo) && mesmoEnte(o.ente, c.ente));
  if (c.tipo === "tratado") return false;
  if (c.tipo === "súmula" || c.tipo === "súmula vinculante" || c.tipo === "tema") {
    const tipos = c.tipo === "tema" ? ["tese_repetitivo", "tese_repercussao_geral", "tese_tnu"] : c.tipo === "súmula vinculante" ? ["sumula_vinculante"] : ["sumula", "sumula_tjgo", "enunciado_turma_recursal_go", "enunciado_fonaje"];
    return base.precedentes.some((p) => num(p.number) === num(c.numero) && tipos.includes(p.type) && (!c.orgao || p.tribunal === c.orgao || (c.orgao === "TJGO" && p.tribunal === "TJGO")));
  }
  const tipoNorma = c.tipo === "lei" ? "lei" : c.tipo;
  if (c.esfera === "federal" || c.esfera === "indefinida") if (leiDoCatalogo({ esfera: "federal", tipo: tipoNorma, numero: c.numero, ano: c.ano })) return true;
  return base.outras.some((o) => num(o.numero) === num(c.numero) && o.ano === c.ano && (c.esfera === "indefinida" || o.esfera === c.esfera || (c.esfera === "federal" && o.esfera === "outra")) && (c.esfera !== "municipal" && c.esfera !== "estadual" || mesmoEnte(o.ente, c.ente)) && (!o.tipo || o.tipo === tipoNorma || tipoNorma === "lei" || o.tipo === "lei"));
}
let cacheBase: { ate: number; base: ContextoBase } | null = null;
async function carregarBase(): Promise<ContextoBase> {
  if (cacheBase && cacheBase.ate > Date.now()) return cacheBase.base;
  const [outras, anex] = await Promise.all([listarOutrasLeis().catch(() => [] as any[]), listarPrecedentes().catch(() => [] as any[])]);
  const base: ContextoBase = { outras: outras.map((o: any) => ({ esfera: o.esfera, ente: o.ente, tipo: o.tipo, numero: o.numero, ano: o.ano })), precedentes: [...CORE_BINDING_PRECEDENTS, ...anex].map((p: any) => ({ tribunal: p.tribunal, type: p.type, number: String(p.number || "") })) };
  cacheBase = { ate: Date.now() + 60_000, base }; return base;
}
export const esquecerBase = () => { cacheBase = null; };

// ---------- registro (chamado por todos os motores) ----------
const vistoRecentemente = new Map<string, number>();
/** Junta uma ocorrência à lista (pura: devolve o novo registro). */
export function fundirOcorrencia(atual: FontePendente | null, c: CitacaoFonte, origem: string, agora: number): FontePendente {
  const base: FontePendente = atual || { id: idDaChave(c.chave), chave: c.chave, tipo: c.tipo, esfera: c.esfera, ente: c.ente, numero: c.numero, ano: c.ano, orgao: c.orgao, rotulo: c.rotulo, status: "pendente", ocorrencias: 0, motores: {}, primeira: agora, ultima: agora, tentativas: [] };
  return { ...base, ocorrencias: base.ocorrencias + 1, motores: { ...base.motores, [origem]: (base.motores[origem] || 0) + 1 }, ultima: agora };
}
/** Lê os textos, acha as citações que a base não tem e as soma à lista. Nunca lança erro e nunca atrasa o motor (roda depois da resposta começar). */
export function registrarCitacoes(textos: (string | undefined | null)[], origem: string): void {
  setImmediate(async () => {
    try {
      const juntos = textos.map((t) => String(t || "").slice(0, 1_500_000)).join("\n");
      if (juntos.trim().length < 30) return;
      const citacoes = extrairCitacoes(juntos, 80); if (!citacoes.length) return;
      const base = await carregarBase(), agora = Date.now();
      for (const c of citacoes) {
        if (jaTemNaBase(c, base)) continue;
        const k = `${c.chave}|${origem}`; if (agora - (vistoRecentemente.get(k) || 0) < 10 * 60_000) continue;      // a mesma fonte, no mesmo motor, só conta de novo depois de 10 min
        vistoRecentemente.set(k, agora); if (vistoRecentemente.size > 5000) vistoRecentemente.clear();
        const id = idDaChave(c.chave), atual = await lerUm(id);
        await gravar(fundirOcorrencia(atual, c, origem, agora));
      }
    } catch { /* o monitor de fontes nunca derruba o motor */ }
  });
}
/** Middleware: alimenta a lista a cada pedido de um motor, lendo os campos de texto do corpo. Não altera nada no pedido. */
export const detectarFontes = (origem: string, campos: (b: any) => (string | undefined | null)[], pular?: (b: any) => boolean): express.RequestHandler => (req, _res, next) => {
  try { if (req.method === "POST" && req.body && !(pular && pular(req.body))) registrarCitacoes(campos(req.body), origem); } catch { /* ignora */ }
  next();
};
const textosPdf = (b: any) => (Array.isArray(b?.pdfFiles) ? b.pdfFiles.map((p: any) => p?.extractedText) : []);
export const detectoresDosMotores: [string, string, express.RequestHandler][] = [
  ["/api/generate-minute", "normal", detectarFontes("normal", (b) => [b.processText, ...textosPdf(b)], (b) => b.executionStage === 2)],      // a 2ª etapa repete os mesmos autos: conta só uma vez por análise
  ["/api/generate-minute-turbo", "turbo", detectarFontes("turbo", (b) => [b.processText, ...textosPdf(b)])],
  ["/api/audit-assessor-draft", "lupa", detectarFontes("lupa", (b) => [b.processText, b.draftText, ...textosPdf(b)])],
  ["/api/gigante-lote", "gigante", detectarFontes("gigante", (b) => [b.texto])],
  ["/api/hearing-copilot", "mesa", detectarFontes("mesa", (b) => [b.caseText, b.notes])],
];

// ---------- rotas (Super Admin) ----------
export const fontesPendentesRouter = express.Router();
const soSuper = (req: any, res: express.Response): boolean => { if (!req.usuarioSessao?.superAdmin) { res.status(403).json({ erro: "somente o super administrador" }); return false; } return true; };
const corpoBruto = express.raw({ type: () => true, limit: "30mb" });
const txt = (v: any, max: number) => String(v ?? "").trim().slice(0, max);
const ORDEM: Record<StatusFonte, number> = { pendente: 0, incluida: 1, ignorada: 2 };
const TIPOS_OK = ["lei", "lei complementar", "decreto", "decreto-lei", "medida provisória", "emenda constitucional", "resolução", "portaria", "provimento", "instrução normativa", "constituição", "tratado", "súmula", "súmula vinculante", "tema"];

async function lerConfigBusca(): Promise<FonteDeBusca[]> {
  await garantirDocs(); const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col=? AND id=?", [COL_CFG, ID_CFG]);
  try { const l = rows[0] ? JSON.parse(rows[0].data) : null; if (Array.isArray(l?.fontes)) return l.fontes; } catch { /* usa o padrão */ }
  return FONTES_PADRAO;
}
export const hostPermitido = (url: string) => { try { const u = new URL(url); return u.protocol === "https:" && HOSTS_BUSCA.includes(u.hostname) && !u.username && !u.password; } catch { return false; } };

fontesPendentesRouter.get("/", async (req, res) => { if (!soSuper(req, res)) return; try { const itens = (await lerTodos()).sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || b.ocorrencias - a.ocorrencias || b.ultima - a.ultima); res.json({ itens, fontesBusca: await lerConfigBusca(), hostsPermitidos: HOSTS_BUSCA }); } catch { res.status(500).json({ erro: "não consegui ler a lista" }); } });
/** Cadastro manual (o Super Admin informa uma fonte que quer ter na base). */
fontesPendentesRouter.post("/", async (req, res) => {
  if (!soSuper(req, res)) return;
  try {
    const b = req.body || {}, tipo = txt(b.tipo, 40).toLowerCase(), esfera = ["federal", "estadual", "municipal", "indefinida"].includes(b.esfera) ? b.esfera : "indefinida", ano = Number(b.ano) || 0, numero = txt(b.numero, 20).replace(/[^\d.]/g, "").replace(/\./g, "");
    if (!TIPOS_OK.includes(tipo)) return void res.status(400).json({ erro: "tipo inválido" });
    if (!["constituição", "tratado"].includes(tipo) && !numero) return void res.status(400).json({ erro: "informe o número" });
    const ente = txt(b.ente, 80), orgao = txt(b.orgao, 12).toUpperCase(), rotulo = txt(b.rotulo, 160) || `${tipo.charAt(0).toUpperCase() + tipo.slice(1)}${esfera === "estadual" ? " Estadual" : esfera === "municipal" ? " Municipal" : ""} ${numero}${ano ? "/" + ano : ""}${ente ? ` (${ente})` : ""}`;
    const chave = [tipo, esfera, slug(ente), numero, ano || "", orgao, tipo === "tratado" ? slug(rotulo) : ""].join("|"), agora = Date.now();
    const atual = await lerUm(idDaChave(chave));
    const f: FontePendente = atual ? { ...atual, status: "pendente" } : { id: idDaChave(chave), chave, tipo, esfera, ente, numero, ano, orgao, rotulo, status: "pendente", ocorrencias: 0, motores: {}, primeira: agora, ultima: agora, tentativas: [] };
    if (b.nota) f.nota = txt(b.nota, 300); if (b.link) f.link = txt(b.link, 500);
    await gravar(f); res.json({ item: f });
  } catch { res.status(500).json({ erro: "não consegui gravar" }); }
});
fontesPendentesRouter.put("/config-busca", async (req, res) => {
  if (!soSuper(req, res)) return;
  try {
    const lista = (Array.isArray(req.body?.fontes) ? req.body.fontes : []).slice(0, 20).map((f: any, i: number) => ({ id: txt(f.id, 40) || `fonte${i + 1}`, nome: txt(f.nome, 120) || txt(f.url, 60), esfera: f.esfera === "estadual" ? "estadual" : "municipal", ente: txt(f.ente, 80), url: txt(f.url, 400), ativa: f.ativa !== false }));
    const ruim = lista.find((f: FonteDeBusca) => !hostPermitido(f.url)); if (ruim) return void res.status(400).json({ erro: `endereço não permitido (${ruim.url}). A extensão só abre estes sites: ${HOSTS_BUSCA.join(", ")}.` });
    await garantirDocs(); await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [COL_CFG, ID_CFG, JSON.stringify({ fontes: lista }), Date.now()]);
    res.json({ fontesBusca: lista });
  } catch { res.status(500).json({ erro: "não consegui gravar" }); }
});
fontesPendentesRouter.put("/:id", async (req, res) => {
  if (!soSuper(req, res)) return;
  try {
    const f = await lerUm(String(req.params.id)); if (!f) return void res.status(404).json({ erro: "fonte não encontrada" });
    const b = req.body || {};
    if (["pendente", "ignorada", "incluida"].includes(b.status)) f.status = b.status;
    if (typeof b.link === "string") f.link = txt(b.link, 500); if (typeof b.nota === "string") f.nota = txt(b.nota, 300);
    if (["federal", "estadual", "municipal", "indefinida"].includes(b.esfera)) f.esfera = b.esfera;
    if (typeof b.ente === "string") f.ente = txt(b.ente, 80); if (typeof b.rotulo === "string" && b.rotulo.trim()) f.rotulo = txt(b.rotulo, 160);
    if (typeof b.tentativa === "object" && b.tentativa) f.tentativas = [...f.tentativas, { em: Date.now(), via: txt(b.tentativa.via, 30), resultado: txt(b.tentativa.resultado, 200) }].slice(-10);
    await gravar(f); res.json({ item: f });
  } catch { res.status(500).json({ erro: "não consegui gravar" }); }
});
fontesPendentesRouter.delete("/:id", async (req, res) => { if (!soSuper(req, res)) return; try { await garantirDocs(); await banco().query("DELETE FROM docs WHERE col=? AND id=?", [COL, String(req.params.id)]); res.json({ ok: true }); } catch { res.status(500).json({ erro: "não consegui excluir" }); } });
/** Inclui na base o arquivo desta fonte (enviado à mão ou buscado pela extensão). Leis e demais atos vão para "Outras leis" (ou para a lista do Planalto, se for uma das 29). */
fontesPendentesRouter.post("/:id/incluir", corpoBruto, async (req: any, res) => {
  if (!soSuper(req, res)) return;
  const f = await lerUm(String(req.params.id)).catch(() => null); if (!f) return void res.status(404).json({ erro: "fonte não encontrada" });
  const via = txt(req.headers["x-via"], 30) || "manual", registrar = async (resultado: string, status?: StatusFonte) => { f.tentativas = [...f.tentativas, { em: Date.now(), via, resultado: resultado.slice(0, 200) }].slice(-10); if (status) f.status = status; await gravar(f); };
  try {
    if (["súmula", "súmula vinculante", "tema", "tratado"].includes(f.tipo)) { await registrar("tipo sem inclusão automática"); return void res.status(400).json({ erro: "súmulas, temas e tratados não entram por este caminho: use “Anexar PDF de Informativo / Súmula” (súmulas e temas) ou marque como conferida.", item: f }); }
    const esfera = f.esfera === "indefinida" ? "federal" : f.esfera;
    const r = await salvarArquivoComoLei({ esfera, ente: f.ente, tipo: f.tipo === "lei complementar" ? "lei complementar" : f.tipo, numero: f.numero, ano: f.ano, titulo: f.rotulo }, req.body, String(req.headers["x-formato"] || ""));
    esquecerBase();
    await registrar(r.redirecionada ? `incluída na lista do Planalto (${r.redirecionada.nome})` : `incluída em Outras leis (${r.lei?.artigos} artigos)`, "incluida");
    res.json({ item: f, ...r });
  } catch (e: any) { await registrar(String(e?.message || "falha").slice(0, 180)).catch(() => {}); res.status(e?.status || 500).json({ erro: e?.message || "falha ao incluir", item: f }); }
});
