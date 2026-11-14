// INSTRUÇÃO DA SENTENÇA APÓS AUDIÊNCIA — só do Mutirão Expresso (Mesa de Audiências). Num lugar único, usada pela rota do servidor e pelo caminho do gigante do Mutirão,
// para os dois nunca se afastarem. NÃO mexe nas regras gerais dos outros motores (principal, Turbo, Lupa, extensão): vai ao motor apenas como "instruções específicas".
// As regras adicionais são CONDICIONAIS (só valem se a situação existir nos autos) e não citam nada de um processo em particular.

export type OrigemDegravacao = "video" | "texto";

const BASE = "SENTENÇA DE MÉRITO APÓS AUDIÊNCIA DE INSTRUÇÃO E JULGAMENTO — minuta COMPLETA, EXTENSA e ANALÍTICA, no padrão da esteira principal (nunca resumida). OBRIGATÓRIO: (1) RELATÓRIO: percorra TODAS as movimentações do QUADRO DE MOVIMENTAÇÕES, da primeira à ÚLTIMA (cite Mov. e data de cada ato relevante: petição inicial, decisões, citação, contestação, perícia, intimações, juntada de rol de testemunhas, audiência e a mídia publicada), com pedidos, defesa e réplica. (2) FUNDAMENTAÇÃO em texto corrido, pronta para uso, SEM títulos sobre a dinâmica de análise (só 'Preliminares', 'Mérito' ou questão específica): questões preliminares/prejudiciais; PROVA DOCUMENTAL analisada arquivo por arquivo (nome do arquivo, Mov., Arq., Pág.) com trechos entre aspas e o que cada um prova; PERÍCIA (conclusões e quesitos); PROVA ORAL em profundidade: para CADA testemunha e parte, vários períodos com o que disse de concreto (fatos, datas, circunstâncias, contradições, grau de conhecimento direto), com a marcação [mm:ss] da DEGRAVAÇÃO, confrontando com a prova documental e explicando por que leva à procedência ou à improcedência; LEGISLAÇÃO (artigos), súmulas, teses e jurisprudência SOMENTE se pertinentes ao pedido (não cite súmula sem relação com o caso), explicando a aplicação; consectários conforme a tese aplicável. (3) DISPOSITIVO completo com todos os comandos (tutela, prazos, custas, honorários, remessa necessária, intimações). A DEGRAVAÇÃO é prova oral: use-a para fundamentar, mas NÃO a copie na minuta.";

const REGRAS_ADICIONAIS = " REGRAS ADICIONAIS DA SENTENÇA APÓS AUDIÊNCIA (valem só se a situação existir nos autos): " +
  "(a) PROVA ORAL: para cada depoente identifique a condição (parte, testemunha compromissada ou informante, art. 447, §§ 4º e 5º, do CPC) e examine interesse, impedimento ou suspeição (parentesco, ex-companheiro, amizade íntima, inimizade, interesse no litígio; art. 447, §§ 2º e 3º), se o conhecimento é direto ou por ouvir dizer, e as contradições com os demais depoimentos e com os documentos. Prova oral também é prova: só aplique o ônus da prova (art. 373) depois de valorar a prova oral, e não exija documento onde há depoimento. " +
  "(b) NEGÓCIO VERBAL: se o valor do negócio for alto, diga se a prova testemunhal é principal ou complementar (art. 227 do CC) e se há admissão das partes ou início de prova. " +
  "(c) CAUSA DE PEDIR: trate o pedido como a parte o formulou (art. 322, § 2º, do CPC); não o reescreva como outra pretensão para depois rejeitá-lo. " +
  "(d) VALORES: cada valor retido, compensado ou descontado tem UM só fundamento; havendo pedido contraposto ou reconvenção, não use o mesmo valor em dois fundamentos incompatíveis e diga o saldo que sobrar. Exceção do contrato não cumprido (art. 476 do CC): demonstre o descumprimento, sua extensão e a proporção da retenção. Compensação (arts. 368 e 369 do CC): só entre dívidas líquidas, vencidas e de coisas fungíveis. " +
  "(e) VALOR CERTO: se os autos permitirem fixar o valor devido, fixe-o na sentença (art. 491 do CPC); só remeta à liquidação justificando o inciso I ou II do art. 491. " +
  "(f) PEDIDOS: enfrente todos os pedidos, inclusive os cumulados (prestação de contas, obrigação de fazer, tutela), cada um com resultado no dispositivo. " +
  "(g) CUSTAS E HONORÁRIOS: a suspensão da exigibilidade (art. 98, § 3º, do CPC) vale só para quem tem gratuidade deferida; o parcelamento de custas não suspende; é vedada a compensação de honorários (art. 85, § 14). " +
  "(h) FONTES: não cite \"a jurisprudência\" de modo genérico; só precedente com tribunal, número e data que constem dos autos ou do sistema; se não houver, fundamente apenas na lei.";

/** Instrução ANTIGA (sem as regras adicionais): continua valendo para a "Sentença com vídeo" da extensão, que não foi alterada. */
export const INSTRUCAO_SENTENCA_AUDIENCIA_ANTIGA = BASE;
/** Instrução completa que a TELA do Mutirão Expresso manda ao motor (pedido com calibracaoMutirao=1). */
export const INSTRUCAO_SENTENCA_AUDIENCIA = BASE + REGRAS_ADICIONAIS;

/** Bloco da degravação enviado ao motor. O rótulo diz de onde veio o texto: lido dos vídeos pelo Studio, ou colado pelo usuário (feito fora, pode não ter minutos nem separar quem fala). */
export function blocoDegravacao(texto: string, origem: OrigemDegravacao = "video"): string {
  const t = String(texto || "").trim(); if (!t) return "";
  const rotulo = origem === "texto"
    ? "TRANSCRIÇÃO DA AUDIÊNCIA DE INSTRUÇÃO E JULGAMENTO FORNECIDA PELO USUÁRIO — PROVA ORAL (texto feito fora do Studio; pode não trazer marcação de tempo nem separar quem fala). Cite [mm:ss] SOMENTE se o texto trouxer marcação de tempo; do contrário, identifique o depoente e transcreva trechos entre aspas, sem inventar minutos nem falas"
    : "DEGRAVAÇÃO DA AUDIÊNCIA DE INSTRUÇÃO E JULGAMENTO — PROVA ORAL (lida do vídeo; cada vídeo costuma ser o depoimento de uma pessoa)";
  return `[${rotulo}]\n${t}\n[FIM DA DEGRAVAÇÃO]\n\n`;
}

/** Olha o texto colado e diz se tem marcação de tempo e se separa quem fala (para avisar o usuário; nunca bloqueia). */
export function avaliarTranscricao(texto: string): { temTempo: boolean; temFalas: boolean } {
  const t = String(texto || "");
  const temTempo = /(?:^|[\s(\[])\d{1,2}:\d{2}(?::\d{2})?(?=[\s)\]-–]|$)/m.test(t);
  const falas = t.match(/^\s*(?:[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?\s*[-–]?\s*)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ .()'-]{1,40}\s*[:\]-]\s*\S/gm) || [];
  return { temTempo, temFalas: falas.length >= 3 };
}
