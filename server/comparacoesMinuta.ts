// Guarda o resultado de “Buscar minuta lançada” (comparação entre a minuta gerada e a lançada no Projudi) para a calibragem. SÓ Super Admin, por gabinete.
// Guarda números e trechos curtos do que mudou + o texto lançado; nada vai para fora do banco do Studio.
import express from "express";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";
import { agregarPadroes, montarPromptResumo, lerRespostaResumo, type DocComparacao } from "./calibragemMinutas";

export const comparacoesRouter = express.Router();
const so = (req: any) => { if (!req.usuarioSessao?.superAdmin) throw Object.assign(new Error("somente o super administrador"), { status: 403 }); return req.usuarioSessao; };
const col = (tenant: string) => `gabinetes/${tenant || "unassigned"}/comparacoes`;
const num = (v: any) => Math.max(0, Math.min(1e9, Number(v) || 0));
const curto = (v: any, n: number) => String(v || "").slice(0, n);

comparacoesRouter.post("/", async (req: any, res) => {
  try {
    const u = so(req), b = req.body || {};
    const processo = curto(b.processo, 40); if (!processo) return void res.status(400).json({ erro: "processo ausente" });
    const doc = {
      processo, ato: curto(b.ato, 30), geradoEm: Date.now(), por: curto(u.email, 190), promptTitulo: curto(b.promptTitulo, 120), motor: curto(b.motor, 30),
      aproveitamentoPct: num(b.aproveitamentoPct), coberturaPct: num(b.coberturaPct), palavrasOriginal: num(b.palavrasOriginal), palavrasLancado: num(b.palavrasLancado), mantidas: num(b.mantidas), removidas: num(b.removidas), acrescentadas: num(b.acrescentadas),
      dispositivoMudou: !!b.dispositivoMudou, dispositivoAproveitamentoPct: b.dispositivoAproveitamentoPct == null ? null : num(b.dispositivoAproveitamentoPct),
      porSecao: (Array.isArray(b.porSecao) ? b.porSecao : []).slice(0, 8).map((s: any) => ({ secao: curto(s?.secao, 30), palavrasOriginais: num(s?.palavrasOriginais), mantidas: num(s?.mantidas), aproveitamentoPct: num(s?.aproveitamentoPct) })),
      mudancas: (Array.isArray(b.mudancas) ? b.mudancas : []).slice(0, 80).map((m: any) => ({ tipo: curto(m?.tipo, 12), secao: curto(m?.secao, 30), original: curto(m?.original, 400), lancado: curto(m?.lancado, 400) })),
      textoLancado: curto(b.textoLancado, 200_000), textoGerado: curto(b.textoGerado, 200_000),
    };
    await garantirDocs();
    const id = `${processo.replace(/[^0-9a-zA-Z.\-]/g, "")}-${doc.geradoEm}`.slice(0, 190);
    await banco().query("INSERT INTO docs (col,id,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)", [col(u.tenant), id, JSON.stringify(doc), doc.geradoEm]);
    res.json({ ok: true, id });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui guardar a comparação" }); }
});

/** Últimas comparações (sem o texto lançado), opcionalmente de um processo. */
comparacoesRouter.get("/", async (req: any, res) => {
  try {
    const u = so(req); await garantirDocs();
    const [rows]: any = await banco().query("SELECT id, data FROM docs WHERE col=? ORDER BY updated_at DESC LIMIT 200", [col(u.tenant)]);
    const proc = String(req.query.processo || "");
    const lista = rows.map((r: any) => { try { const d = JSON.parse(r.data); delete d.textoLancado; delete d.textoGerado; d.id = r.id; return d; } catch { return null; } }).filter((d: any) => d && (!proc || d.processo === proc)).slice(0, 50);
    res.json({ comparacoes: lista });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui ler as comparações" }); }
});

// ---- Etapas 2 e 3: padrões, documento assinado e resumo por IA (tudo só Super Admin) ----
let gerarIA: ((req: any, prompt: string) => Promise<string>) | null = null;
/** O server.ts entrega aqui a função que chama a IA (com as chaves e o motor do próprio app). */
export const definirIA = (f: (req: any, prompt: string) => Promise<string>) => { gerarIA = f; };

async function lerDocs(tenant: string, limite = 200): Promise<(DocComparacao & { id: string })[]> {
  await garantirDocs();
  const [rows]: any = await banco().query("SELECT id, data FROM docs WHERE col=? ORDER BY updated_at DESC LIMIT ?", [col(tenant), limite]);
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
    const [rows]: any = await banco().query("SELECT data FROM docs WHERE col=? AND id=?", [col(u.tenant), id]);
    if (!rows.length) return void res.status(404).json({ erro: "comparação não encontrada" });
    const d = JSON.parse(rows[0].data); res.json({ processo: d.processo, textoGerado: d.textoGerado || "", textoLancado: d.textoLancado || "" });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui ler os textos" }); }
});

/** Guarda a comparação com o documento ASSINADO (PDF lido no navegador): só números, trechos curtos e o nome do arquivo. */
comparacoesRouter.post("/:id/assinado", async (req: any, res) => {
  try {
    const u = so(req), id = idOk(req.params.id), b = req.body || {}; if (!id) return void res.status(400).json({ erro: "identificação inválida" });
    await garantirDocs();
    const [rows]: any = await banco().query("SELECT data FROM docs WHERE col=? AND id=?", [col(u.tenant), id]);
    if (!rows.length) return void res.status(404).json({ erro: "comparação não encontrada" });
    const d = JSON.parse(rows[0].data);
    d.assinado = {
      aproveitamentoLancadaPct: num(b.aproveitamentoLancadaPct), aproveitamentoGeradaPct: b.aproveitamentoGeradaPct == null ? null : num(b.aproveitamentoGeradaPct),
      dispositivoMudouDaLancada: !!b.dispositivoMudouDaLancada, arquivo: curto(b.arquivo, 160), em: Date.now(),
      mudancas: (Array.isArray(b.mudancas) ? b.mudancas : []).slice(0, 60).map((m: any) => ({ tipo: curto(m?.tipo, 12), secao: curto(m?.secao, 30), original: curto(m?.original, 400), lancado: curto(m?.lancado, 400) })),
    };
    await banco().query("UPDATE docs SET data=?, updated_at=? WHERE col=? AND id=?", [JSON.stringify(d), Date.now(), col(u.tenant), id]);
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
      const [rows]: any = await banco().query("SELECT data FROM docs WHERE col=? ORDER BY updated_at DESC LIMIT 60", [col(u.tenant)]);
      const brutos = rows.map((r: any) => { try { return JSON.parse(r.data); } catch { return null; } }).filter((d: any) => d && d.textoLancado);
      const referencias = brutos.sort((a: any, b: any) => (a.coberturaPct ?? a.aproveitamentoPct) - (b.coberturaPct ?? b.aproveitamentoPct)).slice(0, 5)
        .map((d: any) => ({ processo: d.processo, ato: d.ato || "", cobertura: d.coberturaPct ?? null, gerada: String(d.textoGerado || "").slice(0, 500), lancada: String(d.textoLancado || "").slice(0, 900) }));
      const txt = await gerarIA(req, montarPromptResumo(docs, p, referencias));
      res.json({ ok: true, base: docs.length, ...lerRespostaResumo(txt) });
    } finally { resumindo = false; }
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : `não consegui gerar o resumo: ${String(e?.message || e).slice(0, 200)}` }); }
});
