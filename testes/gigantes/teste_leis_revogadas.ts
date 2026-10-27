import { extrairArtigos, notaLivreDoArtigo, processarHtmlLei } from "../../server/fontesOficiais";
import { separarDispositivos } from "../../src/utils/separarDispositivos";
import { htmlParaLinhas, trechoDoArtigo } from "../../src/utils/legislacaoPlanalto";
let falhas = 0; const ok = (c: any, m: string) => { if (!c) { falhas++; console.log("FALHOU:", m); } else console.log("ok:", m); };
(async () => {
  // PDF estadual: nota sem parênteses depois do caput = artigo revogado; depois de § = só o § (artigo vigente)
  const pdf = separarDispositivos(["[Página 1 de 2]", "Art. 178. Para atingir o objetivo previsto no art. 3º, o Estado manterá programas. Parágrafo único. Promoverá ainda convênios. Art. 179. Fica mantido, nos termos do ato transitório, o ensino. - Revogado pela Emenda Constitucional nº 14, de 28-6-1996, D.O. de 14-7-1996. Parágrafo único. Para os fins deste artigo. - Revogado pela Emenda Constitucional nº 14, de 28-6-1996. Art. 180. A lei disporá sobre o tema. § 1º Os prazos serão fixados. - Revogado pela Emenda Constitucional nº 20, de 1998. Art. 181. Texto vigente. - Redação dada pela Emenda nº 3."]);
  const ex = extrairArtigos(pdf, { notaLivre: true });
  ok(ex.artigos["179"]?.r === 1, "art. 179 (nota logo após o caput) reconhecido como revogado");
  ok(!ex.artigos["180"]?.r && !ex.artigos["178"]?.r && !ex.artigos["181"]?.r, "180 (só o § revogado), 178 e 181 (redação dada) continuam vigentes");
  const sem = extrairArtigos(pdf);
  ok(!sem.artigos["179"]?.r, "sem a opção, o formato sem parênteses não é reconhecido (Planalto em HTML não muda)");
  // normalização de "Art"
  const html = "<p>Art . 1º Primeiro.</p><p>Artigo 2º Segundo.</p><p>ART.3º Terceiro (Revogado pela Lei 9).</p><p>Art.4o Quarto.</p><p>Art. 5º Quinto.</p><p>Art. 6º Sexto.</p>";
  const l = htmlParaLinhas(html);
  ok(l.filter((x) => /^Art\. \d/.test(x)).length === 6, "'Art . 1º', 'Artigo 2º', 'ART.3º', 'Art.4o' reconhecidos: " + JSON.stringify(l.map((x) => x.slice(0, 8))));
  const t = trechoDoArtigo(l, "3"); ok(!!t && t.revogado, "trecho do art. 3 marcado como revogado (mesma regra do registro)");
  // diagnóstico: arquivo sem artigos
  let msg = ""; try { await processarHtmlLei({ id: "x", nome: "Lei X", url: "https://x/l1.htm" } as any, "<html><body><p>Acesso restrito</p><p>Faça login</p></body></html>"); } catch (e: any) { msg = String(e.message); }
  ok(/formato inesperado/.test(msg) && /O que li no começo/.test(msg) && /Acesso restrito/.test(msg), "erro mostra o começo do que foi lido: " + msg.slice(0, 120));
  process.exit(falhas ? 1 : 0);
})();
