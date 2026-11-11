/** Sites como o da Casa Civil de Goiás (legisla) montam a lei por JavaScript: o "Salvar como" do navegador guarda só a casca vazia da página. Detecta isso e explica o que fazer. */
export function paginaSoComCasca(html: string): string {
  const semScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const ehSpa = /<div id="app"><\/div>|<div id="root"><\/div>|without JavaScript enabled|enable JavaScript/i.test(html);
  if (!ehSpa || semScripts.length >= 600) return "";      // sem sinal de página montada por JavaScript, ou com texto de verdade: quem decide é o servidor
  return "Este arquivo é só a “casca” da página: o site carrega o texto da lei por JavaScript e o “Salvar como” do navegador não guarda esse texto (por isso não há artigos). Abra a lei no site, aperte Ctrl+A e Ctrl+C, cole num arquivo de texto (.txt) e envie o .txt — ou use Imprimir → “Salvar como PDF” e envie o PDF.";
}
