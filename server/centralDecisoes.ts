// CENTRAL DE DECISÕES (Super Admin): junta o que já é registrado (Saúde, erros agrupados, fontes pendentes, limpeza) numa lista do que precisa de atenção
// e guarda o STATUS de cada erro agrupado (novo, em investigação, resolvido, ignorado; "resolvido" que volta vira reincidente) com uma nota.
// Só LÊ os registros existentes: não altera nenhum motor. A tabela própria é pequena e é limpa junto com a rotina de 30 dias da Saúde.
import express from "express";
import { autenticarSessao, mensagemDeErro } from "./authRoutes";
import { consultaSaude, garantirSaude, esvaziarFilaSaude, aoLimparSaude } from "./saudeSistema";
import { contarFontesPendentes } from "./fontesPendentes";
import { mascararTexto, agruparEventos, gerarAlertas, nivelDeAviso, RETENCAO_DIAS, type EventoSaudeBase } from "../src/utils/saudeRegras";
import { banco } from "./historyRoutes";
import { lerMetricas } from "./motoresMetricas";
import { resumirMotores, motorDoModulo, resumirVersoes, resumirIaExterna, minutasPorSemana, avisosDoGabinete, type FichaGabinete, type UsoIA, type EventoExt } from "../src/utils/calibragemRegras";
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

const parse = (t: any): any => { try { const v = JSON.parse(String(t)); return v && typeof v === "object" ? v : {}; } catch { return {}; } };

/** Calibragem por motor: pedidos, erros, cota, tempo e tamanho dos autos (métricas por hora) + tokens, custo e modelos (registros de uso). Só leitura. */
centralRouter.get("/motores", async (req, res) => {
  try {
    await soSuper(req); await garantir();
    const dias = Math.min(RETENCAO_DIAS, Math.max(1, Number(req.query.dias) || 7)), agora = Date.now(), desde = agora - dias * DIA;
    const linhas = await lerMetricas(desde), usos: UsoIA[] = [], avisos: string[] = [];
    try {
      const [logs]: any = await banco().query("SELECT data FROM docs WHERE col LIKE 'gabinetes/%/usageLogs' AND updated_at >= ? LIMIT 100000", [desde]);
      for (const r of logs) { const d = parse(r.data), motor = motorDoModulo(String(d.module || "")); if (motor) usos.push({ motor, tokens: Number(d.totalTokens) || 0, custo: Number(d.costBrl) || 0, modelo: String(d.model || "").slice(0, 60) }); }
    } catch (e: any) { avisos.push("registros de uso: " + String(e?.code || e?.message || e).slice(0, 120)); }
    res.json({ dias, geradoEm: agora, motores: resumirMotores(linhas, usos), avisos, observacao: "Os pedidos começam a ser contados a partir da atualização que criou este quadro." });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

/** Ficha de cada gabinete: usuários, minutas por semana, motores mais usados, chaves, última atividade e erros. Só leitura. */
centralRouter.get("/gabinetes", async (req, res) => {
  try {
    await soSuper(req); await garantir();
    const agora = Date.now(), d30 = agora - 30 * DIA, d28 = agora - 28 * DIA, d7 = agora - 7 * DIA, avisos: string[] = [];
    const tentar = async (nome: string, f: () => Promise<void>) => { try { await f(); } catch (e: any) { avisos.push(`${nome}: ${String(e?.code || e?.message || e).slice(0, 120)}`); } };
    const fichas = new Map<string, FichaGabinete & { _ativos: Set<string>; _tem: boolean }>();
    const pegar = (id: string) => { let f = fichas.get(id); if (!f) { f = { id, nome: id, usuarios: { total: 0, ativos30d: 0, pendentes: 0 }, minutasSemana: 0, motores: [], chaves: { nativaLiberada: 0, execNativa: 0, execPropria: 0 }, ultimaAtividade: 0, erros7d: 0, ultimoErro: "", avisos: [], _ativos: new Set(), _tem: false }; fichas.set(id, f); } return f; };
    await tentar("usuários", async () => {
      const [us]: any = await banco().query("SELECT email, tenant_id, status, can_use_native_key FROM users");
      for (const u of us) { const f = pegar(String(u.tenant_id || "(sem gabinete)")); f.usuarios.total++; if (u.status === "pendente") f.usuarios.pendentes++; if (u.can_use_native_key) f.chaves.nativaLiberada++; }
    });
    await tentar("nomes", async () => {
      const [pf]: any = await banco().query("SELECT col, data FROM docs WHERE id='profile' AND col REGEXP '^gabinetes/[^/]+/settings$' LIMIT 2000");
      for (const r of pf) { const id = String(r.col).split("/")[1], f = fichas.get(id); const nome = String(parse(r.data).name || ""); if (f && nome) f.nome = nome.slice(0, 80); }
    });
    await tentar("uso da IA", async () => {
      const [logs]: any = await banco().query("SELECT col, data FROM docs WHERE col LIKE 'gabinetes/%/usageLogs' AND updated_at >= ? LIMIT 200000", [d30]);
      const mods = new Map<string, Map<string, number>>();
      for (const r of logs) {
        const id = String(r.col).split("/")[1], f = fichas.get(id); if (!f) continue; const d = parse(r.data), t = Number(d.timeMs) || 0;
        const m = mods.get(id) || new Map<string, number>(); m.set(String(d.module || "outros"), (m.get(String(d.module || "outros")) || 0) + 1); mods.set(id, m);
        if (d.keyType === "native") f.chaves.execNativa++; else f.chaves.execPropria++;
        if (d.userEmail) f._ativos.add(String(d.userEmail).toLowerCase()); if (t > f.ultimaAtividade) f.ultimaAtividade = t;
      }
      for (const [id, m] of mods) fichas.get(id)!.motores = [...m.entries()].map(([modulo, n]) => ({ modulo, n })).sort((a, b) => b.n - a.n).slice(0, 5);
    });
    await tentar("minutas", async () => {
      const [h]: any = await banco().query("SELECT tenant, COUNT(*) AS n, MAX(`date`) AS ultimo FROM history WHERE `date` >= ? GROUP BY tenant", [d28]);
      for (const r of h) { const f = fichas.get(String(r.tenant)); if (!f) continue; f.minutasSemana = minutasPorSemana(Number(r.n) || 0); f.ultimaAtividade = Math.max(f.ultimaAtividade, Number(r.ultimo) || 0); }
    });
    await tentar("erros", async () => {
      const [er]: any = await consultaSaude("SELECT tenant, COUNT(*) AS n, MAX(ts) AS ult FROM saude_eventos WHERE ts >= ? AND severidade='erro' AND tenant <> '' GROUP BY tenant", [d7]);
      for (const r of er) { const f = fichas.get(String(r.tenant)); if (!f) continue; f.erros7d = Number(r.n) || 0; const [m]: any = await consultaSaude("SELECT mensagem FROM saude_eventos WHERE tenant=? AND severidade='erro' ORDER BY ts DESC LIMIT 1", [String(r.tenant)]); f.ultimoErro = String(m?.[0]?.mensagem || ""); }
    });
    const lista = [...fichas.values()].map(({ _ativos, _tem, ...f }) => { const o = { ...f, usuarios: { ...f.usuarios, ativos30d: _ativos.size } }; return { ...o, avisos: avisosDoGabinete(o, agora) }; })
      .sort((a, b) => b.avisos.length - a.avisos.length || b.ultimaAtividade - a.ultimaAtividade);
    res.json({ geradoEm: agora, gabinetes: lista, avisos });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

/** Aba da extensão: versão que cada usuário usa, erros reportados e sucesso por IA externa. Só leitura. */
centralRouter.get("/extensao", async (req, res) => {
  try {
    await soSuper(req); await garantir(); await esvaziarFilaSaude();
    const dias = Math.min(RETENCAO_DIAS, Math.max(1, Number(req.query.dias) || 30)), agora = Date.now(), janela = dias * DIA;
    const [rows]: any = await consultaSaude("SELECT ts, email, tenant, modulo, severidade, mensagem, assinatura, detalhe FROM saude_eventos WHERE tipo='extensao' AND ts >= ? ORDER BY ts DESC LIMIT 20000", [agora - janela]);
    const eventos: EventoExt[] = rows.map((r: any) => ({ ts: Number(r.ts), email: r.email || "", tenant: r.tenant || "", modulo: r.modulo, severidade: r.severidade, mensagem: r.mensagem, assinatura: r.assinatura, detalhe: r.detalhe ? parse(r.detalhe) : undefined }));
    const erros = agruparEventos(eventos.filter((e) => e.severidade !== "info").map((e) => ({ ...e, tipo: "extensao" })) as EventoSaudeBase[], janela, agora).slice(0, 25);
    res.json({ dias, geradoEm: agora, versoes: resumirVersoes(eventos), iaExterna: resumirIaExterna(eventos), erros, totalEventos: eventos.length });
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});
