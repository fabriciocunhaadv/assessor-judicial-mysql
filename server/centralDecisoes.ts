// CENTRAL DE DECISÕES (Super Admin): junta o que já é registrado (Saúde, erros agrupados, fontes pendentes, limpeza) numa lista do que precisa de atenção
// e guarda o STATUS de cada erro agrupado (novo, em investigação, resolvido, ignorado; "resolvido" que volta vira reincidente) com uma nota.
// Só LÊ os registros existentes: não altera nenhum motor. A tabela própria é pequena e é limpa junto com a rotina de 30 dias da Saúde.
import express from "express";
import { autenticarSessao, mensagemDeErro } from "./authRoutes";
import { consultaSaude, garantirSaude, esvaziarFilaSaude, aoLimparSaude } from "./saudeSistema";
import { contarFontesPendentes } from "./fontesPendentes";
import { mascararTexto, agruparEventos, gerarAlertas, nivelDeAviso, RETENCAO_DIAS, type EventoSaudeBase } from "../src/utils/saudeRegras";
import { montarDecisoes, type EstadoGrupo, type StatusGrupo } from "../src/utils/centralRegras";

export const centralRouter = express.Router();
const DIA = 86_400_000, STATUS: StatusGrupo[] = ["novo", "investigando", "resolvido", "ignorado"];
let esquema: Promise<void> | null = null;
const garantir = () => (esquema ||= (async () => {
  await garantirSaude();
  await consultaSaude(`CREATE TABLE IF NOT EXISTS central_estado (
    chave VARCHAR(80) NOT NULL PRIMARY KEY, status VARCHAR(16) NOT NULL DEFAULT '', nota VARCHAR(600) NOT NULL DEFAULT '', ts BIGINT NOT NULL, ate BIGINT NOT NULL DEFAULT 0, por VARCHAR(190) NOT NULL DEFAULT '',
    KEY ix_central_ts (ts)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
})().catch((e) => { esquema = null; throw e; }));

// o estado (status/nota/dispensa) também some 30 dias depois da última alteração: junto com os registros a que se refere
aoLimparSaude(async (limite) => { await garantir(); const [r]: any = await consultaSaude("DELETE FROM central_estado WHERE ts < ?", [limite]); return r?.affectedRows || 0; });

const soSuper = async (req: express.Request) => { const u = await autenticarSessao(req); if (!u.superAdmin) throw Object.assign(new Error("somente o super administrador"), { status: 403 }); return u; };

centralRouter.get("/resumo", async (req, res) => {
  try {
    await soSuper(req); await garantir(); await esvaziarFilaSaude();
    const horas = Math.min(RETENCAO_DIAS * 24, Math.max(24, Number(req.query.horas) || 168)), agora = Date.now(), janela = horas * 3_600_000;
    const [linhas]: any = await consultaSaude("SELECT ts, tipo, modulo, severidade, assinatura, mensagem, email FROM saude_eventos WHERE ts >= ? AND severidade <> 'info' ORDER BY ts DESC LIMIT 20000", [agora - janela]);
    const eventos: EventoSaudeBase[] = linhas.map((r: any) => ({ ts: Number(r.ts), tipo: r.tipo, modulo: r.modulo, severidade: r.severidade, assinatura: r.assinatura, mensagem: r.mensagem, email: r.email || undefined }));
    const [est]: any = await consultaSaude("SELECT chave, status, nota, ts, ate, por FROM central_estado LIMIT 5000");
    const estados = new Map<string, EstadoGrupo>(), dispensas: Record<string, number> = {};
    for (const e of est) { if (e.chave.startsWith("g:")) estados.set(e.chave.slice(2), { status: e.status, nota: e.nota, ts: Number(e.ts), por: e.por || undefined }); else if (e.chave.startsWith("d:")) dispensas[e.chave.slice(2)] = Number(e.ate); }
    const grupos = agruparEventos(eventos, janela, agora).slice(0, 80).map((g) => ({ ...g, estado: estados.get(g.assinatura) || null }));
    const [[mais]]: any = await consultaSaude("SELECT MIN(ts) AS ts FROM saude_eventos").then((r: any) => [r[0]]);
    const decisoes = montarDecisoes({ grupos, alertas: gerarAlertas(eventos.filter((e) => e.ts >= agora - 86_400_000), agora), fontesPendentes: await contarFontesPendentes().catch(() => 0), nivelRetencao: nivelDeAviso(mais?.ts ? Number(mais.ts) : null, agora), dispensas, agora });
    res.json({ horas, geradoEm: agora, grupos, decisoes, retencaoDias: RETENCAO_DIAS });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

/** Marca o status e a nota de um erro agrupado. */
centralRouter.post("/grupo", async (req, res) => {
  try {
    const u = await soSuper(req); await garantir();
    const assinatura = String(req.body?.assinatura || ""), status = String(req.body?.status || "") as StatusGrupo;
    if (!/^[0-9a-f]{40}$/.test(assinatura) || !STATUS.includes(status)) return void res.status(400).json({ erro: "dados inválidos" });
    const nota = mascararTexto(req.body?.nota || "", 600);
    await consultaSaude("INSERT INTO central_estado (chave, status, nota, ts, ate, por) VALUES (?,?,?,?,0,?) ON DUPLICATE KEY UPDATE status=VALUES(status), nota=VALUES(nota), ts=VALUES(ts), por=VALUES(por)", ["g:" + assinatura, status, nota, Date.now(), String(u.email || "").slice(0, 190)]);
    res.json({ ok: true });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

/** "Dispensar" um item da Central por alguns dias (some da lista e volta depois). */
centralRouter.post("/dispensar", async (req, res) => {
  try {
    const u = await soSuper(req); await garantir();
    const chave = String(req.body?.chave || "").slice(0, 70), dias = Math.min(RETENCAO_DIAS, Math.max(1, Number(req.body?.dias) || 7));
    if (!/^[a-z]:[\w.-]+$/i.test(chave)) return void res.status(400).json({ erro: "dados inválidos" });
    await consultaSaude("INSERT INTO central_estado (chave, status, nota, ts, ate, por) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE ate=VALUES(ate), ts=VALUES(ts)", ["d:" + chave, "", "", Date.now(), Date.now() + dias * DIA, String(u.email || "").slice(0, 190)]);
    res.json({ ok: true });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});
