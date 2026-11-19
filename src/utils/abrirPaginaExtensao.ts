// Abre uma página da extensão (“Inicie aqui”, painel completo ou pauta de audiências) numa ABA NOVA a partir do Studio.
// O navegador só permite isso se a extensão (2.0.6 ou mais nova) liberar a página para este site e anunciar o seu id em `data-assessor-extensao-id`.
export type PaginaDaExtensao = "painel.html" | "pauta.html" | "iniciar.html";
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

/** A página “Inicie aqui” (painel simplificado) existe na extensão 4.0.2 ou mais nova. */
export function extensaoTemInicieAqui(): boolean {
  try {
    const v = String(document.documentElement.dataset.assessorExtensao || "").split(".").map((n) => parseInt(n, 10) || 0), min = [4, 0, 2];
    for (let i = 0; i < 3; i++) { if ((v[i] || 0) !== min[i]) return (v[i] || 0) > min[i]; }
    return true;
  } catch { return false; }
}
/** A extensão libera o “Inicie aqui” para o Studio abrir (4.0.11+: recurso "inicie-web"); antes disso o navegador bloqueia a aba e só o painel completo abre. */
export function extensaoAbreInicieAqui(): boolean {
  try { return String(document.documentElement.dataset.assessorExtensaoRecursos || "").split(",").includes("inicie-web"); } catch { return false; }
}
/** Link “Extensão do Chrome” do Studio: com a extensão instalada abre o “Inicie aqui” dela (o painel completo se for versão antiga); sem ela, a página de instalação. Devolve true se abriu a extensão. */
export function abrirExtensaoOuLoja(urlLoja: string): boolean {
  const r = abrirPaginaDaExtensao(extensaoAbreInicieAqui() ? "iniciar.html" : "painel.html");
  if (r === "aberto") return true;
  try { window.open(urlLoja, "_blank", "noopener"); } catch { /* sem pop-up */ }
  return false;
}
/** Para onde o Studio manda quem quer “o painel da extensão”: o simplificado (“Inicie aqui”); em extensão antiga, o painel completo (único que ela tem). */
export const paginaDoPainelSimples = (): PaginaDaExtensao => (extensaoAbreInicieAqui() ? "iniciar.html" : "painel.html");
