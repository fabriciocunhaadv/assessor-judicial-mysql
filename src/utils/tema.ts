// Tema visual do sistema: "classico" (padrão: o visual original) ou "hostinger" (roxo, no estilo do hPanel; opcional, só o super admin liga). A escolha fica neste navegador.
export type Tema = "hostinger" | "classico";
const CHAVE = "assessor_tema_v2";

export const temaAtual = (): Tema => {
  try { return localStorage.getItem(CHAVE) === "hostinger" ? "hostinger" : "classico"; } catch { return "classico"; }
};
export const aplicarTema = (t: Tema = temaAtual()): void => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("tema-hostinger", t === "hostinger");
  try { document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "hostinger" ? "#17122b" : "#0f172a"); } catch { /* sem meta */ }
};
export const alternarTema = (): Tema => {
  const novo: Tema = temaAtual() === "hostinger" ? "classico" : "hostinger";
  try { localStorage.setItem(CHAVE, novo); } catch { /* sem armazenamento: vale só até recarregar */ }
  aplicarTema(novo);
  return novo;
};
