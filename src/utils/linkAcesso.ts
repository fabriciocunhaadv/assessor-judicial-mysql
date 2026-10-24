// Endereço de acesso que vai nos convites de novos usuários: o endereço oficial do sistema (judicial-mysql.assessor.net.br).
// Em qualquer outro endereço (pré-visualização, localhost, moldura de teste) usa o mesmo endereço oficial.
const PRINCIPAL = "https://judicial-mysql.assessor.net.br";
const ENDERECOS_OFICIAIS = new Set(["judicial-mysql.assessor.net.br"]);

export function linkDeAcesso(): string {
  try {
    if (typeof window !== "undefined" && ENDERECOS_OFICIAIS.has(window.location.hostname)) return window.location.origin;
  } catch { /* sem window: usa o principal */ }
  return PRINCIPAL;
}
