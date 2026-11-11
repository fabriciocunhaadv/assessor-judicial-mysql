import React from "react";
import { AlertCircle, ExternalLink, X } from "lucide-react";
import { LINK_EXTENSAO } from "../utils/pdfViaExtensao";

/** Aviso que bloqueia a leitura do PDF quando falta (ou está antiga) a extensão no computador, com o link da loja. */
export function AvisoInstalarExtensao({ tipo, arquivos, aindaNao, aoFechar, aoTentar }: { tipo: "instalar" | "atualizar"; arquivos: string[]; aindaNao?: boolean; aoFechar: () => void; aoTentar: () => void }) {
  return (
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/70 p-3" role="dialog" aria-label="Instale a extensão" data-testid="aviso-instalar-extensao">
      <div className="w-full max-w-md bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700"><AlertCircle className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="text-base font-black">{tipo === "atualizar" ? "Atualize a extensão Conclusões Projudi" : "Instale a extensão Conclusões Projudi"}</h3>
            <p className="text-xs text-slate-600 mt-1">{tipo === "atualizar" ? "A extensão instalada é antiga e ainda não sabe tratar PDFs para o Studio." : "Para ler o PDF, o Studio usa a extensão: ela lê o processo página por página e faz OCR nas imagens (documentos escaneados, laudos, carimbos), no seu computador, sem gastar a cota da IA."}</p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <ol className="list-decimal pl-5 text-xs text-slate-700 space-y-1">
          <li>Clique em <b>{tipo === "atualizar" ? "Atualizar a extensão" : "Instalar a extensão"}</b> e depois em “Usar no Chrome”.</li>
          <li><b>Recarregue esta página do Studio</b> (tecla F5).</li>
          <li>Envie o PDF de novo{arquivos.length ? ` (${arquivos.join(", ").slice(0, 80)})` : ""}.</li>
        </ol>
        {aindaNao && <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2" data-testid="extensao-ainda-nao">Ainda não encontrei a extensão nesta página. Depois de instalar, recarregue a página (F5) e envie o PDF de novo.</div>}
        <div className="flex gap-2 flex-wrap">
          <a href={LINK_EXTENSAO} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5" data-testid="link-instalar-extensao"><ExternalLink className="w-3.5 h-3.5" /> {tipo === "atualizar" ? "Atualizar a extensão" : "Instalar a extensão"}</a>
          <button type="button" className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold" data-testid="btn-tentar-de-novo" onClick={aoTentar}>Já instalei, tentar de novo</button>
          <button type="button" className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold" onClick={() => window.location.reload()}>Recarregar a página</button>
        </div>
        <p className="text-[11px] text-slate-500">Use o Google Chrome ou o Microsoft Edge no computador. No celular, o Studio lê o PDF sozinho.</p>
      </div>
    </div>
  );
}
