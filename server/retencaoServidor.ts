// RETENÇÃO NO SERVIDOR: apaga do MySQL, sozinha, o que venceu (Histórico, auditorias da Lupa e audiências da Mesa), em todos os gabinetes.
// A regra (ligada/desligada, dias) é a mesma do painel do super admin, guardada em settings/retencao_historico. Nada roda se a regra estiver desligada.
import express from "express";
import { banco, garantirEsquema, apagarAtoDoTenant } from "./historyRoutes";
import { autenticarSessao, mensagemDeErro } from "./authRoutes";
import { normalizarConfigRetencao, situacaoValidade, limiteDeCandidatos, referenciaAudiencia, ConfigRetencao } from "../src/utils/retencaoRegras";

export const retencaoRouter = express.Router();
export interface ResultadoVarredura { historico: { candidatos: number; apagados: number }; auditorias: number; audiencias: number }

async function lerConfig(): Promise<ConfigRetencao> {
  try {
    const [rows] = await banco().query<any[]>("SELECT data FROM docs WHERE col='settings' AND id='retencao_historico'");
    return normalizarConfigRetencao(rows.length ? JSON.parse(rows[0].data) : null);
  } catch { return normalizarConfigRetencao(null); }      // sem a tabela ainda: regra desligada
}

/** Apaga (ou só conta, com `simular`) o que venceu. Lê só os registros já candidatos, em lotes. */
export async function varrerRetencao(opcoes: { simular?: boolean; parte?: "historico" | "lupa" | "tudo" } = {}): Promise<ResultadoVarredura> {
  const out: ResultadoVarredura = { historico: { candidatos: 0, apagados: 0 }, auditorias: 0, audiencias: 0 };
  await garantirEsquema();
  const cfg = await lerConfig();
  if (!cfg.ativa) return out;
  const limite = limiteDeCandidatos(cfg), parte = opcoes.parte || "tudo";
  if (parte !== "lupa") {
    // percorre os candidatos em páginas (do mais antigo ao mais novo); ato ainda na carência é pulado, não trava a varredura
    let dAnt = -1, iAnt = "", tAnt = "";
    for (let pagina = 0; pagina < 2000; pagina++) {
      const [rows] = await banco().query<any[]>("SELECT tenant, id, date FROM history_index WHERE date < ? AND (date > ? OR (date = ? AND (tenant > ? OR (tenant = ? AND id > ?)))) ORDER BY date, tenant, id LIMIT 500", [limite, dAnt, dAnt, tAnt, tAnt, iAnt]);
      if (rows.length === 0) break;
      const vencidos = rows.filter((r) => situacaoValidade(Number(r.date), cfg).fase === "vencido");
      out.historico.candidatos += vencidos.length;
      if (!opcoes.simular) for (const r of vencidos) { await apagarAtoDoTenant(r.tenant, r.id); out.historico.apagados++; }
      const ult = rows[rows.length - 1]; dAnt = Number(ult.date); tAnt = ult.tenant; iAnt = ult.id;
      if (rows.length < 500) break;
    }
  }
  if (parte !== "historico") {
    for (const [sufixo, campo] of [["audits", "date"], ["hearings", "updatedAt"]] as const) {
      const [rows] = await banco().query<any[]>("SELECT col, id, data FROM docs WHERE col LIKE ? AND col LIKE 'gabinetes/%'", [`%/${sufixo}`]);
      for (const r of rows) {
        if (!/^gabinetes\/[^/]+\/(audits|hearings)$/.test(r.col)) continue;
        let v: any; try { v = JSON.parse(r.data); } catch { continue; }
        const ref = sufixo === "audits" ? v.date : referenciaAudiencia(v);
        if (!(Number(ref) < limite) || situacaoValidade(ref, cfg).fase !== "vencido") continue;
        if (sufixo === "audits") out.auditorias++; else out.audiencias++;
        if (!opcoes.simular) await banco().query("DELETE FROM docs WHERE col=? AND id=?", [r.col, r.id]);
      }
    }
  }
  return out;
}

/** Super admin: roda a varredura agora ({ parte: "historico" | "lupa", simular }). */
retencaoRouter.post("/limpar", async (req, res) => {
  try {
    const u = await autenticarSessao(req);
    if (!u.superAdmin) return void res.status(403).json({ erro: "somente o super administrador" });
    res.json(await varrerRetencao({ simular: !!req.body?.simular, parte: req.body?.parte }));
  } catch (e: any) { res.status(e?.status || 500).json({ erro: mensagemDeErro(e) }); }
});

let iniciada = false;
/** Liga a varredura automática: 1 minuto depois de o servidor subir e depois a cada 6 horas. Falha nunca derruba o servidor. */
export function iniciarRetencaoNoServidor(): void {
  if (iniciada) return;
  iniciada = true;
  const rodar = () => { varrerRetencao().then((r) => { const n = r.historico.apagados + r.auditorias + r.audiencias; if (n) console.log(`[retenção] apagados: ${r.historico.apagados} atos, ${r.auditorias} auditorias, ${r.audiencias} audiências`); }).catch((e) => console.warn("[retenção] varredura falhou:", e?.code || "", e?.message || e)); };
  setTimeout(rodar, 60_000).unref?.();
  setInterval(rodar, 6 * 3_600_000).unref?.();
}
