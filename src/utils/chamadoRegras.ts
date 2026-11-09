// Regras PURAS do chamado aberto pelo celular (sem banco e sem rede): quais anexos são aceitos e o texto de contexto que acompanha o chamado.
// Só texto digitado, print (imagem) e PDF. NÃO há áudio nem transcrição (para não gastar cota de IA).
export const ANEXOS_MAX = 3;
export const TAMANHO_MAX = 4 * 1024 * 1024;      // por arquivo, depois de reduzir a imagem no próprio celular
export const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

export interface AnexoChamado { id: string; nome: string; tipo: string; tamanho: number }

/** Confere os primeiros bytes: o tipo declarado pelo navegador pode estar errado ou ser falso. */
export function tipoPelosBytes(b: Uint8Array): string {
  const h = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (b.length >= 8 && h(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (b.length >= 3 && h(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (b.length >= 12 && h(0, 0x52, 0x49, 0x46, 0x46) && h(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (b.length >= 5 && h(0, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return "";
}
export function validarAnexo(a: { tipoDeclarado: string; tamanho: number; bytes: Uint8Array }): { ok: true; tipo: string } | { ok: false; erro: string } {
  if (!a.tamanho || a.tamanho > TAMANHO_MAX) return { ok: false, erro: `o arquivo deve ter até ${Math.round(TAMANHO_MAX / 1048576)} MB` };
  const real = tipoPelosBytes(a.bytes);
  if (!real || !(TIPOS_ACEITOS as readonly string[]).includes(real)) return { ok: false, erro: "só são aceitos print (imagem PNG, JPEG ou WebP) e PDF" };
  if (a.tipoDeclarado && a.tipoDeclarado !== real && !(a.tipoDeclarado === "image/jpg" && real === "image/jpeg")) return { ok: false, erro: "o tipo do arquivo não confere com o conteúdo" };
  return { ok: true, tipo: real };
}
export const nomeSeguro = (n: string) => String(n || "arquivo").replace(/[\\/\0\r\n]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "arquivo";

export interface ContextoChamado { versaoApp?: string; aparelho?: string; fila?: { total: number; concluidos: number; erros: number; aguardando: number; analisando: number; pausados: number; modo?: string; ia?: string; ultimoErro?: string; versao?: string; pausa?: string } | null; computadorOnline?: boolean | null }
/** Bloco de texto que vai ao fim da descrição do chamado, para a equipe não precisar perguntar “qual versão? o que a fila mostrava?”. */
export function textoDeContexto(c: ContextoChamado): string {
  const l: string[] = ["— Informações enviadas automaticamente —"];
  if (c.aparelho) l.push(`Aparelho: ${c.aparelho.slice(0, 120)}`);
  if (c.versaoApp) l.push(`Versão do Studio: ${c.versaoApp}`);
  if (c.fila) {
    const f = c.fila; l.push(`Fila da extensão${f.versao ? ` (v${f.versao})` : ""}: ${f.concluidos} de ${f.total} concluídos, ${f.aguardando} na fila, ${f.analisando} analisando, ${f.erros} com erro, ${f.pausados} pausados${f.modo ? ` · motor: ${f.modo === "ia" ? `IA externa ${f.ia || ""}`.trim() : f.modo}` : ""}`);
    if (f.pausa) l.push(`Pausa: ${f.pausa}`); if (f.ultimoErro) l.push(`Último erro da fila: ${f.ultimoErro}`);
  }
  if (c.computadorOnline != null) l.push(`Computador: ${c.computadorOnline ? "ativo" : "sem sinal"}`);
  return l.length > 1 ? l.join("\n") : "";
}
