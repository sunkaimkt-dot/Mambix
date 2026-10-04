"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { JORNADA, CHAVE_JORNADA, telasDaJornada, type PassoJornada } from "@/lib/tour-boas-vindas";
import { marcarToursVistos } from "@/lib/acoes";
import CamadaTour, { acharAlvo } from "@/components/CamadaTour";

/**
 * Tour completo de boas-vindas (roteiro em src/lib/tour-boas-vindas.ts).
 *
 * - Abre sozinho no primeiro acesso da pessoa ao sistema.
 * - Abre de novo pelo botao "Tour completo do sistema" (EVENTO_JORNADA).
 * - Troca de tela sozinho; o progresso fica no sessionStorage para sobreviver
 *   a um recarregamento de pagina no meio do caminho.
 * - Ao terminar (ou pular), marca como vistos a jornada e os tours das telas
 *   por onde ela passou -- assim eles nao abrem de novo em seguida. O tour de
 *   cada tela continua disponivel pelo botao "Tour guiado".
 */

export const EVENTO_JORNADA = "mambix:jornada";
/** Avisado ao TourGuiado: estas telas ja foram vistas. */
export const EVENTO_VISTOS = "mambix:tours-vistos";
/** sessionStorage: { i, qs } enquanto a jornada estiver em andamento. */
export const CHAVE_SESSAO = "mambix:jornada";

const FILTROS = ["empresa", "loja", "mes", "ano"];

function lerSessao(): { i: number; qs: string } | null {
  try {
    const v = sessionStorage.getItem(CHAVE_SESSAO);
    return v ? (JSON.parse(v) as { i: number; qs: string }) : null;
  } catch {
    return null;
  }
}
function gravarSessao(v: { i: number; qs: string } | null) {
  try {
    if (v) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(v));
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    /* sem sessionStorage: o tour so nao sobrevive a um F5 */
  }
}

/** Mantem empresa/loja/mes/ano escolhidos ao trocar de tela. */
function qsAtual(): string {
  const atual = new URLSearchParams(window.location.search);
  const p = new URLSearchParams();
  for (const k of FILTROS) {
    const v = atual.get(k);
    if (v) p.set(k, v);
  }
  return p.toString();
}

export default function TourBoasVindas({
  vistos,
  papel,
  autoInicio = true,
}: {
  vistos: string[];
  papel: "plataforma" | "gestor" | "empresario";
  autoInicio?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const passos = useMemo<PassoJornada[]>(
    () => JORNADA.filter((p) => !(p.soEquipe && papel === "empresario")),
    [papel]
  );

  const [i, setI] = useState<number | null>(null);
  const [qs, setQs] = useState("");
  const [pronto, setPronto] = useState(false); // alvo do passo atual na tela
  const direcao = useRef<1 | -1>(1);

  const iniciar = useCallback(() => {
    const q = qsAtual();
    direcao.current = 1;
    setQs(q);
    setI(0);
    gravarSessao({ i: 0, qs: q });
  }, []);

  // Primeiro acesso, ou retomada depois de um F5.
  useEffect(() => {
    const s = lerSessao();
    if (s) { setQs(s.qs); setI(Math.min(s.i, passos.length - 1)); return; }
    if (autoInicio && !vistos.includes(CHAVE_JORNADA)) {
      const t = setTimeout(iniciar, 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Botao "Tour completo do sistema".
  useEffect(() => {
    window.addEventListener(EVENTO_JORNADA, iniciar);
    return () => window.removeEventListener(EVENTO_JORNADA, iniciar);
  }, [iniciar]);

  const passo = i === null ? undefined : passos[i];

  // Leva para a tela do passo e espera o alvo aparecer.
  useEffect(() => {
    setPronto(false);
    if (!passo || i === null) return;
    gravarSessao({ i, qs });
    if (pathname !== passo.rota) {
      router.push(`${passo.rota}${qs ? `?${qs}` : ""}`);
      return;
    }
    if (!passo.alvo) {
      const t = setTimeout(() => setPronto(true), 400);
      return () => clearTimeout(t);
    }
    let tentativas = 0;
    const procurar = setInterval(() => {
      tentativas++;
      if (acharAlvo(passo.alvo!)) {
        clearInterval(procurar);
        setTimeout(() => setPronto(true), 250);
      } else if (tentativas > 30) {
        // ~4,5 s sem o alvo (lista vazia, celular): segue na mesma direcao.
        clearInterval(procurar);
        const prox = i + direcao.current;
        if (prox < 0 || prox >= passos.length) fechar();
        else setI(prox);
      }
    }, 150);
    return () => clearInterval(procurar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, pathname, i]);

  const fechar = useCallback(() => {
    setI(null);
    gravarSessao(null);
    const telas = [CHAVE_JORNADA, ...telasDaJornada()];
    void marcarToursVistos(telas);
    window.dispatchEvent(new CustomEvent(EVENTO_VISTOS, { detail: telas }));
  }, []);

  const proximo = useCallback(() => {
    if (i === null) return;
    direcao.current = 1;
    if (i >= passos.length - 1) fechar();
    else setI(i + 1);
  }, [i, passos.length, fechar]);

  const voltar = useCallback(() => {
    if (i === null || i === 0) return;
    direcao.current = -1;
    setI(i - 1);
  }, [i]);

  if (!passo || i === null) return null;

  if (!pronto) {
    // Trocando de tela: so escurece, para a pessoa entender que esta andando.
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 pb-10 print:hidden">
        <span className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-600 shadow">
          Indo para {passo.secao}…
        </span>
      </div>
    );
  }

  return (
    <CamadaTour
      passo={passo}
      indice={i}
      total={passos.length}
      onProximo={proximo}
      onVoltar={voltar}
      onFechar={fechar}
      rotuloDialogo="Tour completo"
    />
  );
}
