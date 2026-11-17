// Guarda o resultado de “Buscar minuta lançada” (comparação entre a minuta gerada e a lançada no Projudi) para a calibragem. SÓ Super Admin, por gabinete.
// Guarda números e trechos curtos do que mudou + o texto lançado; nada vai para fora do banco do Studio.
import express from "express";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";
import { agregarPadroes, montarPromptResumo, lerRespostaResumo, type DocComparacao } from "./calibragemMinutas";

export const comparacoesRouter = express.Router();
const so = (req: any) => { if (!req.usuarioSessao?.superAdmin) throw Object.assign(new Error("somente o super administrador"), { status: 403 }); return req.usuarioSessao; };
const col = (tenant: string) => `gabinetes/${tenant || "unassigned"}/comparacoes`;
/** O Super Admin vê as comparações de TODOS os gabinetes, não só do que está escolhido no seletor do alto da tela (o seletor muda o gabinete da requisição e a lista “sumia”). */
const TODAS = "^gabinetes/[^/]+/comparacoes$";
export const DIAS_GUARDA_COMPARACOES = 30;
const num = (v: any) => Math.max(0, Math.min(1e9, Number(v) || 0));
const curto = (v: any, n: number) => String(v || "").slice(0, n);

/** Monta o documento da comparação a partir do corpo recebido (números e trechos curtos; os textos têm teto). */
function montarDoc(b: any, u: any, extra: Record<string, any> = {}) {
  const processo = curto(b.processo, 40);
  return {
      processo, ato: curto(b.ato, 30), geradoEm: Date.now(), por: curto(u.email, 190), promptTitulo: curto(b.promptTitulo, 120), motor: curto(b.motor, 30),
      aproveitamentoPct: num(b.aproveitamentoPct), coberturaPct: num(b.coberturaPct), palavrasOriginal: num(b.palavrasOriginal), palavrasLancado: num(b.palavrasLancado), mantidas: num(b.mantidas), removidas: num(b.removidas), acrescentadas: num(b.acrescentadas),
      dispositivoMudou: !!b.dispositivoMudou, dispositivoAproveitamentoPct: b.dispositivoAproveitamentoPct == null ? null : num(b.dispositivoAproveitamentoPct),
      porSecao: (Array.isArray(b.porSecao) ? b.porSecao : []).slice(0, 8).map((s: any) => ({ secao: curto(s?.secao, 30), palavrasOriginais: num(s?.palavrasOriginais), mantidas: num(s?.mantidas), aproveitamentoPct: num(s?.aproveitamentoPct) })),
      mudancas: (Array.isArray(b.mudancas) ? b.mudancas : []).slice(0, 80).map((m: any) => ({ tipo: curto(m?.tipo, 12), secao: curto(m?.secao, 30), original: curto(m?.original, 400), lancado: curto(m?.lancado, 400) })),
      textoLancado: curto(b.textoLancado, 200_000), textoGerado: curto(b.textoGerado, 200_000), ...extra,
  };
}

comparacoesRouter.post("/", async (req: any, res) => {
  try {
    const u = so(req), b = req.body || {};
    if (!curto(b.processo, 40)) return void res.status(400).json({ erro: "processo ausente" });
    const doc = montarDoc(b, u);
    const processo = doc.processo;
    await garantirDocs();
    const id = `${processo.replace(/[^0-9a-zA-Z.\-]/g, "")}-${doc.geradoEm}`.slice(0, 190);
    await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [col(u.tenant), id, JSON.stringify(doc), doc.geradoEm]);
    res.json({ ok: true, id });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui guardar a comparação" }); }
});

// ---- Chave geral: o Super Admin liga/desliga o pedido de envio aos usuários. Começa DESLIGADA (sem registro = desligada). ----
const COL_CFG = "settings", ID_CFG = "calibragem_envio";
let cfgCache: { ativo: boolean; t: number } | null = null;
export async function envioDosUsuariosAtivo(): Promise<boolean> {
  if (cfgCache && Date.now() - cfgCache.t < 10_000) return cfgCache.ativo;
  let ativo = false;
  try { await garantirDocs(); const [rows]: any = await banco().query("SELECT data FROM docs WHERE col=? AND id=?", [COL_CFG, ID_CFG]); ativo = rows.length ? !!JSON.parse(rows[0].data).ativo : false; } catch { ativo = false; }      // na dúvida, desligada
  cfgCache = { ativo, t: Date.now() }; return ativo;
}
/** Qualquer usuário logado pode LER se o pedido está ligado (o app só mostra a janela se estiver). */
comparacoesRouter.get("/config", async (req: any, res) => {
  try { if (!req.usuarioSessao) return void res.status(401).json({ erro: "login necessário" }); res.json({ ativo: await envioDosUsuariosAtivo() }); }
  catch { res.json({ ativo: false }); }
});
/** Só o Super Admin liga/desliga. */
comparacoesRouter.post("/config", async (req: any, res) => {
  try {
    const u = so(req); await garantirDocs();
    const ativo = req.body?.ativo === true;
    await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [COL_CFG, ID_CFG, JSON.stringify({ ativo, por: u.email, quando: Date.now() }), Date.now()]);
    cfgCache = { ativo, t: Date.now() };
    res.json({ ok: true, ativo });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui gravar a chave" }); }
});

// ---- Envio pelo próprio usuário (assessor/juiz) ao marcar como lançado ou ao excluir a minuta: a minuta LANÇADA no Projudi (lida pela extensão) + a GERADA pelo sistema, para a calibragem do administrador ----
const envios = new Map<string, { janela: number; n: number }>();
const podeEnviar = (chave: string) => { const t = Date.now(), e = envios.get(chave); if (envios.size > 500) envios.clear(); if (!e || t - e.janela > 60_000) { envios.set(chave, { janela: t, n: 1 }); return true; } return ++e.n <= 20; };
comparacoesRouter.post("/enviar", async (req: any, res) => {
  try {
    const u = req.usuarioSessao; if (!u) return void res.status(401).json({ erro: "login necessário" });
    if (!(await envioDosUsuariosAtivo())) return void res.status(403).json({ erro: "o envio para a calibragem está desativado" });
    if (!podeEnviar(u.uid || u.email)) return void res.status(429).json({ erro: "muitos envios seguidos; espere um minuto" });
    const b = req.body || {};
    if (!curto(b.processo, 40)) return void res.status(400).json({ erro: "processo ausente" });
    if (curto(b.textoLancado, 200_000).replace(/\s+/g, " ").length < 120) return void res.status(400).json({ erro: "a minuta lançada no Projudi não veio (nada a comparar)" });
    if (curto(b.textoGerado, 200_000).replace(/\s+/g, " ").length < 50) return void res.status(400).json({ erro: "a minuta gerada pelo sistema não veio" });
    const doc = montarDoc(b, u, { origem: "usuario", nomeUsuario: curto(u.name, 120), motivo: b.motivo === "excluir" ? "excluir" : "lancado" });
    await garantirDocs();
    const base = curto(b.analysisId, 60).replace(/[^0-9a-zA-Z._\-]/g, "") || `${doc.processo.replace(/[^0-9a-zA-Z.\-]/g, "")}-${doc.geradoEm}`;
    const id = `u-${base}`.slice(0, 190);      // o mesmo ato reenviado substitui o anterior (sem duplicar)
    await banco().query("DELETE FROM docs WHERE col REGEXP ? AND id=? AND col<>?", [TODAS, id, col(u.tenant)]);      // o mesmo ato enviado de outro gabinete (seletor do Super Admin) não duplica
    await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [col(u.tenant), id, JSON.stringify(doc), doc.geradoEm]);
    res.json({ ok: true, id });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui guardar o envio" }); }
});

/** Últimas comparações (sem o texto lançado), opcionalmente de um processo. */
comparacoesRouter.get("/", async (req: any, res) => {
  try {
    const u = so(req); await garantirDocs();
    const [rows]: any = await banco().query("SELECT id, data FROM docs WHERE col REGEXP ? ORDER BY updated_at DESC LIMIT 200", [TODAS]);
    const proc = String(req.query.processo || "");
    const lista = rows.map((r: any) => { try { const d = JSON.parse(r.data); delete d.textoLancado; delete d.textoGerado; d.id = r.id; return d; } catch { return null; } }).filter((d: any) => d && (!proc || d.processo === proc)).slice(0, 50);
    res.json({ comparacoes: lista });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui ler as comparações" }); }
});

// ---- Etapas 2 e 3: padrões, documento assinado e resumo por IA (tudo só Super Admin) ----
let gerarIA: ((req: any, prompt: string) => Promise<string>) | null = null;
/** O server.ts entrega aqui a função que chama a IA (com as chaves e o motor do próprio app). */
export const definirIA = (f: (req: any, prompt: string) => Promise<string>) => { gerarIA = f; };

async function lerDocs(_tenant: string, limite = 200): Promise<(DocComparacao & { id: string })[]> {
  await garantirDocs();
  const [rows]: any = await banco().query("SELECT id, data FROM docs WHERE col REGEXP ? ORDER BY updated_at DESC LIMIT ?", [TODAS, limite]);
  return rows.map((r: any) => { try { const d = JSON.parse(r.data); delete d.textoLancado; delete d.textoGerado; d.id = r.id; return d; } catch { return null; } }).filter(Boolean);
}
const idOk = (v: any) => { const id = String(v || ""); return /^[0-9a-zA-Z.\-]{1,190}$/.test(id) ? id : ""; };

comparacoesRouter.get("/padroes", async (req: any, res) => {
  try { const u = so(req); const docs = await lerDocs(u.tenant); res.json({ padroes: agregarPadroes(docs) }); }
  catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui calcular os padrões" }); }
});

/** Textos guardados (gerado e lançado) de uma comparação: o navegador usa para comparar com o documento assinado. */
comparacoesRouter.get("/:id/textos", async (req: any, res) => {
  try {
    const u = so(req), id = idOk(req.params.id); if (!id) return void res.status(400).json({ erro: "identificação inválida" });
    await garantirDocs();
    const [rows]: any = await banco().query("SELECT data FROM docs WHERE col REGEXP ? AND id=?", [TODAS, id]);
    if (!rows.length) return void res.status(404).json({ erro: "comparação não encontrada" });
    const d = JSON.parse(rows[0].data); res.json({ processo: d.processo, textoGerado: d.textoGerado || "", textoLancado: d.textoLancado || "" });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui ler os textos" }); }
});

/** Guarda a comparação com o documento ASSINADO (PDF lido no navegador): só números, trechos curtos e o nome do arquivo. */
comparacoesRouter.post("/:id/assinado", async (req: any, res) => {
  try {
    const u = so(req), id = idOk(req.params.id), b = req.body || {}; if (!id) return void res.status(400).json({ erro: "identificação inválida" });
    await garantirDocs();
    const [rows]: any = await banco().query("SELECT col, data FROM docs WHERE col REGEXP ? AND id=?", [TODAS, id]);
    if (!rows.length) return void res.status(404).json({ erro: "comparação não encontrada" });
    const d = JSON.parse(rows[0].data);
    d.assinado = {
      aproveitamentoLancadaPct: num(b.aproveitamentoLancadaPct), aproveitamentoGeradaPct: b.aproveitamentoGeradaPct == null ? null : num(b.aproveitamentoGeradaPct),
      dispositivoMudouDaLancada: !!b.dispositivoMudouDaLancada, arquivo: curto(b.arquivo, 160), em: Date.now(),
      mudancas: (Array.isArray(b.mudancas) ? b.mudancas : []).slice(0, 60).map((m: any) => ({ tipo: curto(m?.tipo, 12), secao: curto(m?.secao, 30), original: curto(m?.original, 400), lancado: curto(m?.lancado, 400) })),
    };
    await banco().query("UPDATE docs SET data=? WHERE col=? AND id=?", [JSON.stringify(d), rows[0].col, id]);      // updated_at fica: a guarda de 30 dias conta da comparação
    res.json({ ok: true });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui guardar o documento assinado" }); }
});

let resumindo = false;
/** Resumo por IA dos padrões + sugestões de ajuste de prompt (nunca altera prompt nenhum: só sugere). */
comparacoesRouter.post("/resumo", async (req: any, res) => {
  try {
    const u = so(req); if (!gerarIA) return void res.status(503).json({ erro: "a IA não está disponível neste servidor" });
    if (resumindo) return void res.status(429).json({ erro: "já estou gerando um resumo; espere terminar" });
    const docs = await lerDocs(u.tenant, 60); if (!docs.length) return void res.status(400).json({ erro: "ainda não há comparações guardadas" });
    resumindo = true;
    try {
      const p = agregarPadroes(await lerDocs(u.tenant, 200));
      const [rows]: any = await banco().query("SELECT data FROM docs WHERE col REGEXP ? ORDER BY updated_at DESC LIMIT 60", [TODAS]);
      const brutos = rows.map((r: any) => { try { return JSON.parse(r.data); } catch { return null; } }).filter((d: any) => d && d.textoLancado);
      const referencias = brutos.sort((a: any, b: any) => (a.coberturaPct ?? a.aproveitamentoPct) - (b.coberturaPct ?? b.aproveitamentoPct)).slice(0, 5)
        .map((d: any) => ({ processo: d.processo, ato: d.ato || "", cobertura: d.coberturaPct ?? null, gerada: String(d.textoGerado || "").slice(0, 500), lancada: String(d.textoLancado || "").slice(0, 900) }));
      const txt = await gerarIA(req, montarPromptResumo(docs, p, referencias));
      res.json({ ok: true, base: docs.length, ...lerRespostaResumo(txt) });
    } finally { resumindo = false; }
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : `não consegui gerar o resumo: ${String(e?.message || e).slice(0, 200)}` }); }
});

// ---- Guarda de 30 dias: apaga as comparações (com as minutas lançada/gerada e os trechos guardados) que passaram do prazo, em todos os gabinetes ----
export async function limparComparacoesVencidas(agora = Date.now(), simular = false): Promise<number> {
  await garantirDocs();
  const limite = agora - DIAS_GUARDA_COMPARACOES * 86_400_000;
  if (simular) { const [r]: any = await banco().query("SELECT COUNT(*) AS n FROM docs WHERE col REGEXP ? AND updated_at < ?", [TODAS, limite]); return Number(r[0]?.n) || 0; }
  const [r]: any = await banco().query("DELETE FROM docs WHERE col REGEXP ? AND updated_at < ?", [TODAS, limite]);
  return Number(r?.affectedRows) || 0;
}
/** Super Admin: pacote COMPLETO (com o texto gerado e o lançado) das comparações escolhidas ({ ids }) ou de todas, para levar ao laboratório de calibragem. */
comparacoesRouter.post("/exportar", async (req: any, res) => {
  try {
    so(req); await garantirDocs();
    const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(idOk).filter(Boolean).slice(0, 500);
    const [rows]: any = ids.length
      ? await banco().query(`SELECT id, data FROM docs WHERE col REGEXP ? AND id IN (${ids.map(() => "?").join(",")}) ORDER BY updated_at DESC LIMIT 500`, [TODAS, ...ids])
      : await banco().query("SELECT id, data FROM docs WHERE col REGEXP ? ORDER BY updated_at DESC LIMIT 500", [TODAS]);
    const comparacoes = rows.map((r: any) => { try { const d = JSON.parse(r.data); d.id = r.id; return d; } catch { return null; } }).filter(Boolean);
    res.json({ comparacoes, geradoEm: Date.now() });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui montar o pacote" }); }
});

/** Super Admin: apaga comparações escolhidas ({ ids: [...] }) ou todas ({ todas: true }), de qualquer gabinete. */
comparacoesRouter.post("/apagar", async (req: any, res) => {
  try {
    so(req); await garantirDocs();
    if (req.body?.todas === true) { const [r]: any = await banco().query("DELETE FROM docs WHERE col REGEXP ?", [TODAS]); return void res.json({ ok: true, apagadas: Number(r?.affectedRows) || 0 }); }
    const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(idOk).filter(Boolean).slice(0, 500);
    if (!ids.length) return void res.status(400).json({ erro: "nenhuma comparação escolhida" });
    const [r]: any = await banco().query(`DELETE FROM docs WHERE col REGEXP ? AND id IN (${ids.map(() => "?").join(",")})`, [TODAS, ...ids]);
    res.json({ ok: true, apagadas: Number(r?.affectedRows) || 0 });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui apagar" }); }
});

/** Super Admin: roda a limpeza agora (ou só conta, com `simular`). */
comparacoesRouter.post("/limpar", async (req: any, res) => {
  try { so(req); const n = await limparComparacoesVencidas(Date.now(), !!req.body?.simular); res.json({ ok: true, simulado: !!req.body?.simular, vencidas: n, dias: DIAS_GUARDA_COMPARACOES }); }
  catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui limpar" }); }
});
let limpezaLigada = false;
/** 1 minuto depois de o servidor subir e depois a cada 12 horas. Falha nunca derruba o servidor. */
export function iniciarLimpezaDasComparacoes(): void {
  if (limpezaLigada) return; limpezaLigada = true;
  const rodar = () => { limparComparacoesVencidas().then((n) => { if (n) console.log(`[comparações] ${n} comparação(ões) com mais de ${DIAS_GUARDA_COMPARACOES} dias apagada(s)`); }).catch((e) => console.warn("[comparações] limpeza falhou:", e?.message || e)); };
  setTimeout(rodar, 60_000).unref?.();
  setInterval(rodar, 12 * 3_600_000).unref?.();
}
