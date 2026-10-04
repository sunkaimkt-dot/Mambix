"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TOURS, chaveDoTour, type PassoTour } from "@/lib/tours";
import { marcarTourVisto } from "@/lib/acoes";
import { EVENTO_TOUR } from "@/components/BotaoTour";
import CamadaTour, { acharAlvo } from "@/components/CamadaTour";
import { CHAVE_JORNADA } from "@/lib/tour-boas-vindas";
import { CHAVE_SESSAO, EVENTO_VISTOS } from "@/components/TourBoasVindas";

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
 * A parte visual fica em CamadaTour.
 */

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
    if (chave && !jaVistos.current.has(chave)) {
      jaVistos.current.add(chave);
      void marcarTourVisto(chave);
    }
  }, [chave]);

  // Primeiro acesso: abre sozinho depois que a tela termina de desenhar.
  useEffect(() => {
    setAberto(false);
    if (!autoInicio || !chave || jaVistos.current.has(chave)) return;
    // O tour completo de boas-vindas vem primeiro (e ja cobre esta tela).
    if (!jaVistos.current.has(CHAVE_JORNADA)) return;
    try { if (sessionStorage.getItem(CHAVE_SESSAO)) return; } catch { /* segue */ }
    const t = setTimeout(comecar, 700);
    return () => clearTimeout(t);
  }, [chave, comecar, autoInicio]);

  // Fim do tour completo: as telas que ele cobriu nao abrem de novo sozinhas.
  useEffect(() => {
    const ouvir = (e: Event) => {
      for (const t of (e as CustomEvent<string[]>).detail ?? []) jaVistos.current.add(t);
    };
    window.addEventListener(EVENTO_VISTOS, ouvir);
    return () => window.removeEventListener(EVENTO_VISTOS, ouvir);
  }, []);

  // Botao "Tour guiado".
  useEffect(() => {
    const ouvir = () => comecar();
    window.addEventListener(EVENTO_TOUR, ouvir);
    return () => window.removeEventListener(EVENTO_TOUR, ouvir);
  }, [comecar]);

  const avancar = useCallback(() => {
    if (i < passos.length - 1) setI(i + 1);
    else fechar();
  }, [i, passos.length, fechar]);
  const voltar = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  const passo = aberto ? passos[i] : undefined;
  if (!passo) return null;

  return (
    <CamadaTour
      passo={passo}
      indice={i}
      total={passos.length}
      onProximo={avancar}
      onVoltar={voltar}
      onFechar={fechar}
    />
  );
}
