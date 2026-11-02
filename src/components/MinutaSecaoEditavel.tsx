import React, { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Trecho da minuta editável NO PRÓPRIO LUGAR, sem abrir o modo "Editar".
 * - Parado: mostra o texto formatado (children). Clicar (sem selecionar texto) troca o trecho por um campo de texto na mesma posição, já com o cursor perto de onde se clicou.
 * - Editando: o texto vai sendo salvo sozinho (1,2 s depois da última tecla e ao sair do campo); "Esc" ou clicar fora volta à visão formatada.
 * - O texto editado é o Markdown gravado na minuta (negrito **assim**), para não perder formatação ao converter de volta.
 */
interface Props {
  valor: string; // texto gravado (Markdown), com quebras de linha reais
  onSalvar: (novo: string) => void | Promise<void>;
  children: React.ReactNode; // visão formatada
  testId: string;
  rotulo: string; // ex.: "Fundamentação"
  className?: string;
  textareaClassName?: string;
}

const ATRASO_MS = 1200;

/** Posição aproximada, dentro do texto gravado, do ponto onde o usuário clicou na visão formatada. */
function posicaoDoClique(e: React.MouseEvent, bruto: string, container: HTMLElement | null): number {
  try {
    const doc = document as any;
    let no: Node | null = null, off = 0;
    if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(e.clientX, e.clientY); no = p?.offsetNode ?? null; off = p?.offset ?? 0; }
    else if (doc.caretRangeFromPoint) { const r = doc.caretRangeFromPoint(e.clientX, e.clientY); no = r?.startContainer ?? null; off = r?.startOffset ?? 0; }
    if (no && no.nodeType === 3 && container?.contains(no)) {
      const t = no.textContent || "";
      const antes = t.slice(Math.max(0, off - 28), off), depois = t.slice(off, off + 28);
      let i = (antes + depois).length >= 8 ? bruto.indexOf(antes + depois) : -1;
      if (i >= 0) return i + antes.length;
      i = antes.length >= 6 ? bruto.lastIndexOf(antes) : -1;
      if (i >= 0) return i + antes.length;
      // proporcional ao texto visível
      const todo = (container.innerText || "").length || 1;
      const ate = (() => { const rg = document.createRange(); rg.selectNodeContents(container); rg.setEnd(no as Node, off); return rg.toString().length; })();
      return Math.min(bruto.length, Math.round((ate / todo) * bruto.length));
    }
  } catch { /* usa o fim do texto */ }
  return bruto.length;
}

export const MinutaSecaoEditavel: React.FC<Props> = ({ valor, onSalvar, children, testId, rotulo, className = "", textareaClassName = "" }) => {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [estado, setEstado] = useState<"" | "pendente" | "salvando" | "salvo" | "erro">("");
  const [salvoEm, setSalvoEm] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoSalvo = useRef(valor);
  const textoRef = useRef(valor);
  const salvarRef = useRef(onSalvar);
  const cursorInicial = useRef<number | null>(null);
  salvarRef.current = onSalvar;
  textoRef.current = texto;

  // Quando a minuta muda por fora (chat, restauração de versão) e o usuário não está digitando aqui, acompanha.
  useEffect(() => { if (!editando) { setTexto(valor); ultimoSalvo.current = valor; setEstado(""); } }, [valor, editando]);

  const salvarAgora = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const atual = textoRef.current;
    if (atual === ultimoSalvo.current) { setEstado((s) => (s === "pendente" ? "salvo" : s)); return; }
    setEstado("salvando");
    try {
      await salvarRef.current(atual);
      ultimoSalvo.current = atual;
      setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setEstado("salvo");
    } catch { setEstado("erro"); }
  };

  // salva o que ficou pendente se o componente sair da tela
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); if (textoRef.current !== ultimoSalvo.current) void salvarRef.current(textoRef.current); } }, []);

  useEffect(() => {
    if (!editando || !taRef.current) return;
    const ta = taRef.current;
    ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px";
    ta.focus({ preventScroll: true });
    const p = cursorInicial.current ?? ta.value.length; ta.setSelectionRange(p, p); cursorInicial.current = null;
  }, [editando]);

  const aoDigitar = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value; setTexto(v); textoRef.current = v; setEstado("pendente");
    e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px";
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void salvarAgora(); }, ATRASO_MS);
  };

  const aoClicar = (e: React.MouseEvent) => {
    if (editando) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return; // selecionar texto não abre a edição
    if ((e.target as HTMLElement).closest("a,button")) return;
    cursorInicial.current = posicaoDoClique(e, valor, boxRef.current);
    setTexto(valor); textoRef.current = valor; setEditando(true);
  };

  const sair = async () => { await salvarAgora(); setEditando(false); };

  if (!editando) {
    return (
      <div
        ref={boxRef}
        data-testid={testId}
        onClick={aoClicar}
        title={`Clique no texto para editar ${rotulo.toLowerCase()} direto aqui (salva sozinho)`}
        className={`group relative cursor-text rounded-md -mx-2 px-2 py-0.5 transition hover:bg-emerald-50/60 hover:ring-1 hover:ring-dashed hover:ring-emerald-300 ${className}`}
      >
        {children}
        <span className="pointer-events-none absolute -top-2 right-1 hidden group-hover:flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-white border border-emerald-200 rounded px-1.5 py-0.5 shadow-2xs font-sans">
          <Pencil className="w-3 h-3" /> clique para editar
        </span>
      </div>
    );
  }

  return (
    <div data-testid={testId} className="relative -mx-2 px-2 py-0.5 rounded-md ring-2 ring-emerald-400 bg-white">
      <textarea
        ref={taRef}
        data-testid={testId + "-campo"}
        value={texto}
        onChange={aoDigitar}
        onBlur={() => { void sair(); }}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
        spellCheck
        style={{ font: "inherit" }}
        className={`w-full resize-none overflow-hidden bg-transparent outline-none text-justify leading-relaxed whitespace-pre-wrap ${textareaClassName}`}
      />
      <div className="flex items-center justify-between gap-2 pt-1 mt-1 border-t border-emerald-100 text-[10px] font-sans text-slate-500">
        <span>Editando {rotulo.toLowerCase()} · salva sozinho · Esc ou clique fora para voltar</span>
        <span data-testid={testId + "-estado"} className={estado === "erro" ? "text-red-600 font-bold" : estado === "salvo" ? "text-emerald-700 font-semibold" : ""}>
          {estado === "pendente" ? "…" : estado === "salvando" ? "Salvando…" : estado === "salvo" ? `✓ Salvo às ${salvoEm}` : estado === "erro" ? "Não consegui salvar (tente de novo)" : ""}
        </span>
      </div>
    </div>
  );
};
