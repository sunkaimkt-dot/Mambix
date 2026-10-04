"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A camada visual de qualquer tour: escurece a tela, recorta o elemento do
 * passo (data-tour="<alvo>") e mostra o balao com os botoes. Usada pelo tour
 * de cada tela (TourGuiado) e pelo tour completo de boas-vindas
 * (TourBoasVindas). Quem decide QUAIS passos e a ordem e o componente de fora.
 */

export type PassoCamada = { alvo?: string; titulo: string; texto: string; secao?: string };
type Retangulo = { top: number; left: number; width: number; height: number };

const MARGEM = 8; // folga do destaque em volta do elemento
const LARGURA_BALAO = 340;

export function acharAlvo(alvo: string): HTMLElement | null {
  const todos = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`));
  // O primeiro que estiver visivel (o menu some no celular, por exemplo).
  return (
    todos.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    }) ?? null
  );
}

export default function CamadaTour({
  passo,
  indice,
  total,
  onProximo,
  onVoltar,
  onFechar,
  rotuloDialogo = "Tour guiado",
}: {
  passo: PassoCamada;
  indice: number;
  total: number;
  onProximo: () => void;
  onVoltar: () => void;
  onFechar: () => void;
  rotuloDialogo?: string;
}) {
  const [ret, setRet] = useState<Retangulo | null>(null);
  const [alturaBalao, setAlturaBalao] = useState(180);
  const balaoRef = useRef<HTMLDivElement>(null);

  // Mede o alvo do passo atual (e de novo ao rolar/redimensionar).
  const medir = useCallback(() => {
    if (!passo.alvo) { setRet(null); return; }
    const el = acharAlvo(passo.alvo);
    if (!el) { setRet(null); return; }
    const r = el.getBoundingClientRect();
    setRet({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [passo]);

  useEffect(() => {
    if (!passo.alvo) { setRet(null); return; }
    const el = acharAlvo(passo.alvo);
    if (!el) { setRet(null); return; }
    const r = el.getBoundingClientRect();
    // Elemento alto (tabela inteira): mostra o comeco dele, nao o meio.
    const bloco = r.height > window.innerHeight * 0.6 ? "start" : "center";
    el.scrollIntoView({ block: bloco, behavior: "smooth" });
    const t = setTimeout(medir, 380);
    return () => clearTimeout(t);
  }, [passo, medir]);

  useEffect(() => {
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [medir]);

  useLayoutEffect(() => {
    if (balaoRef.current) setAlturaBalao(balaoRef.current.getBoundingClientRect().height);
  }, [passo, ret]);

  // Teclado: setas navegam, Enter avanca, Esc fecha.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowRight" || e.key === "Enter") onProximo();
      if (e.key === "ArrowLeft" && indice > 0) onVoltar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onProximo, onVoltar, onFechar, indice]);

  // Posicao do balao: abaixo do alvo; se nao couber, acima; se nao couber,
  // ao lado; sempre dentro da tela. Sem alvo: no centro.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const largura = Math.min(LARGURA_BALAO, vw - 24);
  let estiloBalao: React.CSSProperties;
  if (ret) {
    const h = alturaBalao;
    const espacoAbaixo = vh - (ret.top + ret.height + MARGEM);
    const espacoAcima = ret.top - MARGEM;
    let top: number;
    let left = ret.left;
    if (espacoAbaixo >= h + 16) top = ret.top + ret.height + MARGEM + 10;
    else if (espacoAcima >= h + 16) top = ret.top - MARGEM - 10 - h;
    else if (vw - (ret.left + ret.width) >= largura + 24) {
      left = ret.left + ret.width + MARGEM + 10;
      top = Math.min(Math.max(ret.top, 12), vh - h - 12);
    } else if (ret.left >= largura + 24) {
      left = ret.left - MARGEM - 10 - largura;
      top = Math.min(Math.max(ret.top, 12), vh - h - 12);
    } else top = vh - h - 16; // alvo ocupa a tela toda: balao no rodape
    left = Math.min(Math.max(left, 12), vw - largura - 12);
    top = Math.min(Math.max(top, 12), vh - h - 12);
    estiloBalao = { top, left, width: largura };
  } else {
    estiloBalao = { top: "50%", left: "50%", width: Math.min(440, vw - 24), transform: "translate(-50%, -50%)" };
  }

  const ultimo = indice === total - 1;

  return (
    <div className="fixed inset-0 z-[100] print:hidden" role="dialog" aria-modal="true" aria-label={`${rotuloDialogo}: ${passo.titulo}`}>
      {/* Clique fora nao fecha: evita perder o tour sem querer. */}
      {ret ? (
        <div
          className="pointer-events-none fixed rounded-xl transition-all duration-300"
          style={{
            top: ret.top - MARGEM,
            left: ret.left - MARGEM,
            width: ret.width + MARGEM * 2,
            height: ret.height + MARGEM * 2,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
            outline: "2px solid var(--marca)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/55" />
      )}
      <div className="fixed inset-0" />

      <div
        ref={balaoRef}
        className="fixed rounded-xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 transition-[top,left] duration-300"
        style={estiloBalao}
      >
        {passo.secao && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-marca">{passo.secao}</p>
        )}
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{passo.titulo}</p>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
            {indice + 1} de {total}
          </span>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{passo.texto}</p>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-marca transition-all" style={{ width: `${((indice + 1) / total) * 100}%` }} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onFechar} className="text-xs text-slate-500 hover:text-slate-800 hover:underline">
            {ultimo ? "Fechar" : "Pular tour"}
          </button>
          <span className="flex-1" />
          {indice > 0 && (
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={onProximo}
            className="rounded-lg bg-marca px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-marca-escura"
          >
            {ultimo ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
