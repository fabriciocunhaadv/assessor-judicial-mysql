import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  Upload, 
  FileText, 
  Video, 
  Play, 
  Zap, 
  Check, 
  FileCheck, 
  FileSignature, 
  ChevronRight, 
  Save, 
  Copy, 
  Printer, 
  ArrowLeft, 
  Gavel, 
  Edit3, 
  Eye, 
  Download, 
  CheckCircle2, 
  Sparkles,
  Info,
  CheckCheck,
  AlertTriangle
} from 'lucide-react';
import { getLocalCachedPrompts, syncPromptsWithDb } from '../utils/promptsDb';
import { subscribeToPrompts } from '../lib/firestoreUtils';
import { saveToHistory } from '../utils/historyDb';
import { CustomPrompt, SavedAnalysis } from '../types';
import toast from 'react-hot-toast';
import { getCustomApiKey, getApiHeaders } from '../utils/apiKeyManager';
import { lerAutosPdf, ExtensaoNecessaria } from '../utils/lerAutosPdf';
import { AvisoInstalarExtensao } from './AvisoInstalarExtensao';
import { caminhoAtual } from '../utils/pdfViaExtensao';
import { enviarMidiaEmPartes } from '../utils/enviarMidia';
import { executarSentencaComVideo } from '../utils/sentencaComVideo';
import { assinaturaDosVideos, degravacaoGuardada, guardarDegravacao } from '../utils/degravacaoGuardada';
import { entradasExternas } from '../utils/entradaExterna';
import { enxugarResultado } from '../utils/sentencaComVideo';
import { resolverUnidade } from '../utils/minutaExterna';
import { organizarMinutaExterna } from '../utils/organizarMinutaExterna';
import { fetchRecuperavel } from '../utils/fetchRecuperavel';
import { consultarResultado, lerCorpo } from '../utils/analisePendente';
import { useSessao, sessaoMutirao } from '../utils/mutiraoSessao';
import { guardarUploadPendente, apagarUploadPendente, lerUploadPendente } from '../utils/uploadsPendentes';
import { getKnowledgeDocs } from '../utils/knowledgeDb';
import { getCabinetTeses } from '../utils/tesesDb';

interface MutiraoPrevidenciarioViewProps {
  onOpenHistory?: () => void;
}

/**
 * Função utilitária para limpar e desescapar qualquer string proveniente do modelo ou JSON.
 * Converte literais como "\n", "\r\n" em quebras reais de linha e remove aspas excedentes.
 */
export function cleanSentenceText(text: string): string {
  if (!text) return "";
  let clean = String(text);
  clean = clean.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "    ");
  clean = clean.replace(/^"|"$/g, "");
  return clean.trim();
}

/**
 * Componente para renderizar a sentença em formato de folha forense elegante
 * com recuo de parágrafos, tipografia serifada e destaque dos títulos judiciais.
 */
const ForenseSentenceDocument: React.FC<{ 
  text: string; 
  processInfo: { processNumber: string; author: string; defendant: string };
  title: string;
}> = ({ text, processInfo, title }) => {
  const clean = useMemo(() => cleanSentenceText(text), [text]);

  const blocks = useMemo(() => {
    if (!clean) return [];
    // Divide por quebras de linha duplas ou únicas preservando parágrafos
    const rawParagraphs = clean.split(/\n+/);
    return rawParagraphs.map(p => p.trim()).filter(Boolean);
  }, [clean]);

  const isHeading = (line: string): boolean => {
    const l = line.toUpperCase();
    return (
      l.startsWith("I -") ||
      l.startsWith("II -") ||
      l.startsWith("III -") ||
      l.startsWith("IV -") ||
      l.startsWith("V -") ||
      l.startsWith("1.") ||
      l.startsWith("2.") ||
      l.startsWith("3.") ||
      l === "RELATÓRIO" ||
      l === "FUNDAMENTAÇÃO" ||
      l === "DISPOSITIVO" ||
      l === "É O RELATÓRIO." ||
      l === "É O RELATÓRIO. DECIDO." ||
      l.startsWith("É O RELATÓRIO") ||
      l.startsWith("VISTOS") ||
      l.startsWith("PUBLIQUE-SE")
    );
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md p-6 sm:p-10 text-slate-900 dark:text-slate-100 font-serif leading-relaxed select-text overflow-y-auto max-h-full">
      {/* Cabeçalho Oficial do Tribunal */}
      <div className="text-center pb-6 mb-6 border-b border-slate-200 dark:border-slate-800 space-y-1 font-sans">
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">Poder Judiciário do Estado</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase">{title || "Sentença de Instrução e Julgamento"}</p>
        {processInfo.processNumber && (
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">Autos nº {processInfo.processNumber}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs text-slate-600 dark:text-slate-400">
          {processInfo.author && (
            <span><strong className="text-slate-700 dark:text-slate-300">Parte Autora:</strong> {processInfo.author}</span>
          )}
          {processInfo.defendant && (
            <span><strong className="text-slate-700 dark:text-slate-300">Parte Ré:</strong> {processInfo.defendant}</span>
          )}
        </div>
      </div>

      {/* Corpo da Sentença Formatado */}
      <div className="space-y-4 text-sm sm:text-base text-justify">
        {blocks.map((block, idx) => {
          if (isHeading(block)) {
            return (
              <div 
                key={idx} 
                className="font-bold text-slate-900 dark:text-amber-400 pt-3 pb-1 tracking-wide uppercase font-sans text-xs sm:text-sm border-b border-slate-100 dark:border-slate-800/80"
              >
                {block}
              </div>
            );
          }
          return (
            <p 
              key={idx} 
              className="indent-8 sm:indent-10 leading-[1.75] text-slate-800 dark:text-slate-200"
            >
              {block}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export const MutiraoPrevidenciarioView: React.FC<MutiraoPrevidenciarioViewProps> = ({ onOpenHistory }) => {
  const { user, userProfile } = useAuth();
  const uidPend = String((user as any)?.uid || (user as any)?.email || '');
  const [step, setStep] = useSessao<'upload' | 'ata' | 'sentence'>('step');
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useSessao<string>('selectedPromptId');
  const [isSaving, setIsSaving] = useState(false);
  const [ataMobileTab, setAtaMobileTab] = useSessao<'media' | 'ata'>('ataMobileTab');
  const [sentenceMobileTab, setSentenceMobileTab] = useSessao<'sentence' | 'transcription'>('sentenceMobileTab');
  const [viewMode, setViewMode] = useState<'formatted' | 'editor'>('formatted');

  useEffect(() => {
    const cached = getLocalCachedPrompts().filter(p => p.id !== "prompt-padrao" && p.title !== "Prompt Padrão");
    setPrompts(cached);
  }, []);
  // volta de onde parou (troca de aba, janela fechada ou página recarregada)
  useEffect(() => { void sessaoMutirao.carregar(String(user?.uid || user?.email || '')).then((aviso) => { if (aviso) toast.success(aviso, { duration: 6000 }); }); }, [user?.uid, user?.email]);
  // análise da sentença que estava rodando no servidor quando a página recarregou: busca o resultado guardado e aplica (sem refazer, sem gastar a cota de novo)
  useEffect(() => {
    if (!uidPend || (globalThis as any).__mutiraoResultado === uidPend) return;
    (globalThis as any).__mutiraoResultado = uidPend;
    let vivo = true;
    void sessaoMutirao.carregar(uidPend).then(async () => {
      const id = String(sessaoMutirao.ler('progIdSentenca') || '');
      if (!id || sessaoMutirao.ler('isProcessingVideo')) return;
      setIsProcessingVideo(true); setProgressoMidia('Recuperando a sentença que estava sendo gerada…');
      try {
        const limite = Date.now() + 25 * 60_000;
        while (vivo && Date.now() < limite) {
          const r = await consultarResultado(id).catch(() => null);
          if (r?.pronto) { const res = lerCorpo(r.body || ''); sessaoMutirao.definir('progIdSentenca', ''); aplicarRef.current(res); toast.success('Sentença recuperada: a análise terminou enquanto a página era atualizada.'); return; }
          if (r?.andamento?.texto) setProgressoMidia(`${r.andamento.texto} (recuperada após atualizar a página)`);
          if (r?.desconhecido) { sessaoMutirao.definir('progIdSentenca', ''); toast.error('A geração da sentença foi interrompida pela atualização do servidor. Clique em “Analisar Mídia e Gerar Sentença” de novo (a mídia continua anexada).', { duration: 12000 }); return; }
          await new Promise((ok) => setTimeout(ok, 4000));
        }
      } catch (e: any) { toast.error(e?.message || 'Não consegui recuperar a sentença.'); }
      finally { setProgressoMidia(''); setIsProcessingVideo(false); }
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidPend]);
  // leitura de PDF interrompida por recarga da página: retoma sozinha (uma vez por carregamento)
  useEffect(() => {
    if (!uidPend || (globalThis as any).__mutiraoRetomado === uidPend) return;
    (globalThis as any).__mutiraoRetomado = uidPend;
    void sessaoMutirao.carregar(uidPend).then(() => lerUploadPendente('mutirao', uidPend)).then((p) => {
      if (!p || !p.arquivos.length || sessaoMutirao.ler('isProcessingPdf')) return;
      toast(`Retomando a leitura de "${p.arquivos[0].name}", interrompida pela atualização da página…`, { icon: '🔄', duration: 6000 });
      void processarPdf(p.arquivos[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidPend]);

  const [isProcessingPdf, setIsProcessingPdf] = useSessao<boolean>('isProcessingPdf');
  const [isProcessingVideo, setIsProcessingVideo] = useSessao<boolean>('isProcessingVideo');
  
  const [processInfo, setProcessInfo] = useSessao<{ processNumber: string; author: string; defendant: string }>('processInfo');
  const [ataText, setAtaText] = useSessao<string>('ataText');
  const [sentenceText, setSentenceText] = useSessao<string>('sentenceText');
  const [transcription, setTranscription] = useSessao<string>('transcription');
  const [videoFiles, setVideoFiles] = useSessao<File[]>('videoFiles');      // às vezes há um vídeo por testemunha: aceita vários
  const [modoMidia, setModoMidia] = useSessao<'video' | 'texto'>('modoMidia');      // enviar o vídeo/áudio OU colar a transcrição da audiência já pronta
  const [transcricaoColada, setTranscricaoColada] = useSessao<string>('transcricaoColada');
  const [pdfFullText, setPdfFullText] = useSessao<string>('pdfFullText');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const selectedPrompt = useMemo(() => {
    return prompts.find(p => p.id === selectedPromptId);
  }, [prompts, selectedPromptId]);

  const activeTitle = selectedPrompt?.title || "Sentença de Instrução e Julgamento";

  const handleCopyAta = () => {
    if (!ataText) {
      toast.error("Nenhum texto na ata para copiar.");
      return;
    }
    const clean = cleanSentenceText(ataText);
    navigator.clipboard.writeText(clean);
    toast.success("Ata copiada para a área de transferência!");
  };

  const handlePrintAta = () => {
    if (!ataText) return;
    const clean = cleanSentenceText(ataText);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Termo de Audiência - ${processInfo.processNumber || 'Processo'}</title>
            <style>
              body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; padding: 2.5cm; color: #000; text-align: justify; }
              p { text-indent: 2.5cm; margin-bottom: 12pt; }
              .header { text-align: center; margin-bottom: 24pt; font-family: Arial, sans-serif; font-size: 11pt; }
            </style>
          </head>
          <body>
            <div class="header">
              <strong>PODER JUDICIÁRIO</strong><br/>
              TERMO DE AUDIÊNCIA DE INSTRUÇÃO E JULGAMENTO<br/>
              ${processInfo.processNumber ? `Autos nº: ${processInfo.processNumber}` : ''}
            </div>
            ${clean.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')}
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const handleCopySentence = () => {
    if (!sentenceText) return;
    const clean = cleanSentenceText(sentenceText);
    navigator.clipboard.writeText(clean);
    toast.success("Sentença copiada para a área de transferência!");
  };

  const handleCopyFormattedHtml = () => {
    if (!sentenceText) return;
    const clean = cleanSentenceText(sentenceText);
    const paragraphs = clean.split(/\n\s*\n/).map(p => {
      const isTitle = p.toUpperCase().startsWith("I -") || p.toUpperCase().startsWith("II -") || p.toUpperCase().startsWith("III -") || p.toUpperCase().includes("RELATÓRIO") || p.toUpperCase().includes("DISPOSITIVO");
      if (isTitle) {
        return `<p style="font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; font-family: 'Times New Roman', serif; font-size: 12pt; text-transform: uppercase;">${p}</p>`;
      }
      return `<p style="text-indent: 2.5cm; text-align: justify; margin-bottom: 12pt; line-height: 1.5; font-family: 'Times New Roman', serif; font-size: 12pt;">${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('');

    if (navigator.clipboard && window.ClipboardItem) {
      const blob = new Blob([paragraphs], { type: 'text/html' });
      const textBlob = new Blob([clean], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob
      });
      navigator.clipboard.write([item]).then(() => {
        toast.success("Texto formatado copiado! Cole diretamente no PROJUDI ou Word com recuos perfeitos.");
      }).catch(() => {
        navigator.clipboard.writeText(clean);
        toast.success("Sentença copiada para a área de transferência!");
      });
    } else {
      navigator.clipboard.writeText(clean);
      toast.success("Sentença copiada para a área de transferência!");
    }
  };

  const handlePrintSentence = () => {
    if (!sentenceText) return;
    const clean = cleanSentenceText(sentenceText);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${activeTitle} - ${processInfo.processNumber || 'Autos'}</title>
            <style>
              @page { margin: 2.5cm; }
              body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #000; text-align: justify; }
              .header { text-align: center; margin-bottom: 24pt; font-family: Arial, sans-serif; font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 12pt; }
              .title { font-size: 13pt; font-weight: bold; margin-top: 6pt; text-transform: uppercase; }
              .heading { font-weight: bold; text-transform: uppercase; margin-top: 16pt; margin-bottom: 6pt; font-family: Arial, sans-serif; font-size: 11pt; }
              p { text-indent: 2.5cm; margin-bottom: 12pt; margin-top: 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <strong>PODER JUDICIÁRIO DO ESTADO</strong><br/>
              <div class="title">${activeTitle}</div>
              ${processInfo.processNumber ? `Autos nº ${processInfo.processNumber}<br/>` : ''}
              ${processInfo.author ? `Parte Autora: ${processInfo.author} | ` : ''}
              ${processInfo.defendant ? `Parte Ré: ${processInfo.defendant}` : ''}
            </div>
            ${clean.split(/\n+/).map(p => {
              const l = p.trim();
              if (!l) return '';
              const isH = l.toUpperCase().startsWith("I -") || l.toUpperCase().startsWith("II -") || l.toUpperCase().startsWith("III -") || l.toUpperCase() === "RELATÓRIO" || l.toUpperCase() === "FUNDAMENTAÇÃO" || l.toUpperCase() === "DISPOSITIVO";
              if (isH) return `<div class="heading">${l}</div>`;
              return `<p>${l}</p>`;
            }).join('')}
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const [bloqueioExt, setBloqueioExt] = useSessao<{ tipo: 'instalar' | 'atualizar'; arquivo: File; aindaNao?: boolean } | null>('bloqueioExt');
  const [progressoPdf, setProgressoPdf] = useSessao<string>('progressoPdf');
  const [progressoMidia, setProgressoMidia] = useSessao<string>('progressoMidia');
  const [sentencasDaSessao, setSentencasDaSessao] = useSessao<number>('sentencasDaSessao');
  /** Pauta com várias audiências: guarda a que acabou (já foi salva no Histórico) e volta ao começo, mantendo o prompt escolhido */
  const proximoProcesso = () => {
    setProcessInfo({ processNumber: '', author: '', defendant: '' }); setAtaText(''); setSentenceText(''); setTranscription(''); setVideoFiles([]); setTranscricaoColada(''); setPdfFullText('');
    setStep('upload'); setSentenceMobileTab('sentence');
  };
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      e.target.value = '';
      await processarPdf(f);
    }
  };
  const processarPdf = async (file: File) => {
    {
      setIsProcessingPdf(true);
      setProgressoPdf('');
      void guardarUploadPendente('mutirao', uidPend, [file]);      // se a página recarregar no meio (atualização de versão), a leitura é retomada sozinha
      
      try {
        let pdfText = "";
        
        // 1. Tentar extrair o texto diretamente no navegador (ultra-rápido, sem limites de upload)
        try {
          // igual ao upload principal: com a extensão ela faz o OCR das páginas de imagem e devolve o texto; sem ela (computador) bloqueia e mostra o link
          const clientExtract = await lerAutosPdf(file, (etapa, feitas, total) => setProgressoPdf(total ? `${etapa}: ${feitas}/${total}` : etapa));
          if (clientExtract && clientExtract.hasText && clientExtract.text.trim()) {
            pdfText = clientExtract.text;
            console.log(`[Mutirão] Texto extraído: ${pdfText.length} caracteres.`);
            const sem = clientExtract.paginasSemTexto || [];
            if (sem.length) toast(`⚠ ${sem.length} página(s) de imagem ficaram sem texto reconhecido (pág. ${sem.slice(0, 12).join(', ')}${sem.length > 12 ? '…' : ''}). Confira no PDF.`, { duration: 12000 });
          }
        } catch (clientErr: any) {
          if (clientErr instanceof ExtensaoNecessaria) { setBloqueioExt({ tipo: clientErr.tipo, arquivo: file }); setIsProcessingPdf(false); return; }
          console.warn("[Mutirão] Falha ao extrair texto no cliente. Tentando via servidor...", clientErr);
        }

        // Se o cliente não extraiu texto, fazer fallback para o endpoint do servidor
        if (!pdfText) {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result as string;
              resolve(result.includes(',') ? result.split(',')[1] : result);
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });

          const customKey = getCustomApiKey();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("ai_studio_api_key") || ""}`,
            ...(customKey ? { 'x-gemini-api-key': customKey } : {})
          };

          const extractRes = await fetch('/api/extract-pdf-text', {
            method: 'POST',
            headers,
            body: JSON.stringify({ base64: base64Data, fileName: file.name })
          });
          
          if (!extractRes.ok) throw new Error("Erro ao extrair texto do PDF");
          const extractData = await extractRes.json();
          pdfText = extractData.text;
        }

        setPdfFullText(pdfText);
        if (!pdfText) throw new Error("Nenhum texto legível foi encontrado no PDF.");

        // 2. Extrair informações dos autos e gerar Ata com modelo generalista
        const customKey = getCustomApiKey();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("ai_studio_api_key") || ""}`,
          ...(customKey ? { 'x-gemini-api-key': customKey } : {})
        };

        let activeKnowledgeDocs: any[] = [];
        try {
          activeKnowledgeDocs = (await getKnowledgeDocs()).filter(d => d.isActive);
        } catch {}
        let activeTesesText = "";
        try {
          const teses = await getCabinetTeses();
          if (teses.isEnabled) activeTesesText = teses.text || "";
        } catch {}

        const ataRes = await fetch('/api/mutirao-extract-ata', {
          method: 'POST',
          headers: getApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ pdfText, cabinetTesesText: activeTesesText, knowledgePdfs: activeKnowledgeDocs })
        });

        if (!ataRes.ok) throw new Error("Erro ao gerar ata");
        const ataData = await ataRes.json();
        
        if (ataData.success && ataData.data) {
          setProcessInfo({
            processNumber: ataData.data.processNumber || '',
            author: ataData.data.author || 'Parte Autora',
            defendant: ataData.data.defendant || 'Parte Ré'
          });
          setAtaText(cleanSentenceText(ataData.data.ataText || ''));
          setStep('ata');
          toast.success("Peças lidas com sucesso! Ata prévia montada.");
        } else {
          throw new Error("Erro no retorno da IA.");
        }
      } catch (err: any) {
        toast.error(err.message || "Falha ao processar o PDF.");
      } finally {
        setIsProcessingPdf(false);
        void apagarUploadPendente('mutirao', uidPend);
      }
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!novos.length) return;
    setVideoFiles((atuais) => {
      const sem = novos.filter((f) => !atuais.some((a) => a.name === f.name && a.size === f.size));      // o mesmo arquivo não entra duas vezes
      return [...atuais, ...sem].slice(0, 12);
    });
    setAtaMobileTab('media');
    toast.success(novos.length > 1 ? `${novos.length} mídias anexadas` : "Mídia anexada: " + novos[0].name);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanSentence = cleanSentenceText(sentenceText);
      const cleanRelatorio = cleanSentenceText(transcription);

      const analysis: SavedAnalysis = {
        id: crypto.randomUUID(),
        promptTitle: activeTitle,
        promptId: selectedPromptId || 'sentenca_audiencia_geral',
        date: Date.now(),
        processNumber: processInfo.processNumber || 'Processo s/ nº',
        processTextContext: "Mutirão Expresso: Análise de PDF e Mídia de Audiência.",
        result: {
          minute: {
            title: activeTitle,
            header: "PODER JUDICIÁRIO",
            processNumber: processInfo.processNumber || 'Processo s/ nº',
            parties: { 
              author: processInfo.author || 'Parte Autora', 
              defendant: processInfo.defendant || 'Parte Ré' 
            },
            relatorio: cleanRelatorio || 'Audiência de instrução e julgamento realizada.',
            fundamentacao: "Análise probatória conforme termo e depoimentos orais colhidos na audiência.",
            dispositivo: cleanSentence,
            fullFormattedText: cleanSentence
          },
          auditAnalysis: {} as any
        }
      };

      await saveToHistory(analysis);
      toast.success("Sentença salva no histórico com sucesso!");
    } catch (e) {
      toast.error("Erro ao salvar no histórico.");
    } finally {
      setIsSaving(false);
    }
  };

  /** Aplica o resultado da análise (sentença + degravação) na tela e salva no Histórico. Usada na resposta normal e quando o resultado é recuperado depois de uma recarga. */
  const aplicarResultadoSentenca = (result: any) => {
    if (result?.success && result.data) {
      const genTranscription = cleanSentenceText(result.data.transcription || 'Sem transcrição disponível.');
      const genSentence = cleanSentenceText(result.data.sentenceText || 'Erro ao gerar texto da sentença.');

      setTranscription(genTranscription);
      setSentenceText(genSentence);
      setStep('sentence');
      setSentenceMobileTab('sentence');
      setViewMode('formatted'); // Exibir no modo forense por padrão

      // Auto-salvamento no histórico: a minuta é SÓ a sentença (a degravação é prova e não entra na minuta); vem do motor principal quando disponível
      const ctxE = entradasExternas.contexto(); const un = resolverUnidade('', ctxE?.unidades || [], ctxE?.ativa);
      const origemVideo = { videos: modoMidia === 'texto' ? ['transcrição colada'] : videoFiles.map((f) => f.name), degravacaoChars: genTranscription.length, em: Date.now() };
      let resultado: any;
      if (result.resultado?.minute) resultado = { ...enxugarResultado(result.resultado), minute: { ...result.resultado.minute, judicialUnit: result.resultado.minute.judicialUnit || un.name }, origemVideo };
      else {
        const org = organizarMinutaExterna(genSentence, '');
        resultado = { minute: { title: org.titulo || activeTitle, header: `${un.name || 'PODER JUDICIÁRIO'}\nPROCESSO Nº ${processInfo.processNumber || ''}`, processNumber: processInfo.processNumber || 'Processo s/ nº', judicialUnit: un.name, parties: { author: org.autor || processInfo.author || 'Parte Autora', defendant: org.reu || processInfo.defendant || 'Parte Ré' }, relatorio: org.relatorio || '', fundamentacao: org.fundamentacao || '', dispositivo: org.dispositivo || '', closing: org.closing || 'Documento assinado digitalmente.', fullFormattedText: genSentence }, auditAnalysis: {} as any, origemVideo };
      }
      const autoSaveAnalysis: SavedAnalysis = {
        id: crypto.randomUUID(), unitId: un.id,
        promptTitle: activeTitle,
        promptId: selectedPromptId || 'sentenca_audiencia_geral',
        date: Date.now(),
        processNumber: processInfo.processNumber || "Processo s/ nº",
        processTextContext: "[Sentença feita com o vídeo da audiência (Mutirão Expresso); a degravação foi usada como prova oral e não faz parte da minuta]",
        result: resultado,
      } as any;

      saveToHistory(autoSaveAnalysis).catch(console.error);
      setSentencasDaSessao((n) => n + 1);
      toast.success("Sentença de audiência gerada com sucesso!");
    } else {
      throw new Error("Erro ao gerar sentença a partir da mídia.");
    }
  };
  const aplicarRef = useRef(aplicarResultadoSentenca); aplicarRef.current = aplicarResultadoSentenca;

  const MIN_TRANSCRICAO = 200;
  const textoColado = (transcricaoColada || '').trim();
  const handleGenerateSentence = async () => {
    const porTexto = modoMidia === 'texto';
    if (porTexto ? textoColado.length < MIN_TRANSCRICAO : !videoFiles.length) {
      toast.error(porTexto ? `Cole a transcrição da audiência (pelo menos ${MIN_TRANSCRICAO} caracteres).` : "Selecione um arquivo de vídeo ou áudio da audiência.");
      return;
    }

    if (!selectedPrompt) {
      toast.error("Por favor, selecione um prompt cadastrado no sistema para redigir a sentença.");
      return;
    }

    setIsProcessingVideo(true);
    try {
      // MESMO caminho de código da sentença com vídeo pela extensão (executarSentencaComVideo): mesma ata, mesmas teses/base, mesmo motor principal, mesmo Histórico.
      const assinVideos = porTexto ? '' : assinaturaDosVideos(videoFiles), degrPronta = porTexto ? textoColado : degravacaoGuardada(assinVideos);
      if (degrPronta && !porTexto) toast('Estes vídeos já foram ouvidos: reaproveitando a degravação (não serão enviados de novo).', { duration: 6000 });
      const ctxE = entradasExternas.contexto(); const un = resolverUnidade('', ctxE?.unidades || [], ctxE?.ativa);
      setProgressoMidia('Preparando a sentença…');
      const r = await executarSentencaComVideo({
        reqId: `mutirao-${Date.now()}`, processo: processInfo.processNumber || '', promptTitulo: selectedPrompt?.title || '', promptTexto: selectedPrompt?.promptText || '',
        promptCategoria: (selectedPrompt as any)?.category || (selectedPrompt as any)?.categoria || '', serventia: un.name || '', degravacaoPronta: degrPronta || undefined,
        textoAutos: pdfFullText, ataPronta: { ataText, processNumber: processInfo.processNumber, author: processInfo.author, defendant: processInfo.defendant }, videos: porTexto ? [] : videoFiles, origemTexto: porTexto,
        aoIniciarAnalise: (progId) => sessaoMutirao.definir('progIdSentenca', progId),      // se a página recarregar durante a análise, o resultado guardado no servidor é buscado ao voltar
      }, (texto) => setProgressoMidia(texto));
      if (!porTexto) guardarDegravacao(assinVideos, r.transcricao || '');      // a degravação fica guardada mesmo se a sentença falhar
      if (!r.ok) throw new Error((r as any).erro || 'Erro ao processar mídia');
      setTranscription(r.transcricao || 'Sem transcrição disponível.'); setSentenceText(r.minuta);
      setStep('sentence'); setSentenceMobileTab('sentence'); setViewMode('formatted');
      setSentencasDaSessao((n) => n + 1);
      if (r.aviso) toast.error(r.aviso, { duration: 12000 }); else toast.success('Sentença de audiência gerada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || "Falha ao processar vídeo/áudio.");
    } finally {
      sessaoMutirao.definir('progIdSentenca', '');
      setProgressoMidia('');
      setIsProcessingVideo(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Barra de Passos */}
      <div className="px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold overflow-x-auto py-1 max-w-full">
          <button 
            onClick={() => setStep('upload')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full flex items-center gap-1 sm:gap-1.5 whitespace-nowrap transition ${
              step === 'upload' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer'
            }`}
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">1. PDF dos Autos</span>
            <span className="xs:hidden">1. Autos</span>
          </button>
          
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          
          <button 
            onClick={() => ataText && setStep('ata')}
            disabled={!ataText}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full flex items-center gap-1 sm:gap-1.5 whitespace-nowrap transition ${
              step === 'ata' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : ataText 
                ? 'bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer' 
                : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">2. Termo & Mídia</span>
            <span className="xs:hidden">2. Mídia</span>
          </button>
          
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          
          <button 
            onClick={() => sentenceText && setStep('sentence')}
            disabled={!sentenceText}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full flex items-center gap-1 sm:gap-1.5 whitespace-nowrap transition ${
              step === 'sentence' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : sentenceText 
                ? 'bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer' 
                : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Gavel className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">3. Sentença Pronta</span>
            <span className="xs:hidden">3. Sentença</span>
          </button>
        </div>

        <button 
          onClick={() => onOpenHistory && onOpenHistory()}
          className="text-xs bg-orange-600 hover:bg-orange-500 px-3 py-1.5 rounded-lg font-bold text-white flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-sm active:scale-95 self-end sm:self-auto"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Abrir Histórico</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 flex flex-col">
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full py-4">
            <div className="text-center mb-5 sm:mb-6 space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Mesa de Instrução & Julgamento Expresso
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">Mutirão Expresso de Audiências</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Solte o PDF da petição inicial ou ata prévia. O sistema extrai automaticamente partes, rito e pedidos para julgar qualquer matéria (Cível, Família, Partilha, Consumidor, Bancário ou Previdenciário).
              </p>
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-56 sm:h-64 border-2 border-dashed border-indigo-500/50 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/25 flex flex-col items-center justify-center transition cursor-pointer group p-4 text-center"
            >
              {isProcessingPdf ? (
                <div className="flex flex-col items-center text-indigo-400 animate-pulse">
                  <Zap className="w-10 h-10 mb-3" />
                  <span className="font-bold text-sm sm:text-base">{progressoPdf || 'Lendo peças e montando termo com IA...'}</span>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform mb-3 sm:mb-4">
                    <FileText className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <span className="font-bold text-sm sm:text-base text-indigo-300">Toque ou arraste o PDF dos Autos / Inicial</span>
                  <span className="text-xs text-indigo-400/80 mt-1">Extração direta de texto com suporte ilimitado a documentos</span>
                </>
              )}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handlePdfUpload} />
            {bloqueioExt && (
              <AvisoInstalarExtensao tipo={bloqueioExt.tipo} arquivos={[bloqueioExt.arquivo.name]} aindaNao={bloqueioExt.aindaNao} aoFechar={() => setBloqueioExt(null)}
                aoTentar={async () => { const c = await caminhoAtual(800); if (c === 'extensao') { const f = bloqueioExt.arquivo; setBloqueioExt(null); await processarPdf(f); } else setBloqueioExt({ ...bloqueioExt, aindaNao: true }); }} />
            )}
          </div>
        )}

        {step === 'ata' && (
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
                <span className="text-slate-400">Processo: <strong className="text-white font-mono">{processInfo.processNumber || 'S/N'}</strong></span>
                <span className="text-slate-400">Autor: <strong className="text-white">{processInfo.author}</strong></span>
                <span className="text-slate-400">Réu: <strong className="text-white">{processInfo.defendant}</strong></span>
              </div>
              <button 
                onClick={() => setStep('upload')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Trocar PDF
              </button>
            </div>

            {/* SELETOR MOBILE (< md) */}
            <div className="md:hidden flex bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setAtaMobileTab('media')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  ataMobileTab === 'media'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Vídeo/Áudio da Mídia</span>
              </button>
              <button
                onClick={() => setAtaMobileTab('ata')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  ataMobileTab === 'ata'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSignature className="w-3.5 h-3.5" />
                <span>Termo de Audiência</span>
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
              {/* Coluna 1: Termo de Audiência */}
              <div className={`flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden ${
                ataMobileTab === 'ata' ? 'flex' : 'hidden md:flex'
              }`}>
                <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileSignature className="w-3.5 h-3.5 text-indigo-400" /> Termo Preliminar
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handleCopyAta}
                      className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition cursor-pointer"
                      title="Copiar ata"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={handlePrintAta}
                      className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition cursor-pointer"
                      title="Imprimir ata"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <textarea 
                  className="flex-1 w-full bg-slate-950 p-4 text-xs font-mono text-slate-300 resize-none focus:outline-none focus:border-indigo-500 leading-relaxed border-0"
                  value={ataText}
                  onChange={(e) => setAtaText(e.target.value)}
                  placeholder="Texto do termo de audiência..."
                />
              </div>

              {/* Coluna 2: Upload de Vídeo e Configuração do Prompt */}
              <div className={`flex-col h-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 overflow-y-auto ${
                ataMobileTab === 'media' ? 'flex' : 'hidden md:flex'
              }`}>
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Video className="w-4 h-4 text-indigo-400" /> Mídia da Audiência de Instrução
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  {modoMidia === 'texto'
                    ? 'Cole a transcrição da audiência já pronta. A IA a usa como prova oral (sem ouvir o vídeo) e redige a sentença completa.'
                    : 'Envie o arquivo MP4, WebM ou MP3 gravado na audiência. A IA degravará os pontos controvertidos e redigirá a sentença completa.'}
                </p>
                <div className="grid grid-cols-2 gap-1 p-1 mb-3 rounded-lg bg-slate-950 border border-slate-800" role="tablist" data-testid="modo-midia">
                  <button type="button" role="tab" aria-selected={modoMidia !== 'texto'} disabled={isProcessingVideo} onClick={() => setModoMidia('video')} data-testid="modo-midia-video"
                    className={`text-xs font-bold py-1.5 rounded-md cursor-pointer transition disabled:opacity-40 ${modoMidia !== 'texto' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>🎞 Enviar vídeo/áudio</button>
                  <button type="button" role="tab" aria-selected={modoMidia === 'texto'} disabled={isProcessingVideo} onClick={() => setModoMidia('texto')} data-testid="modo-midia-texto"
                    className={`text-xs font-bold py-1.5 rounded-md cursor-pointer transition disabled:opacity-40 ${modoMidia === 'texto' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>📝 Colar a transcrição</button>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center gap-4">
                  {modoMidia === 'texto' ? (
                    <div className="w-full flex flex-col gap-1.5" data-testid="area-transcricao">
                      <textarea value={transcricaoColada || ''} onChange={(e) => setTranscricaoColada(e.target.value)} disabled={isProcessingVideo} data-testid="transcricao-colada"
                        placeholder={'Cole aqui a transcrição da audiência.\nQuanto mais fiel, melhor: quem fala (juiz, autor, réu, cada testemunha) e, se tiver, o tempo [mm:ss] de cada trecho.'}
                        className="w-full h-48 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 leading-relaxed resize-y focus:outline-none" />
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span data-testid="transcricao-contagem" className={textoColado.length > 0 && textoColado.length < MIN_TRANSCRICAO ? 'text-amber-400' : ''}>{textoColado.length.toLocaleString('pt-BR')} caracteres{textoColado.length > 0 && textoColado.length < MIN_TRANSCRICAO ? ` (mínimo ${MIN_TRANSCRICAO})` : ''}</span>
                        {textoColado.length > 0 && <button type="button" onClick={() => setTranscricaoColada('')} disabled={isProcessingVideo} className="text-red-400 hover:text-red-300 cursor-pointer disabled:opacity-40" data-testid="transcricao-limpar">Limpar</button>}
                      </div>
                    </div>
                  ) : videoFiles.length === 0 ? (
                    <button 
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full h-36 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl bg-slate-950/50 hover:bg-slate-950 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-indigo-600/20 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-300">Selecionar Vídeo(s) ou Áudio(s) da Audiência</span>
                      <span className="text-[10px] text-slate-500">MP4, WebM, MKV, MP3, M4A — pode escolher vários (ex.: um vídeo por testemunha)</span>
                    </button>
                  ) : (
                    <div className="w-full flex flex-col gap-2" data-testid="lista-midias">
                      {videoFiles.map((vf, idx) => (
                        <div key={vf.name + vf.size} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Video className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="text-xs text-slate-200 font-medium truncate">{idx + 1}. {vf.name}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">{(vf.size / 1048576).toFixed(0)} MB</span>
                          </div>
                          <button 
                            onClick={() => setVideoFiles((l) => l.filter((_, i) => i !== idx))}
                            disabled={isProcessingVideo}
                            className="text-xs text-red-400 hover:text-red-300 transition cursor-pointer shrink-0 ml-2 disabled:opacity-40"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      <button onClick={() => videoInputRef.current?.click()} disabled={isProcessingVideo || videoFiles.length >= 12} className="text-xs font-bold text-indigo-300 hover:text-indigo-200 border border-dashed border-indigo-500/50 rounded-xl py-2 cursor-pointer disabled:opacity-40" data-testid="adicionar-midia">+ Adicionar outro vídeo ou áudio</button>
                    </div>
                  )}
                  <input type="file" ref={videoInputRef} className="hidden" accept="video/*,audio/*" multiple onChange={handleVideoUpload} />

                  {/* Seletor de Prompts Cadastrados no Sistema */}
                  <div className="w-full flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Gavel className="w-3.5 h-3.5 text-amber-400" />
                        Prompt Cadastrado no Sistema:
                      </label>
                      {selectedPrompt && (
                        <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                          Ativo: {selectedPrompt.title}
                        </span>
                      )}
                    </div>

                    <select 
                      value={selectedPromptId}
                      onChange={(e) => setSelectedPromptId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {prompts.length === 0 ? (
                        <option value="" disabled>Nenhum prompt cadastrado no sistema</option>
                      ) : (
                        <>
                          <option value="" disabled>-- Selecione um prompt cadastrado no sistema --</option>
                          {prompts.map(p => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </>
                      )}
                    </select>

                    <p className="text-[11px] text-slate-400 flex items-start gap-1 leading-tight pt-1">
                      <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{prompts.length > 0 
                        ? "A sentença será redigida estritamente com base nas diretrizes do prompt cadastrado selecionado." 
                        : "Nenhum prompt cadastrado encontrado. Acesse o Gerenciador de Prompts para cadastrar seus modelos de decisão."}</span>
                    </p>
                  </div>

                  <button 
                    onClick={handleGenerateSentence}
                    disabled={isProcessingVideo || (modoMidia === 'texto' ? textoColado.length < MIN_TRANSCRICAO : videoFiles.length === 0)}
                    data-testid="gerar-sentenca-midia"
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 min-h-[44px]"
                  >
                    {isProcessingVideo ? (
                      <><Zap className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse text-amber-300" /> {progressoMidia || 'Analisando Mídia e Redigindo Sentença...'}</>
                    ) : (
                      <><Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> {modoMidia === 'texto' ? 'Gerar Sentença com a Transcrição' : 'Analisar Mídia e Gerar Sentença'}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'sentence' && (
          <div className="max-w-5xl mx-auto w-full h-full flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg min-h-0">
            {/* Header de Sentença com Ações Claras */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-800/80 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-200 truncate">
                <Gavel className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{activeTitle}</span>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Alternador Visualização Forense vs Editor */}
                <div className="flex bg-slate-950 border border-slate-700 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setViewMode('formatted')}
                    className={`px-2 py-1 rounded flex items-center gap-1 transition ${
                      viewMode === 'formatted'
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Visualizar documento forense formatado"
                  >
                    <Eye className="w-3 h-3" />
                    <span className="hidden sm:inline">Visualização Forense</span>
                  </button>
                  <button
                    onClick={() => setViewMode('editor')}
                    className={`px-2 py-1 rounded flex items-center gap-1 transition ${
                      viewMode === 'editor'
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Modo editor de texto"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span className="hidden sm:inline">Modo Edição</span>
                  </button>
                </div>

                <button
                  onClick={proximoProcesso}
                  className="text-xs bg-amber-600 hover:bg-amber-500 px-2.5 py-1.5 rounded-lg font-bold text-white transition cursor-pointer flex items-center gap-1 shadow-sm"
                  title="Esta sentença já ficou salva no Histórico. Começa o próximo processo da pauta (o prompt escolhido é mantido)."
                  data-testid="mutirao-proximo"
                >
                  <ChevronRight className="w-3 h-3" />
                  <span>Próximo processo{sentencasDaSessao ? ` (${sentencasDaSessao} feita${sentencasDaSessao > 1 ? 's' : ''})` : ''}</span>
                </button>

                {/* Copiar Formatado para PROJUDI / Word */}
                <button 
                  onClick={handleCopyFormattedHtml}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 rounded-lg font-bold text-white transition cursor-pointer flex items-center gap-1 shadow-sm"
                  title="Copiar texto com formatação para PROJUDI ou Word"
                >
                  <Copy className="w-3 h-3" />
                  <span className="hidden xs:inline">Copiar p/ PROJUDI</span>
                </button>

                {/* Imprimir / PDF */}
                <button 
                  onClick={handlePrintSentence}
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg font-bold text-slate-200 transition cursor-pointer flex items-center gap-1"
                  title="Imprimir sentença oficial"
                >
                  <Printer className="w-3 h-3" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>

                {/* Salvar no Histórico */}
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 rounded-lg font-bold text-white transition cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-sm"
                  title="Salvar sentença no histórico do gabinete"
                >
                  <Save className="w-3 h-3" />
                  <span className="hidden xs:inline">{isSaving ? 'Salvando...' : 'Salvar'}</span>
                </button>

                {/* Voltar para Ata */}
                <button 
                  onClick={() => setStep('ata')}
                  className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-slate-300 transition cursor-pointer flex items-center gap-1 border border-slate-700"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span className="hidden xs:inline">Voltar p/ Termo</span>
                  <span className="xs:hidden">Voltar</span>
                </button>
              </div>
            </div>

            {/* SELETOR MOBILE ENTRE SENTENÇA E DEGRAVAÇÃO (< md) */}
            <div className="md:hidden flex bg-slate-950 border-b border-slate-800 p-1 shrink-0 gap-1">
              <button
                onClick={() => setSentenceMobileTab('sentence')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  sentenceMobileTab === 'sentence'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>Sentença Redigida</span>
              </button>
              <button
                onClick={() => setSentenceMobileTab('transcription')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  sentenceMobileTab === 'transcription'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Degravação da Mídia</span>
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
               {/* Coluna Transcrição */}
               <div className={`w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 p-3 sm:p-4 bg-slate-950/70 flex-col gap-2 overflow-y-auto ${
                 sentenceMobileTab === 'transcription' ? 'flex flex-1 md:flex-initial' : 'hidden md:flex'
               }`}>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                   <Video className="w-3.5 h-3.5 text-indigo-400" /> Degravação dos Depoimentos
                 </h4>
                 <div className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap bg-slate-900/90 p-3 rounded-lg border border-slate-800 flex-1 overflow-y-auto">
                   {transcription || "Nenhuma transcrição disponível."}
                 </div>
               </div>

               {/* Coluna Sentença Formatada / Editor */}
               <div className={`w-full md:flex-1 p-3 sm:p-4 flex-col min-h-0 overflow-y-auto bg-slate-950 ${
                 sentenceMobileTab === 'sentence' ? 'flex flex-1' : 'hidden md:flex'
               }`}>
                 {viewMode === 'formatted' ? (
                   <ForenseSentenceDocument 
                     text={sentenceText} 
                     processInfo={processInfo}
                     title={activeTitle}
                   />
                 ) : (
                   <div className="w-full h-full flex flex-col">
                     <div className="flex items-center justify-between pb-2 text-xs text-slate-400 font-sans">
                       <span>Edição direta do texto corrido:</span>
                       <span className="text-[11px] text-slate-500">As quebras e recuos são preservados na visualização forense.</span>
                     </div>
                     <textarea 
                       className="w-full flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 sm:p-5 text-xs sm:text-sm font-serif text-slate-100 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                       value={sentenceText}
                       onChange={(e) => setSentenceText(e.target.value)}
                       placeholder="Texto da sentença judicial..."
                     />
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
