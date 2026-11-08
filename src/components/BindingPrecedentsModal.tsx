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
  const [selectedTribunal, setSelectedTribunal] = useState<"ALL" | "STF" | "STJ" | "TNU" | "TJGO" | "FONAJE" | "CUSTOM">("ALL");
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
  const itemsPerPage = 8;
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

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
      FONAJE: allCombinedPrecedents.filter(p => p.tribunal === "FONAJE").length,
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
        {/* Cabeçalho enxuto */}
        <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-900/10 via-slate-900/5 to-amber-900/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm shrink-0"><Scale className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">Súmulas, Teses e Informativos</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">STF • STJ • TNU • TJGO • FONAJE · <strong className="text-slate-700 dark:text-slate-300">{counts.ALL || 0} itens</strong> · base compartilhada por todos os gabinetes</p>
          </div>
          <span className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-300 dark:border-emerald-700 items-center gap-1.5 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />conferência manual</span>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0" title="Fechar Modal"><X className="w-5 h-5" /></button>
        </div>

        {isSuperAdmin && <FontesOficiaisPanel />}

        {/* Barra de ferramentas única: busca, filtros e ações */}
        <div className="shrink-0 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Pesquisar índice (ex: Equatorial, Súmula 25, RMC, IPASGO)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400" />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap cursor-pointer select-none" title="Mostrar só os itens conferidos na fonte oficial">
              <input type="checkbox" checked={soConferidos} onChange={(e) => { setSoConferidos(e.target.checked); setCurrentPage(1); }} className="accent-emerald-600 w-4 h-4" /> Só conferidos
            </label>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filtrar por tribunal">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {(["ALL", "TJGO", "STF", "STJ", "TNU", "FONAJE", "CUSTOM"] as const).map((trib) => (
              <button key={trib} onClick={() => setSelectedTribunal(trib)} role="tab" aria-selected={selectedTribunal === trib}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                  selectedTribunal === trib
                    ? trib === "TJGO" ? "bg-emerald-600 text-white border-emerald-600" : trib === "CUSTOM" ? "bg-amber-600 text-white border-amber-600" : "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                <span>{trib === "ALL" ? "Todos os Tribunais" : trib === "TJGO" ? "TJGO (Goiás)" : trib === "CUSTOM" ? "📄 Anexados via PDF" : trib}</span>
                <span className={`text-[10px] font-mono px-1.5 rounded-full ${selectedTribunal === trib ? "bg-white/25 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"}`}>{counts[trib] || 0}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin ? (
              <>
                <label className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${isUploadingPdf ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 cursor-pointer active:scale-98"}`}>
                  {isUploadingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                  <span>{isUploadingPdf ? "Extraindo PDF..." : "Anexar PDF de Informativo / Súmula"}</span>
                  <input type="file" accept=".pdf" disabled={isUploadingPdf} onChange={handleUploadPrecedentPdf} className="hidden" />
                </label>
                <button onClick={() => recarregarLista(true)} disabled={isSyncing} title="Atualizar lista"
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${isSyncing ? "bg-indigo-50 text-indigo-400 border-indigo-200 cursor-not-allowed" : "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700"}`}>
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} /><span>{isSyncing ? "Atualizando..." : "Atualizar lista"}</span>
                </button>
              </>
            ) : <span className="text-[11px] text-slate-500">Base mantida pelo Super Administrador.</span>}
            <span className="flex-1" />
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400" title="A lista é lida do banco de dados"><Clock className="w-3.5 h-3.5" />{lastSyncDate ? `Atualizada em ${new Date(lastSyncDate).toLocaleDateString("pt-BR")} às ${new Date(lastSyncDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Lista do banco"}</span>
            <button disabled={!isSuperAdmin} onClick={toggleGrounding} role="switch" aria-checked={isGroundingActive}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition border ${!isSuperAdmin ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-75" : isGroundingActive ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 cursor-pointer" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"}`}
              title={!isSuperAdmin ? "Apenas o Super Admin tem autorização para habilitar a busca na web (Grounding) tarifada pelo Google." : "Ativar ou desativar a pesquisa ao vivo de precedentes oficiais na web (busca do Google na chave do Gemini, pode ser tarifada)"}>
              {!isSuperAdmin ? <Lock className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isGroundingActive ? "Grounding Ativo" : "Grounding Desativado"}</span>
              <span className={`w-8 h-4 rounded-full relative transition ${isGroundingActive ? "bg-white/30" : "bg-slate-300 dark:bg-slate-600"}`}><span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isGroundingActive ? "left-4.5" : "left-0.5"}`} /></span>
            </button>
          </div>

          {(pdfUploadStatus || syncMessage) && (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>{pdfUploadStatus || syncMessage}</span></div>
          )}

          <details className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />Como funciona, Grounding e bases oficiais<ChevronRight className="w-3.5 h-3.5 ml-auto transition group-open:rotate-90" /></summary>
            <div className="px-3 pb-3 space-y-2.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="flex gap-2"><Cpu className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><strong>Aplicação automática:</strong> o backend cruza os fatos dos autos com os itens desta lista (incluindo os anexados), indicando à IA a situação de cada um (conferido ou não) e proibindo-a de inventar numeração. Aplica as súmulas e teses cabíveis diretamente na minuta, com custo zero de busca externa. Os marcados como “Conferido” foram verificados na fonte oficial pelo Super Administrador; os demais devem ser conferidos antes de citar.</span></p>
              <p className="flex gap-2"><Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" /><span><strong>Pesquisa Web ao Vivo (Grounding):</strong> {isSuperAdmin ? "pesquisa jurisprudência em tempo real na web (busca do Google na chave do Gemini, que pode ser tarifada e depender do plano da chave). Roda na 1ª etapa e o resultado é reaproveitado na 2ª. A minuta mostra um selo “Pesquisa ao vivo” com as fontes; se a busca falhar, o sistema avisa. Mantenha desativado para economizar." : "desativada por padrão para economia de créditos. Apenas o Super Administrador pode habilitar a busca externa tarifada."}</span></p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mr-1"><Globe className="w-3.5 h-3.5 text-emerald-500" />Bases oficiais:</span>
                {BINDING_SOURCES.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" title={`Acessar repositório oficial de ${source.title}`}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition group/l ${source.tribunal === "TJGO" ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600"}`}>
                    <span>{source.title}</span><ExternalLink className="w-3 h-3 text-slate-400 group-hover/l:text-emerald-500" />
                  </a>
                ))}
              </div>
            </div>
          </details>
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-[220px] overflow-y-auto px-4 sm:px-6 py-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
          {filteredPrecedents.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><Scale className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Nenhum precedente vinculado encontrado para a busca.</p></div>
          ) : (
            paginatedPrecedents.map((item) => {
              const aberto = expandidos.has(item.id), longo = item.statement.length > 280, c = conferencias[item.id];
              const extra = (item as any).origem === "anexo_pdf" || String(item.id).startsWith("custom-");
              return (
                <article key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-emerald-500/50 transition shadow-2xs">
                  <div className="flex items-start gap-3 p-3 sm:p-4 pb-2">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white dark:bg-slate-700 text-xs font-mono font-bold">{item.number}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${item.tribunal === "TJGO" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700" : item.tribunal === "STF" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" : item.tribunal === "STJ" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"}`}>{item.tribunal}</span>
                        {c ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1" title={`Conferido na fonte oficial por ${c.por}${c.nota ? ` — ${c.nota}` : ""}`}><Check className="w-3 h-3" /> Conferido em {new Date(c.em).toLocaleDateString("pt-BR")}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300" title="Ainda não conferido na fonte oficial: confira o enunciado antes de citar">{(item as any).origem === "anexo_pdf" ? "Anexo • extraído por IA • conferir" : "Base interna • conferir na fonte"}</span>
                        )}
                        {(item as any).sourceFile && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 min-w-0"><FileUp className="w-3 h-3 shrink-0" /><span className="truncate max-w-[160px] sm:max-w-xs" title={`Importado do arquivo: ${(item as any).sourceFile}`}>PDF: {(item as any).sourceFile}</span></span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words leading-snug">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleCopy(item)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer" title="Copiar texto do enunciado">
                        {copiedId === item.id ? (<><Check className="w-3.5 h-3.5 text-emerald-500" /><span className="hidden sm:inline text-emerald-600 dark:text-emerald-400 font-bold">Copiado</span></>) : (<><Copy className="w-3.5 h-3.5 text-slate-400" /><span className="hidden sm:inline">Copiar Ementa</span></>)}
                      </button>
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition" title={item.tribunal === "TJGO" ? "Abrir no portal de Jurisprudência e Informativos do TJGO" : "Abrir no site tesesesumulas.com.br"}><ExternalLink className="w-4 h-4" /></a>
                    </div>
                  </div>

                  <div className="px-3 sm:px-4">
                    <p className={`text-[13px] sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-serif bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 ${aberto ? "" : "line-clamp-4"}`}>"{item.statement}"</p>
                    {longo && <button onClick={() => setExpandidos((e) => { const n = new Set(e); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })} className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">{aberto ? "Ver menos" : "Ver texto completo"}</button>}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap px-3 sm:px-4 py-2.5 text-[10px]">
                    {item.tags.slice(0, 6).map((tag) => <span key={tag} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">#{tag}</span>)}
                    {item.tags.length > 6 && <span className="text-slate-400" title={item.tags.slice(6).join(", ")}>+{item.tags.length - 6}</span>}
                    <span className="ml-auto text-slate-400">Área: <strong className="text-slate-600 dark:text-slate-300">{item.area}</strong></span>
                    {isSuperAdmin && (
                      <span className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                        <button onClick={() => alternarConferencia(item)} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700" title={c ? "Remover a marca de conferido" : "Marcar como conferido na fonte oficial"}>{c ? "Desfazer conferência" : "Marcar conferido"}</button>
                        {extra && <button onClick={() => excluirAnexo(item)} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-red-300 text-red-700 text-xs font-medium cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40" title="Excluir este item da base (vale para todos)">Excluir</button>}
                      </span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Rodapé único: contagem, páginas e fechar */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-500 text-[11px] sm:text-xs min-w-0">
            Mostrando <span className="font-bold text-slate-700 dark:text-slate-300">{filteredPrecedents.length ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> a <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * itemsPerPage, filteredPrecedents.length)}</span> de <span className="font-bold text-slate-700 dark:text-slate-300">{filteredPrecedents.length}</span>
            <span className="hidden md:inline text-slate-400"> · confira sempre na fonte oficial (tesesesumulas.com.br e portais dos tribunais)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer" title="Página Anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 font-bold text-xs text-slate-700 dark:text-slate-300">{currentPage} / {totalPages}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer" title="Próxima Página"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={onClose} className="ml-2 px-4 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold hover:opacity-90 transition cursor-pointer">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
