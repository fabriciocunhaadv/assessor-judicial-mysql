import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Scale,
  Search,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Filter,
  ShieldCheck,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileUp,
  RefreshCw,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText
} from "lucide-react";
import {
  BINDING_SOURCES,
  CORE_BINDING_PRECEDENTS,
  BindingPrecedent,
  searchBindingPrecedents,
  getIsGroundingEnabled,
  setIsGroundingEnabled,
  getCustomBindingPrecedents,
  addCustomBindingPrecedents,
  getLastPrecedentsSync,
  setLastPrecedentsSync,
  getAllBindingPrecedents,
  Conferencias,
} from "../utils/bindingPrecedents";
import { extractTextFromPdf } from "../utils/pdfExtractor";
import { getApiHeaders } from "../utils/apiKeyManager";
import { FontesOficiaisPanel } from "./FontesOficiaisPanel";

interface BindingPrecedentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSuperAdmin?: boolean;
}

export const BindingPrecedentsModal: React.FC<BindingPrecedentsModalProps> = ({
  isOpen,
  onClose,
  isSuperAdmin = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTribunal, setSelectedTribunal] = useState<"ALL" | "STF" | "STJ" | "TNU" | "TJGO" | "CUSTOM">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isGroundingActive, setIsGroundingActive] = useState<boolean>(() => getIsGroundingEnabled());
  const [precedentsVersion, setPrecedentsVersion] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<number>(() => getLastPrecedentsSync());
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<string | null>(null);
  const [serverPrecedents, setServerPrecedents] = useState<BindingPrecedent[]>([]);
  const [conferencias, setConferencias] = useState<Conferencias>({});
  const [soConferidos, setSoConferidos] = useState(false);
  const itemsPerPage = 5;

  // Carregamento e checagem da rotina de sincronização automática semanal (1 vez por semana)
  useEffect(() => {
    if (!isOpen) return;

    // Os precedentes anexados e as conferências ficam no banco (MySQL); não há importação automática dos tribunais
    recarregarLista();
  }, [isOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTribunal, precedentsVersion]);

  const toggleGrounding = () => {
    if (!isSuperAdmin) return;
    const nextVal = !isGroundingActive;
    setIsGroundingActive(nextVal);
    setIsGroundingEnabled(nextVal);
  };

  const recarregarLista = async (avisar = false) => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/custom-precedents", { headers: getApiHeaders() });
      const data = await res.json();
      if (data.success) {
        const agora = Date.now();
        setLastPrecedentsSync(agora); setLastSyncDate(agora);
        setServerPrecedents(Array.isArray(data.precedents) ? data.precedents : []);
        setConferencias(data.conferencias || {});
        setPrecedentsVersion((v) => v + 1);
        if (avisar) { setSyncMessage(`✅ Lista atualizada a partir do banco: ${data.count || 0} anexo(s) e ${Object.keys(data.conferencias || {}).length} item(ns) conferido(s).`); setTimeout(() => setSyncMessage(null), 5000); }
      } else throw new Error(data.error || "Falha ao ler a lista");
    } catch (err: any) {
      if (avisar) { setSyncMessage(`❌ Não consegui atualizar: ${err?.message || "Falha de rede"}`); setTimeout(() => setSyncMessage(null), 5000); }
    } finally { setIsSyncing(false); }
  };
  const alternarConferencia = async (item: BindingPrecedent) => {
    const conferir = !conferencias[item.id];
    const nota = conferir ? (window.prompt("Conferido na fonte oficial. Observação (opcional, ex.: link ou data da consulta):", "") ?? null) : "";
    if (nota === null) return;
    try {
      const r = await fetch("/api/precedentes/conferir", { method: "POST", headers: getApiHeaders(), body: JSON.stringify({ id: item.id, conferido: conferir, nota }) });
      const d = await r.json(); if (!d.success) throw new Error(d.error);
      setConferencias(d.conferencias || {});
    } catch (e: any) { setSyncMessage(`❌ ${e?.message || "Não consegui gravar a conferência."}`); setTimeout(() => setSyncMessage(null), 5000); }
  };
  const excluirAnexo = async (item: BindingPrecedent) => {
    if (!window.confirm(`Excluir "${item.number}" da base? Isso vale para todos os usuários.`)) return;
    try {
      const r = await fetch(`/api/precedentes/${encodeURIComponent(item.id)}`, { method: "DELETE", headers: getApiHeaders() });
      const d = await r.json(); if (!d.success) throw new Error(d.error);
      await recarregarLista();
    } catch (e: any) { setSyncMessage(`❌ ${e?.message || "Não consegui excluir."}`); setTimeout(() => setSyncMessage(null), 5000); }
  };

  const handleUploadPrecedentPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);
    setPdfUploadStatus("Lendo e extraindo conteúdo textual do PDF...");

    try {
      const extracted = await extractTextFromPdf(
        file,
        (curr, total) => {
          setPdfUploadStatus(`Lendo páginas do documento (${curr} de ${total})...`);
        },
        { fullSequential: true }
      );
      if (!extracted || !extracted.text || extracted.text.trim().length < 30) {
        throw new Error("Não foi possível extrair texto legível deste documento em PDF. Verifique se o arquivo possui camada de texto pesquisável (OCR) ou se é uma imagem digitalizada.");
      }

      const estimatedBlocks = Math.ceil(extracted.text.length / 120000) || 1;
      setPdfUploadStatus(`Indexando ${extracted.pageCount} páginas com IA (${estimatedBlocks} ${estimatedBlocks === 1 ? 'bloco' : 'blocos em paralelo'})...`);
      const res = await fetch("/api/parse-precedents-pdf", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          pdfText: extracted.text,
          fileName: file.name,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Resposta inválida do servidor (Status ${res.status}).`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || `Erro na indexação (Status ${res.status}).`);
      }

      // A indexação roda em segundo plano no servidor (cada lote já fica gravado); aqui só se acompanha o andamento
      if (data.jobId) {
        setPdfUploadStatus(`Indexando com IA: 0 de ${data.total} lote(s)... (pode levar alguns minutos)`);
        let fim: any = null;
        for (let t = 0; t < 600; t++) {
          await new Promise((r) => setTimeout(r, 3000));
          const rj = await fetch(`/api/parse-precedents-pdf/${encodeURIComponent(data.jobId)}`, { headers: getApiHeaders() });
          const j = await rj.json().catch(() => ({} as any));
          if (!rj.ok || !j.success) throw new Error(j.error || `Não consegui acompanhar a indexação (Status ${rj.status}).`);
          setPdfUploadStatus(`Indexando com IA: ${j.feitos} de ${j.total} lote(s)... ${j.adicionados} julgado(s) novo(s) até agora.`);
          if (j.status !== "rodando") { fim = j; break; }
        }
        if (!fim) throw new Error("A indexação está demorando mais que o normal. Confira a lista daqui a alguns minutos: os lotes prontos já ficam gravados.");
        await recarregarLista();
        setSelectedTribunal("CUSTOM");
        setCurrentPage(1);
        if (fim.status === "erro") throw new Error(fim.mensagem || "Falha na indexação.");
        setPdfUploadStatus(`${fim.adicionados > 0 ? "🎉" : "ℹ️"} ${fim.mensagem}${fim.erros?.length ? " Problemas: " + fim.erros.slice(0, 2).join(" | ") : ""}`);
        setTimeout(() => setPdfUploadStatus(null), 20000);
        return;
      }

      // Se o documento já estava previamente indexado no banco do servidor
      if (data.alreadyIndexed) {
        if (data.allPrecedents && Array.isArray(data.allPrecedents)) {
          setServerPrecedents(data.allPrecedents);
        }
        setPrecedentsVersion((v) => v + 1);
        setSelectedTribunal("CUSTOM");
        setCurrentPage(1);
        setPdfUploadStatus(`ℹ️ ${data.message || 'Este documento já foi indexado anteriormente e seus julgados estão disponíveis.'}`);
        setTimeout(() => setPdfUploadStatus(null), 8000);
        return;
      }

      if (data.allPrecedents && Array.isArray(data.allPrecedents)) {
        setServerPrecedents(data.allPrecedents);
        addCustomBindingPrecedents(data.allPrecedents);
      } else if (Array.isArray(data.precedents) && data.precedents.length > 0) {
        setServerPrecedents((prev) => [...data.precedents, ...prev]);
        addCustomBindingPrecedents(data.precedents);
      }

      setPrecedentsVersion((v) => v + 1);
      setSelectedTribunal("CUSTOM");
      setCurrentPage(1);
      setPdfUploadStatus(`🎉 Sucesso! ${data.count} precedente(s)/julgado(s) extraído(s) e indexado(s) a partir de "${file.name}" (${extracted.pageCount} páginas lidas na íntegra).`);
      setTimeout(() => setPdfUploadStatus(null), 8000);
    } catch (err: any) {
      setPdfUploadStatus(`❌ Falha na importação: ${err?.message || "Erro desconhecido"}`);
      setTimeout(() => setPdfUploadStatus(null), 20000);
    } finally {
      setIsUploadingPdf(false);
      if (e.target) e.target.value = "";
    }
  };

  // Combina precedentes nativos com os precedentes do servidor em memória + localStorage de forma resiliente
  const allCombinedPrecedents = useMemo(() => {
    const fromStorage = getCustomBindingPrecedents();
    const map = new Map<string, BindingPrecedent>();
    
    // 1. Precedentes do servidor em memória (prioritários)
    for (const p of serverPrecedents) {
      if (p && p.id) map.set(p.id, p);
    }
    // (a cópia antiga guardada no navegador não entra mais: o banco é a fonte única)
    // 3. Precedentes nativos do sistema
    for (const p of CORE_BINDING_PRECEDENTS) {
      if (p && p.id && !map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [serverPrecedents, precedentsVersion]);

  // Contadores dinâmicos para cada aba
  const counts = useMemo(() => {
    return {
      ALL: allCombinedPrecedents.length,
      TJGO: allCombinedPrecedents.filter(p => p.tribunal === "TJGO").length,
      STF: allCombinedPrecedents.filter(p => p.tribunal === "STF").length,
      STJ: allCombinedPrecedents.filter(p => p.tribunal === "STJ").length,
      TNU: allCombinedPrecedents.filter(p => p.tribunal === "TNU").length,
      CUSTOM: allCombinedPrecedents.filter(p => (p as any).sourceFile || p.id.startsWith("custom-")).length,
    };
  }, [allCombinedPrecedents]);

  const filteredPrecedents = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return allCombinedPrecedents.filter((item) => {
      if (selectedTribunal === "CUSTOM") {
        if (!(item as any).sourceFile && !item.id.startsWith("custom-")) {
          return false;
        }
      } else if (selectedTribunal !== "ALL" && item.tribunal !== selectedTribunal) {
        return false;
      }
      if (soConferidos && !conferencias[item.id]) return false;
      if (!q) return true;
      return (
        item.number.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.statement.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        item.area.toLowerCase().includes(q)
      );
    });
  }, [allCombinedPrecedents, searchQuery, selectedTribunal, soConferidos, conferencias]);

  const totalPages = Math.ceil(filteredPrecedents.length / itemsPerPage) || 1;
  const paginatedPrecedents = filteredPrecedents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCopy = (item: BindingPrecedent) => {
    const c = conferencias[item.id];
    const textToCopy = `[${item.tribunal} • ${item.number}]: ${item.title}\n"${item.statement}"\n(Fonte: ${item.sourceUrl}) ${c ? `[Conferido na fonte em ${new Date(c.em).toLocaleDateString("pt-BR")}]` : "[NÃO CONFERIDO: confirme o enunciado na fonte oficial antes de citar]"}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[98vh] sm:h-auto max-h-[98vh] sm:max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-900/10 via-slate-900/5 to-amber-900/10 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-amber-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Súmulas, Teses e Informativos (STF • STJ • TNU • TJGO)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Base interna + anexos • conferência manual
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Base compartilhada por todos os gabinetes: itens da base interna e documentos anexados por PDF pelo Super Administrador. Os marcados como “Conferido” foram verificados na fonte oficial pelo Super Administrador; os demais devem ser conferidos antes de citar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuperAdmin && <FontesOficiaisPanel />}

        {/* Informative Banner on 100% Automated Execution */}
        <div className="shrink-0 px-4 sm:px-6 py-2 bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-200/80 dark:border-emerald-900/50 flex items-center gap-2.5 sm:gap-3">
          <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-[11px] sm:text-xs text-emerald-900 dark:text-emerald-200 leading-snug">
            <strong>Aplicação automática:</strong> O backend cruza os fatos dos autos com os itens desta lista (incluindo os anexados), indicando à IA a situação de cada um (conferido ou não) e proibindo-a de inventar numeração. Aplica as súmulas e teses cabíveis diretamente na minuta com custo zero de busca externa.
          </div>
        </div>

        {/* Grounding ao Vivo Toggle Banner - Somente Super Admin pode ativar */}
        <div className="shrink-0 px-4 sm:px-6 py-2 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-200/80 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="text-[11px] sm:text-xs text-blue-950 dark:text-blue-200 leading-snug">
              <strong>Pesquisa Web ao Vivo (Grounding):</strong> {isSuperAdmin ? (
                "Opção para pesquisar jurisprudência em tempo real na web (busca do Google na chave do Gemini, que pode ser tarifada e depender do plano da chave). Se a busca falhar ou vier sem fontes, o sistema avisa ao fim da análise. Mantenha desativado para economizar."
              ) : (
                "Desativada por padrão para economia de créditos. Apenas o Super Administrador possui permissão para habilitar a busca externa tarifada."
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {!isSuperAdmin && (
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                <Lock className="w-3 h-3 text-amber-600" />
                Exclusivo Super Admin
              </span>
            )}
            <button
              disabled={!isSuperAdmin}
              onClick={toggleGrounding}
              className={`self-start sm:self-auto px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border shrink-0 ${
                !isSuperAdmin
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-75"
                  : isGroundingActive 
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs cursor-pointer" 
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              }`}
              title={
                !isSuperAdmin
                  ? "Apenas o Super Admin tem autorização para habilitar a busca na web (Grounding) tarifada pelo Google."
                  : "Ativar ou desativar pesquisa ao vivo de precedentes oficiais na web quando o caso não tiver correspondência prévia"
              }
            >
              <span className={`w-2 h-2 rounded-full ${isGroundingActive ? "bg-white" : "bg-slate-400"}`} />
              <span>{isGroundingActive ? "Grounding Ativo" : "Grounding Desativado"}</span>
            </button>
          </div>
        </div>

        {/* Barra de Ações: Sincronização Semanal Automatizada + Anexar PDF no Repositório */}
        <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-slate-50/95 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão de Anexar PDF de Informativo / Súmulas (só o Super Admin alimenta a base compartilhada) */}
            {isSuperAdmin ? <label className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-2xs ${
              isUploadingPdf 
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 cursor-pointer active:scale-98"
            }`}>
              {isUploadingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              <span>{isUploadingPdf ? "Extraindo PDF..." : "Anexar PDF de Informativo / Súmula"}</span>
              <input
                type="file"
                accept=".pdf"
                disabled={isUploadingPdf}
                onChange={handleUploadPrecedentPdf}
                className="hidden"
              />
            </label> : <span className="text-[11px] text-slate-500">Base compartilhada por todos os gabinetes, mantida pelo Super Administrador.</span>}

            {/* Botão Super Admin: Sincronizar Agora */}
            {isSuperAdmin && (
              <button
                onClick={() => recarregarLista(true)}
                disabled={isSyncing}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer ${
                  isSyncing 
                    ? "bg-indigo-50 text-indigo-400 border-indigo-200 cursor-not-allowed" 
                    : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600 active:scale-98"
                }`}
                title="Recarregar a lista a partir do banco de dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Atualizando..." : "Atualizar lista"}</span>
                <span className="text-[9px] font-mono uppercase bg-indigo-700/80 px-1 py-0.2 rounded text-indigo-100">Super Admin</span>
              </button>
            )}
          </div>

          {/* Indicador de Rotina Semanal */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              <strong>Lista do banco:</strong> {lastSyncDate ? `Última em ${new Date(lastSyncDate).toLocaleDateString('pt-BR')} às ${new Date(lastSyncDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : "Automática semanal"}
            </span>
          </div>
        </div>

        {/* Notificação de Status de Importação / Sincronização */}
        {(pdfUploadStatus || syncMessage) && (
          <div className="shrink-0 px-4 sm:px-6 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{pdfUploadStatus || syncMessage}</span>
          </div>
        )}

        {/* Portais Oficiais Rápidos */}
        <div className="shrink-0 px-4 sm:px-6 py-2 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 mr-1">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              Bases Oficiais:
            </span>
            {BINDING_SOURCES.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border text-[10px] sm:text-[11px] font-medium shadow-2xs transition group ${
                  source.tribunal === "TJGO"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600"
                }`}
                title={`Acessar repositório oficial de ${source.title}`}
              >
                <span>{source.title}</span>
                <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 group-hover:text-emerald-500" />
              </a>
            ))}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="shrink-0 p-3 sm:p-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar índice (ex: Equatorial, Súmula 25, RMC, IPASGO)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pb-1 sm:pb-0 min-w-0">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 whitespace-nowrap cursor-pointer pr-1" title="Mostrar só os itens conferidos na fonte oficial">
              <input type="checkbox" checked={soConferidos} onChange={(e) => { setSoConferidos(e.target.checked); setCurrentPage(1); }} /> Só conferidos
            </label>
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0" />
            {(["ALL", "TJGO", "STF", "STJ", "TNU", "CUSTOM"] as const).map((trib) => (
              <button
                key={trib}
                onClick={() => setSelectedTribunal(trib)}
                className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedTribunal === trib
                    ? trib === "TJGO" 
                      ? "bg-emerald-600 text-white shadow-xs" 
                      : trib === "CUSTOM"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>
                  {trib === "ALL" ? "Todos os Tribunais" : trib === "TJGO" ? "TJGO (Goiás)" : trib === "CUSTOM" ? "📄 Anexados via PDF" : trib}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  selectedTribunal === trib 
                    ? "bg-white/20 text-white" 
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                }`}>
                  {counts[trib] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Precedents List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
          {filteredPrecedents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Scale className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum precedente vinculado encontrado para a busca.</p>
            </div>
          ) : (
            paginatedPrecedents.map((item) => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-emerald-500/50 transition shadow-2xs group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white dark:bg-slate-800 text-xs font-mono font-bold">
                      {item.number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      item.tribunal === "TJGO"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                        : item.tribunal === "STF" 
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : item.tribunal === "STJ"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    }`}>
                      {item.tribunal}
                    </span>
                    {conferencias[item.id] ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1" title={`Conferido na fonte oficial por ${conferencias[item.id].por} em ${new Date(conferencias[item.id].em).toLocaleDateString("pt-BR")}${conferencias[item.id].nota ? " — " + conferencias[item.id].nota : ""}`}>
                        <Check className="w-3 h-3" /> Conferido em {new Date(conferencias[item.id].em).toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300" title="Ainda não conferido na fonte oficial: confira o enunciado antes de citar.">
                        {(item as any).origem === "anexo_pdf" ? "Anexo • extraído por IA • conferir" : "Base interna • conferir na fonte"}
                      </span>
                    )}
                    {(item as any).sourceFile && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                        <FileUp className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate max-w-[150px] sm:max-w-xs" title={`Importado do arquivo: ${(item as any).sourceFile}`}>
                          PDF: {(item as any).sourceFile}
                        </span>
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 break-words">
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => handleCopy(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                      title="Copiar texto do enunciado"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copiar Ementa</span>
                        </>
                      )}
                    </button>

                    {isSuperAdmin && (
                      <button onClick={() => alternarConferencia(item)} className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50" title="Marcar que você conferiu este item na fonte oficial">
                        {conferencias[item.id] ? "Desfazer conferência" : "Marcar conferido"}
                      </button>
                    )}
                    {isSuperAdmin && ((item as any).origem === "anexo_pdf" || String(item.id).startsWith("custom-")) && (
                      <button onClick={() => excluirAnexo(item)} className="px-2.5 py-1 rounded-lg bg-white border border-red-300 text-red-700 text-xs font-medium cursor-pointer hover:bg-red-50" title="Excluir este anexo da base (vale para todos)">Excluir</button>
                    )}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      title={item.tribunal === "TJGO" ? "Abrir no portal de Jurisprudência e Informativos do TJGO" : "Abrir no site tesesesumulas.com.br"}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-serif bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80">
                  "{item.statement}"
                </p>

                <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[10px]">
                  <span className="text-slate-400 font-mono">Tags:</span>
                  {item.tags.map((tag) => (
                    <span key={tag} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                  <span className="ml-auto text-slate-400">
                    Área: <strong className="text-slate-600 dark:text-slate-300">{item.area}</strong>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        {filteredPrecedents.length > itemsPerPage && (
          <div className="px-4 sm:px-6 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs">
            <div className="text-slate-500 text-[11px] sm:text-xs">
              Mostrando <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * itemsPerPage, filteredPrecedents.length)}</span> de <span className="font-bold text-slate-700 dark:text-slate-300">{filteredPrecedents.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-xs text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 px-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] sm:text-xs">
              Referência: <strong>tesesesumulas.com.br</strong> e portais dos tribunais — confira sempre na fonte oficial
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold hover:opacity-90 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
