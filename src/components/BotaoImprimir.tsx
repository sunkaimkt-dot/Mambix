"use client";

/**
 * Imprime a tela ou salva em PDF ("Salvar como PDF" no destino da impressao).
 * Sem biblioteca: o navegador ja faz isso bem, e o layout de papel sai do CSS
 * de impressao do globals.css (menu, filtros e botoes somem; tabela nao quebra
 * no meio da linha).
 */
export default function BotaoImprimir({ rotulo = "Imprimir / Salvar PDF" }: { rotulo?: string }) {
  return (
    <button
      data-tour="imprimir"
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 print:hidden"
    >
      {rotulo}
    </button>
  );
}
