// UTILIZAÇÃO: o Super Admin vê quanto cada pessoa usou o sistema num período (execuções de IA por módulo, tokens, custo, minutas salvas, petições 360°)
// e quais módulos liberados por ele (Petição 360°, chave nativa) estão sendo usados. Só leitura: nada é gravado nem alterado.
import express from "express";
import { banco } from "./historyRoutes";
import { garantirDocs } from "./docsRoutes";

export const utilizacaoRouter = express.Router();

const MODULOS = ["minuta", "turbo", "copiloto", "audiencia", "lupa_magistrado", "chat_refino", "outros"] as const;
type Modulo = (typeof MODULOS)[number];
interface Uso { n: number; tokens: number; custo: number }
interface Linha {
  email: string; nome: string; tenant: string; papel: string; status: string; peticao360Liberada: boolean; chaveNativaLiberada: boolean;
  modulos: Record<Modulo, Uso>; execucoes: number; tokens: number; custo: number; chaveNativa: number;
  minutasSalvas: number; peticoes360: number; ultimoUso: number;
}
const vazio = (): Record<Modulo, Uso> => Object.fromEntries(MODULOS.map((m) => [m, { n: 0, tokens: 0, custo: 0 }])) as Record<Modulo, Uso>;
const dia = (s: any, fim: boolean, padrao: number) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${fim ? "23:59:59.999" : "00:00:00"}-03:00`) : padrao; };      // dias no horário de Brasília
const json = (t: any): any => { try { return JSON.parse(String(t)); } catch { return {}; } };

utilizacaoRouter.get("/", async (req: any, res) => {
  try {
    if (!req.usuarioSessao?.superAdmin) return void res.status(403).json({ erro: "somente o super administrador" });
    await garantirDocs();
    const agora = Date.now(), d0 = new Date(agora - 3 * 3600_000);
    const inicioMes = Date.parse(`${d0.getUTCFullYear()}-${String(d0.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`);
    const de = dia(req.query.de, false, inicioMes), ate = dia(req.query.ate, true, agora);
    if (ate < de) return void res.status(400).json({ erro: "a data final é anterior à inicial" });

    const [us] = await banco().query<any[]>("SELECT id, email, name, role, status, tenant_id, can_use_native_key, extras FROM users");
    const linhas = new Map<string, Linha>();
    const porUid = new Map<string, string>();
    for (const u of us) {
      const email = String(u.email || "").toLowerCase(), extras = json(u.extras);
      const legados: string[] = Array.isArray(extras.uidsAntigos) ? extras.uidsAntigos.map(String) : [];
      porUid.set(String(u.id), email); legados.forEach((x) => porUid.set(x, email));
      linhas.set(email, { email, nome: u.name || email.split("@")[0], tenant: u.tenant_id || "", papel: u.role, status: u.status, peticao360Liberada: u.role === "super_admin" || extras.peticao360 === true, chaveNativaLiberada: !!u.can_use_native_key || u.role === "super_admin", modulos: vazio(), execucoes: 0, tokens: 0, custo: 0, chaveNativa: 0, minutasSalvas: 0, peticoes360: 0, ultimoUso: 0 });
    }
    const pegar = (email: string, nome = "", tenant = ""): Linha => {
      email = email.toLowerCase();
      let l = linhas.get(email);
      if (!l) { l = { email, nome: nome || email.split("@")[0] || "(sem identificação)", tenant, papel: "", status: "fora do cadastro", peticao360Liberada: false, chaveNativaLiberada: false, modulos: vazio(), execucoes: 0, tokens: 0, custo: 0, chaveNativa: 0, minutasSalvas: 0, peticoes360: 0, ultimoUso: 0 }; linhas.set(email, l); }
      return l;
    };

    // 1) execuções de IA registradas (todos os gabinetes)
    const [logs] = await banco().query<any[]>("SELECT col, data FROM docs WHERE col LIKE 'gabinetes/%/usageLogs' AND updated_at BETWEEN ? AND ? LIMIT 300000", [de, ate]);
    let semDono = 0;
    for (const r of logs) {
      const d = json(r.data), t = Number(d.timeMs) || 0;
      if (t && (t < de || t > ate)) continue;
      const email = String(d.userEmail || porUid.get(String(d.userId || "")) || "").toLowerCase();
      if (!email) { semDono++; continue; }
      const l = pegar(email, d.userName, String(r.col).split("/")[1] || "");
      const m: Modulo = (MODULOS as readonly string[]).includes(d.module) ? d.module : "outros";
      const tok = Number(d.totalTokens) || 0, custo = Number(d.costBrl) || 0;
      l.modulos[m].n++; l.modulos[m].tokens += tok; l.modulos[m].custo += custo;
      l.execucoes++; l.tokens += tok; l.custo += custo;
      if (d.keyType === "native") l.chaveNativa++;
      l.ultimoUso = Math.max(l.ultimoUso, t || Number(d.timeMs) || 0);
    }

    // 2) petições 360° criadas no período
    const [pets] = await banco().query<any[]>("SELECT data FROM docs WHERE col='initial_petitions_history' LIMIT 50000");
    for (const r of pets) {
      const d = json(r.data), t = Number(d.createdAt) || 0, email = String(d.createdByEmail || "").toLowerCase();
      if (!email || t < de || t > ate) continue;
      const l = pegar(email); l.peticoes360++; l.ultimoUso = Math.max(l.ultimoUso, t);
    }

    // 3) minutas salvas no Histórico no período
    const [hist] = await banco().query<any[]>("SELECT created_by, LOWER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.creatorEmail'))) AS email, COUNT(*) AS n, MAX(`date`) AS ultimo FROM history WHERE `date` BETWEEN ? AND ? GROUP BY created_by, email", [de, ate]);
    for (const r of hist) {
      const email = String(r.email && r.email !== "null" ? r.email : porUid.get(String(r.created_by)) || "").toLowerCase();
      if (!email) { semDono += Number(r.n) || 0; continue; }
      const l = pegar(email); l.minutasSalvas += Number(r.n) || 0; l.ultimoUso = Math.max(l.ultimoUso, Number(r.ultimo) || 0);
    }

    const usuarios = [...linhas.values()].sort((a, b) => (b.execucoes + b.peticoes360 + b.minutasSalvas) - (a.execucoes + a.peticoes360 + a.minutasSalvas) || a.email.localeCompare(b.email));
    const soma = (f: (l: Linha) => number) => usuarios.reduce((n, l) => n + f(l), 0);
    const totais = {
      usuariosAtivos: usuarios.filter((l) => l.execucoes + l.peticoes360 + l.minutasSalvas > 0).length, usuariosCadastrados: us.length,
      execucoes: soma((l) => l.execucoes), tokens: soma((l) => l.tokens), custo: soma((l) => l.custo), minutasSalvas: soma((l) => l.minutasSalvas), peticoes360: soma((l) => l.peticoes360),
      porModulo: Object.fromEntries(MODULOS.map((m) => [m, { n: soma((l) => l.modulos[m].n), tokens: soma((l) => l.modulos[m].tokens), custo: soma((l) => l.modulos[m].custo) }])),
      semDono,
    };
    // módulos que o Super Admin libera por usuário: quem está liberado e quanto usou no período
    const liberados = [
      { id: "peticao360", nome: "Petição & Defesa 360°", unidade: "petições", pessoas: usuarios.filter((l) => l.peticao360Liberada && l.status !== "fora do cadastro").map((l) => ({ email: l.email, nome: l.nome, usos: l.peticoes360, ultimoUso: l.ultimoUso })) },
      { id: "chave_nativa", nome: "Chave nativa do sistema (IA)", unidade: "execuções com a chave nativa", pessoas: usuarios.filter((l) => l.chaveNativaLiberada && l.status !== "fora do cadastro").map((l) => ({ email: l.email, nome: l.nome, usos: l.chaveNativa, ultimoUso: l.ultimoUso })) },
    ];
    res.json({ periodo: { de, ate }, geradoEm: agora, totais, usuarios, liberados });
  } catch (e: any) {
    console.error("[utilizacao]", e?.message || e);
    res.status(500).json({ erro: "não foi possível calcular a utilização" });
  }
});
