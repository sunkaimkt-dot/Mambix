"use client";

/** Evento que o TourGuiado (no layout) escuta para comecar o tour da tela atual. */
export const EVENTO_TOUR = "mambix:tour";

export default function BotaoTour() {
  return (
    <button
      type="button"
      data-tour="botao-tour"
      onClick={() => window.dispatchEvent(new Event(EVENTO_TOUR))}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-marca hover:text-marca print:hidden"
      title="Mostra, passo a passo, para que serve cada parte desta tela"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
      </svg>
      Tour guiado
    </button>
  );
}
