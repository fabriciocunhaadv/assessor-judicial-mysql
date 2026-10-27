import { type CorteArquivo, textoDoCorte } from "../src/utils/corteAutos";

// Cobertura da leitura: páginas que o sistema não conseguiu ler não podem virar "ausência de prova" na minuta (usada na análise principal, no Turbo e na Lupa)
export function montarCobertura(body: any, textoCortado: boolean, cortes: CorteArquivo[] = []): { cobertura: any; regra: string; partes: any[] } {
    let cobertura: any = null; let regra = ""; const partes: any[] = [];
    try {
        const cob = body?.coberturaLeitura;
        const faixa = (nums: any): string => {
            const v: number[] = (Array.isArray(nums) ? nums : []).map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0).sort((a: number, b: number) => a - b);
            const out: string[] = []; let i = 0;
            while (i < v.length) { let j = i; while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++; out.push(j > i ? `${v[i]}-${v[j]}` : `${v[i]}`); i = j + 1; }
            return out.join(", ");
        };
        const arquivos: any[] = Array.isArray(cob?.arquivos) ? cob.arquivos : [];
        const lacunas = arquivos.map((a: any) => ({ arquivo: String(a?.nome || "arquivo"), total: Number(a?.totalPaginas) || 0, paginas: faixa([...(a?.semTexto || []), ...(a?.naoLidas || [])]), qtd: Math.max(Number(a?.semTextoTotal) || 0, Array.isArray(a?.semTexto) ? a.semTexto.length : 0) + Math.max(Number(a?.naoLidasTotal) || 0, Array.isArray(a?.naoLidas) ? a.naoLidas.length : 0) })).filter((l: any) => l.qtd > 0);
        const imagens: any[] = Array.isArray(body?.paginasImagens) ? body.paginasImagens.slice(0, 40) : [];
        let nImagens = 0;
        for (const im of imagens) {
            const d = String(im?.data || "").replace(/^data:[^;]+;base64,/, "");
            if (d) { nImagens++; partes.push({ text: `[IMAGEM DA PÁGINA ${Number(im.pagina) || "?"} DOS AUTOS (${String(im.arquivo || "")}) - sem camada de texto; leia visualmente como parte dos autos]` }); partes.push({ inlineData: { mimeType: "image/jpeg", data: d } }); }
        }
        if (cob || textoCortado) {
            cobertura = {
                totalPaginas: arquivos.reduce((n: number, a: any) => n + (Number(a?.totalPaginas) || 0), 0),
                lacunas: lacunas.map((l: any) => ({ arquivo: l.arquivo, paginas: l.paginas, qtd: l.qtd })),
                escolha: String(cob?.escolha || ""),
                paginasOcr: Number(cob?.paginasOcr) || 0,
                paginasImagem: nImagens,
                textoCortado,
                cortes,
                completa: lacunas.length === 0 && !textoCortado,
            };
        }
        if (lacunas.length > 0 || textoCortado) {
            regra = `\n\n[COBERTURA DA LEITURA - REGRA MANDATÓRIA ANTI-FALSA-AUSÊNCIA-DE-PROVA]:\n`
                + (lacunas.length > 0 ? `O sistema NÃO conseguiu ler o texto destas páginas dos autos (imagem/escaneado sem texto): ${lacunas.map((l: any) => `${l.arquivo}: págs. ${l.paginas}`).join("; ")}. Essas páginas PODEM conter provas, documentos, contestação ou decisões.\n` : "")
                + (textoCortado ? `Os autos excederam o limite técnico e parte do FINAL do texto foi CORTADA: ${cortes.length ? cortes.map(textoDoCorte).join("; ") : "documentos posteriores"} NÃO foram lidos e podem conter provas, contestação ou decisões.\n` : "")
                + `1. É PROIBIDO afirmar na minuta que "não há prova", "não foi juntado documento", "não consta dos autos", "a parte não comprovou" ou fundamentar procedência/improcedência por ausência probatória quando a prova poderia estar nas páginas não lidas.\n`
                + `2. Quando faltar prova nos trechos lidos, use a redação: "não localizei, nos trechos lidos pelo sistema, ..." e inclua obrigatoriamente no início do Relatório a nota: "[CONFERIR PÁGINAS NÃO LIDAS PELO SISTEMA: ${[...lacunas.map((l: any) => `${l.arquivo} págs. ${l.paginas} (sem texto)`), ...cortes.map((c: CorteArquivo) => textoDoCorte(c) + " (cortado por limite de tamanho)")].join("; ") || "final dos autos"} - verificar antes de assinar]".\n`
                + `3. Se a conclusão do mérito depender dessas lacunas, aponte a dependência e recomende a conferência humana em vez de decidir por ausência de prova.\n`;
        }
    } catch (eCob) { console.log("[Cobertura da leitura] falha (ignorada):", (eCob as any)?.message); }
    return { cobertura, regra, partes };
}
