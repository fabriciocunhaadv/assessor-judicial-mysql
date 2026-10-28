// Cobertura dos autos: o relatório e a análise têm de percorrer o processo até a ÚLTIMA movimentação. Em autos longos a IA tendia a detalhar bem a primeira parte
// e passar rápido pelo fim, deixando de fora decisões e despachos recentes (ex.: minuta que citava até a Mov. 119 num processo que ia até a 157, com decisão na 148).

export const REGRA_COBERTURA_DOS_AUTOS = `

[COBERTURA DOS AUTOS — LEIA ATÉ A ÚLTIMA MOVIMENTAÇÃO]
1. Percorra os autos do começo ao FIM: identifique o número da ÚLTIMA movimentação e leia as últimas movimentações com o mesmo cuidado das primeiras. O relatório e a análise não podem parar no meio do processo.
2. DECISÕES, DESPACHOS, SENTENÇAS, ACÓRDÃOS, CERTIDÕES DE CUMPRIMENTO e manifestações das partes mais RECENTES não podem ser omitidos: se houver decisão ou despacho posterior ao último ato que você narrou, narre-o (com a localização Mov./Arq./Pág.) e considere o que ele determinou, cumpriu ou deixou pendente antes de decidir.
3. Intimações, publicações, expedições e certidões de rotina (intimação expedida/efetivada, aguardando envio ao DJEN, disponibilizada no Diário etc.) podem ser RESUMIDAS em uma frase ou agrupadas ("seguiram-se intimações regulares, sem manifestação nova"); não precisa citar uma a uma, mas não descarte uma que traga prazo, decurso, certidão de trânsito ou manifestação relevante.
4. Antes de concluir, confira: o último fato relevante que você narrou é o último ato relevante dos autos? Se não for, complete o relatório e ajuste a análise para considerar o que veio depois.`;
