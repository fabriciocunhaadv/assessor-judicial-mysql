// Tema visual do sistema: só o "clássico" (o visual roxo "hostinger" foi retirado). Mantido como função para limpar a classe do tema antigo.
export type Tema = "classico";

export const temaAtual = (): Tema => "classico";
export const aplicarTema = (_t: Tema = "classico"): void => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("tema-hostinger");
  try { document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0f172a"); } catch { /* sem meta */ }
};
