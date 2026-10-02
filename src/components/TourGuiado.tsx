"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TOURS, chaveDoTour, type PassoTour } from "@/lib/tours";
import { marcarTourVisto } from "@/lib/acoes";
import { EVENTO_TOUR } from "@/components/BotaoTour";

/**
 * Tour guiado da tela atual.
 *
 * - Abre sozinho na PRIMEIRA vez que a pessoa entra na tela (registro em
 *   tours_vistos, por usuario -- vale em qualquer computador).
 * - Abre de novo quando ela clica em "Tour guiado" (evento EVENTO_TOUR).
 * - Fechar, pular ou concluir conta como visto.
 *
 * Cada passo destaca o elemento com data-tour="<alvo>" (o resto da tela
 * escurece) e mostra um balao ao lado. Alvo ausente ou invisivel = passo pulado.
 * Sem biblioteca: e so um recorte com box-shadow e um balao posicionado.
 */

type Retangulo = { top: number; left: number; width: number; height: number };

const MARGEM = 8; // folga do destaque em volta do elemento
const LARGURA_BALAO = 340;

function acharAlvo(alvo: string): HTMLElement | null {
  const todos = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`));
  // O primeiro que estiver visivel (o menu some no celular, por exemplo).
  return todos.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }) ?? null;
}

export default function TourGuiado({
  vistos,
  papel,
  autoInicio = true,
}: {
  vistos: string[];
  papel: "plataforma" | "gestor" | "empresario";
  /* false quando o banco nao respondeu quem ja viu o que (ex.: migration 0122
     ainda nao aplicada) -- melhor nao abrir sozinho do que abrir toda vez. */
  autoInicio?: boolean;
}) {
  const pathname = usePathname();
  const chave = chaveDoTour(pathname);
  const jaVistos = useRef(new Set(vistos));

  // Passos validos para esta pessoa (os de equipe saem para o cliente).
  const passosBase = useMemo<PassoTour[]>(() => {
    if (!chave) return [];
    if (TOURS[chave].soEquipe && papel === "empresario") return [];
    return TOURS[chave].passos.filter((p) => !(p.soEquipe && papel === "empresario"));
  }, [chave, papel]);

  const [passos, setPassos] = useState<PassoTour[]>([]);
  const [i, setI] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [ret, setRet] = useState<Retangulo | null>(null);
  const [tamanhoBalao, setTamanhoBalao] = useState({ w: LARGURA_BALAO, h: 180 });
  const balaoRef = useRef<HTMLDivElement>(null);

  const comecar = useCallback(() => {
    // So entram os passos cujo alvo esta na tela agora.
    const validos = passosBase.filter((p) => !p.alvo || acharAlvo(p.alvo));
    if (!validos.length) return;
    setPassos(validos);
    setI(0);
    setAberto(true);
  }, [passosBase]);

  const fechar = useCallback(() => {
    setAberto(false);
    setRet(null);
    if (chave && !jaVistos.current.has(chave)) {
      jaVistos.current.add(chave);
      void marcarTourVisto(chave);
    }
  }, [chave]);

  // Primeiro acesso: abre sozinho depois que a tela termina de desenhar.
  useEffect(() => {
    setAberto(false);
    if (!autoInicio || !chave || jaVistos.current.has(chave)) return;
    const t = setTimeout(comecar, 700);
    return () => clearTimeout(t);
  }, [chave, comecar, autoInicio]);

  // Botao "Tour guiado".
  useEffect(() => {
    const ouvir = () => comecar();
    window.addEventListener(EVENTO_TOUR, ouvir);
    return () => window.removeEventListener(EVENTO_TOUR, ouvir);
  }, [comecar]);

  const passo = aberto ? passos[i] : undefined;

  // Mede o alvo do passo atual (e de novo ao rolar/redimensionar).
  const medir = useCallback(() => {
    if (!passo?.alvo) { setRet(null); return; }
    const el = acharAlvo(passo.alvo);
    if (!el) { setRet(null); return; }
    const r = el.getBoundingClientRect();
    setRet({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [passo]);

  useEffect(() => {
    if (!passo?.alvo) { setRet(null); return; }
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
    if (!aberto) return;
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto, medir]);

  useLayoutEffect(() => {
    if (balaoRef.current) {
      const r = balaoRef.current.getBoundingClientRect();
      setTamanhoBalao({ w: r.width, h: r.height });
    }
  }, [passo, ret]);

  const avancar = useCallback(() => {
    if (i < passos.length - 1) setI(i + 1);
    else fechar();
  }, [i, passos.length, fechar]);
  const voltar = () => setI(Math.max(0, i - 1));

  // Teclado: setas navegam, Esc fecha.
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight" || e.key === "Enter") avancar();
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, avancar, fechar]);

  if (!aberto || !passo) return null;

  // Posicao do balao: abaixo do alvo; se nao couber, acima; se nao couber,
  // ao lado; sempre dentro da tela. Sem alvo: no centro.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const largura = Math.min(LARGURA_BALAO, vw - 24);
  let estiloBalao: React.CSSProperties;
  if (ret) {
    const h = tamanhoBalao.h;
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
    estiloBalao = { top: "50%", left: "50%", width: Math.min(420, vw - 24), transform: "translate(-50%, -50%)" };
  }

  const ultimo = i === passos.length - 1;

  return (
    <div className="fixed inset-0 z-[100] print:hidden" role="dialog" aria-modal="true" aria-label={`Tour guiado: ${passo.titulo}`}>
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
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{passo.titulo}</p>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
            {i + 1} de {passos.length}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">{passo.texto}</p>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-marca transition-all" style={{ width: `${((i + 1) / passos.length) * 100}%` }} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={fechar} className="text-xs text-slate-500 hover:text-slate-800 hover:underline">
            {ultimo ? "Fechar" : "Pular tour"}
          </button>
          <span className="flex-1" />
          {i > 0 && (
            <button
              type="button"
              onClick={voltar}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={avancar}
            className="rounded-lg bg-marca px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-marca-escura"
          >
            {ultimo ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
