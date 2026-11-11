// Mídia (vídeo/áudio) das audiências do Mutirão Expresso: chega em PARTES (o navegador fatia o arquivo; proxies e a memória do servidor não aguentam um arquivo de centenas de MB de uma vez),
// é remontada num arquivo temporário e enviada à IA pelo envio de arquivos do Gemini (não "inline"). Tudo em disco temporário, apagado depois.
import fs from "fs";
import os from "os";
import path from "path";

export const RAIZ_MIDIA = path.join(os.tmpdir(), "mutirao-midia");
export const LIMITE_MIDIA_BYTES = 2 * 1024 * 1024 * 1024;      // 2 GB por mídia
const idSeguro = (s: any) => String(s || "").replace(/[^\w-]/g, "").slice(0, 60);
const pasta = (uid: string, id: string) => path.join(RAIZ_MIDIA, idSeguro(uid) || "anon", idSeguro(id));

const MIMES: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime", avi: "video/x-msvideo", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", aac: "audio/aac", flac: "audio/flac", "3gp": "video/3gpp" };
export const mimeDaMidia = (nome: string, informado?: string): string => {
  const ext = String(nome || "").toLowerCase().split(".").pop() || "";
  if (MIMES[ext]) return MIMES[ext];
  const m = String(informado || "").toLowerCase();
  return /^(video|audio)\//.test(m) ? m : "video/mp4";
};

export function guardarParte(uid: string, id: string, n: number, dados: Buffer): void {
  if (!(n >= 0 && n < 5000)) throw new Error("parte inválida");
  const p = pasta(uid, id); fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, String(n).padStart(5, "0")), dados);
}

/** Junta as partes (em ordem) num único arquivo. Confere que não falta nenhuma e que o tamanho bate com o que o navegador disse. */
export function montarArquivo(uid: string, id: string, total: number, tamanho?: number): { caminho: string; bytes: number } {
  const p = pasta(uid, id);
  if (!fs.existsSync(p)) throw new Error("a mídia não chegou ao servidor (envie de novo)");
  const arq = path.join(p, "midia.bin"), fd = fs.openSync(arq, "w"); let bytes = 0;
  try {
    for (let n = 0; n < total; n++) {
      const f = path.join(p, String(n).padStart(5, "0"));
      if (!fs.existsSync(f)) throw new Error(`faltou a parte ${n + 1} de ${total} da mídia (envie de novo)`);
      const b = fs.readFileSync(f); fs.writeSync(fd, b); bytes += b.length;
      if (bytes > LIMITE_MIDIA_BYTES) throw new Error("mídia grande demais (limite de 2 GB)");
    }
  } finally { fs.closeSync(fd); }
  if (tamanho && Math.abs(bytes - tamanho) > 0) throw new Error(`a mídia chegou incompleta (${bytes} de ${tamanho} bytes): envie de novo`);
  return { caminho: arq, bytes };
}

export function limparMidia(uid: string, id: string): void { try { fs.rmSync(pasta(uid, id), { recursive: true, force: true }); } catch { /* já apagada */ } }
/** Apaga o que sobrou de envios abandonados (mais de 3 horas). */
export function varrerMidiasAntigas(agora = Date.now(), idadeMs = 3 * 3600_000): number {
  let n = 0;
  try {
    for (const u of fs.readdirSync(RAIZ_MIDIA)) for (const i of fs.readdirSync(path.join(RAIZ_MIDIA, u))) {
      const p = path.join(RAIZ_MIDIA, u, i);
      try { if (agora - fs.statSync(p).mtimeMs > idadeMs) { fs.rmSync(p, { recursive: true, force: true }); n++; } } catch { /* ignora */ }
    }
  } catch { /* pasta ainda não existe */ }
  return n;
}
