// Mensagem de boas-vindas para quem pediu acesso e o Super Admin não conhece: apresenta o sistema em poucas linhas e pede os dados para iniciar a conversa.
// É um rascunho de e-mail (mailto): abre o programa de e-mail do Super Admin já preenchido; ele revisa e envia (nenhuma senha de e-mail passa pelo sistema).
export const LINK_SISTEMA = "https://judicial-mysql.assessor.net.br";

export function mensagemBoasVindas(nomeDestino: string, nomeRemetente: string): { assunto: string; corpo: string } {
  const primeiro = String(nomeDestino || "").trim().split(/\s+/)[0] || "";
  const ass = String(nomeRemetente || "").trim() || "Administração do Assessor Judicial";
  const corpo = [
    `Olá${primeiro ? ", " + primeiro : ""}! Tudo bem?`,
    "",
    `Recebi o seu pedido de acesso ao Assessor Judicial (${LINK_SISTEMA}). Seja bem-vindo(a)!`,
    "",
    "Em poucas palavras, o sistema é um assistente de inteligência artificial para gabinetes judiciais:",
    "• lê o processo (em PDF, ou direto do Projudi pela extensão do Chrome) e redige a minuta do ato (decisão, despacho ou sentença) no estilo do gabinete;",
    "• confere citações, teses e legislação, e guarda tudo no seu Histórico;",
    "• tem uma extensão que envia uma fila de processos de uma só vez, sem você precisar abrir um por um.",
    "",
    "Para liberar o seu acesso e deixar o sistema do jeito do seu trabalho, gostaria de conhecer você. Pode responder este e-mail com:",
    "1) seu nome completo e função (magistrado(a), assessor(a), servidor(a)...);",
    "2) o gabinete/vara e a comarca em que trabalha (e o nome do(a) magistrado(a), se for assessor(a));",
    "3) um telefone ou WhatsApp para contato;",
    "4) como pretende usar o sistema (matérias e tipos de processo).",
    "",
    "Fico à disposição para tirar qualquer dúvida.",
    "",
    "Um abraço,",
    ass,
  ].join("\n");
  return { assunto: "Bem-vindo(a) ao Assessor Judicial — vamos conversar?", corpo };
}

export const linkEmailBoasVindas = (email: string, nomeDestino: string, nomeRemetente: string): string => {
  const { assunto, corpo } = mensagemBoasVindas(nomeDestino, nomeRemetente);
  return `mailto:${encodeURIComponent(String(email || "").trim()).replace(/%40/g, "@")}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
};
