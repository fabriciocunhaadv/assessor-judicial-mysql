// Abre uma página da extensão (painel completo ou pauta de audiências) numa ABA NOVA a partir do Studio.
// O navegador só permite isso se a extensão (2.0.6 ou mais nova) liberar a página para este site e anunciar o seu id em `data-assessor-extensao-id`.
export type PaginaDaExtensao = "painel.html" | "pauta.html";
export type ResultadoAbrirExtensao = "aberto" | "sem-extensao" | "extensao-antiga";

export function estadoDaExtensao(): ResultadoAbrirExtensao {
  try {
    const d = document.documentElement.dataset;
    if (!d.assessorExtensao && !(window as any).__projudiStudioMain) return "sem-extensao";
    return d.assessorExtensaoId ? "aberto" : "extensao-antiga";
  } catch { return "sem-extensao"; }
}

export function abrirPaginaDaExtensao(pagina: PaginaDaExtensao): ResultadoAbrirExtensao {
  const estado = estadoDaExtensao();
  if (estado !== "aberto") return estado;
  const id = document.documentElement.dataset.assessorExtensaoId as string;
  const a = document.createElement("a");
  a.href = `chrome-extension://${id}/${pagina}`; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();      // dentro do clique do usuário: o navegador aceita abrir a aba
  return "aberto";
}
