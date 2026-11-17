// Guarda o resultado de “Buscar minuta lançada” (comparação entre a minuta gerada e a lançada no Projudi) para a calibragem. SÓ Super Admin, por gabinete.
// Guarda números e trechos curtos do que mudou + o texto lançado; nada vai para fora do banco do Studio.
import express from "express";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";

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
      aproveitamentoPct: num(b.aproveitamentoPct), palavrasOriginal: num(b.palavrasOriginal), palavrasLancado: num(b.palavrasLancado), mantidas: num(b.mantidas), removidas: num(b.removidas), acrescentadas: num(b.acrescentadas),
      dispositivoMudou: !!b.dispositivoMudou, dispositivoAproveitamentoPct: b.dispositivoAproveitamentoPct == null ? null : num(b.dispositivoAproveitamentoPct),
      porSecao: (Array.isArray(b.porSecao) ? b.porSecao : []).slice(0, 8).map((s: any) => ({ secao: curto(s?.secao, 30), palavrasOriginais: num(s?.palavrasOriginais), mantidas: num(s?.mantidas), aproveitamentoPct: num(s?.aproveitamentoPct) })),
      mudancas: (Array.isArray(b.mudancas) ? b.mudancas : []).slice(0, 80).map((m: any) => ({ tipo: curto(m?.tipo, 12), secao: curto(m?.secao, 30), original: curto(m?.original, 400), lancado: curto(m?.lancado, 400) })),
      textoLancado: curto(b.textoLancado, 200_000),
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
    const [rows]: any = await banco().query("SELECT data FROM docs WHERE col=? ORDER BY updated_at DESC LIMIT 200", [col(u.tenant)]);
    const proc = String(req.query.processo || "");
    const lista = rows.map((r: any) => { try { const d = JSON.parse(r.data); delete d.textoLancado; return d; } catch { return null; } }).filter((d: any) => d && (!proc || d.processo === proc)).slice(0, 50);
    res.json({ comparacoes: lista });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: e?.status ? e.message : "não consegui ler as comparações" }); }
});
