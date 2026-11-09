// ANEXOS DO CHAMADO (print e PDF): guardados no banco, ligados ao usuário e ao gabinete. Só o autor, o administrador/juiz do mesmo gabinete e o Super Admin os veem.
// Aceita apenas PNG, JPEG, WebP e PDF (conferidos pelos primeiros bytes), até 4 MB cada. Apagados sozinhos depois de 90 dias. Não há áudio.
import express from "express";
import crypto from "node:crypto";
import { autenticarSessao, mensagemDeErro } from "./authRoutes";
import { consultaSaude, garantirSaude, aoLimparSaude } from "./saudeSistema";
import { validarAnexo, nomeSeguro, TAMANHO_MAX } from "../src/utils/chamadoRegras";

export const chamadoAnexosRouter = express.Router();
const DIA = 86_400_000;
let esquema: Promise<void> | null = null, iniciada = false;
const limite = new Map<string, { janela: number; n: number }>();

const garantir = () => (esquema ||= (async () => {
  await garantirSaude();
  await consultaSaude(`CREATE TABLE IF NOT EXISTS chamado_anexos (
    id CHAR(32) NOT NULL PRIMARY KEY, uid VARCHAR(128) NOT NULL, tenant VARCHAR(64) NOT NULL DEFAULT '', nome VARCHAR(120) NOT NULL, tipo VARCHAR(40) NOT NULL, tamanho INT NOT NULL, ts BIGINT NOT NULL, conteudo MEDIUMBLOB NOT NULL,
    KEY ix_anexo_uid (uid, ts), KEY ix_anexo_ts (ts)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
})().catch((e) => { esquema = null; throw e; }));

const falha = (res: express.Response, e: any) => res.status(e?.status || 500).json({ erro: mensagemDeErro(e) });
const corpo = express.raw({ type: () => true, limit: TAMANHO_MAX + 1024 });

chamadoAnexosRouter.post("/", corpo, async (req, res) => {
  try {
    const u = await autenticarSessao(req); await garantir();
    const agora = Date.now(), l = limite.get(u.uid);
    if (!l || agora - l.janela > 3_600_000) limite.set(u.uid, { janela: agora, n: 1 }); else if (++l.n > 20) return void res.status(429).json({ erro: "muitos envios; tente de novo daqui a pouco" });
    const bytes: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const v = validarAnexo({ tipoDeclarado: String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase(), tamanho: bytes.length, bytes });
    if (!v.ok) return void res.status(400).json({ erro: (v as any).erro });
    let nome = "arquivo"; try { nome = decodeURIComponent(String(req.headers["x-nome"] || "arquivo")); } catch { /* nome ruim: usa o padrão */ }
    nome = nomeSeguro(nome); const id = crypto.randomBytes(16).toString("hex");
    await consultaSaude("INSERT INTO chamado_anexos (id, uid, tenant, nome, tipo, tamanho, ts, conteudo) VALUES (?,?,?,?,?,?,?,?)", [id, String(u.uid), String(u.tenant || ""), nome, (v as any).tipo, bytes.length, agora, bytes]);
    res.json({ id, nome, tipo: (v as any).tipo, tamanho: bytes.length });
  } catch (e: any) { falha(res, e); }
});

/** Quem pode ver: o autor, o Super Admin e administrador/juiz do mesmo gabinete. */
const podeVer = (u: any, a: any) => u.superAdmin || String(a.uid) === String(u.uid) || (String(a.tenant || "") === String(u.tenant || "") && (u.role === "admin" || !!u.row?.is_judge));

chamadoAnexosRouter.get("/:id", async (req, res) => {
  try {
    const u = await autenticarSessao(req); await garantir();
    if (!/^[0-9a-f]{32}$/.test(req.params.id)) return void res.status(400).json({ erro: "anexo inválido" });
    const [r]: any = await consultaSaude("SELECT uid, tenant, nome, tipo, conteudo FROM chamado_anexos WHERE id=?", [req.params.id]);
    const a = r?.[0]; if (!a) return void res.status(404).json({ erro: "anexo não encontrado (pode ter sido apagado)" });
    if (!podeVer(u, a)) return void res.status(403).json({ erro: "sem permissão para ver este anexo" });
    res.setHeader("Content-Type", a.tipo); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(a.nome)}`); res.send(a.conteudo);
  } catch (e: any) { falha(res, e); }
});

chamadoAnexosRouter.delete("/:id", async (req, res) => {
  try {
    const u = await autenticarSessao(req); await garantir();
    if (!/^[0-9a-f]{32}$/.test(req.params.id)) return void res.status(400).json({ erro: "anexo inválido" });
    const [r]: any = await consultaSaude("SELECT uid, tenant FROM chamado_anexos WHERE id=?", [req.params.id]);
    if (r?.[0] && (u.superAdmin || String(r[0].uid) === String(u.uid))) await consultaSaude("DELETE FROM chamado_anexos WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { falha(res, e); }
});

export function iniciarChamadoAnexos(): void {
  if (iniciada) return; iniciada = true;
  aoLimparSaude(async () => { await garantir(); const [r]: any = await consultaSaude("DELETE FROM chamado_anexos WHERE ts < ?", [Date.now() - 90 * DIA]); return r?.affectedRows || 0; });
}
