import type { Contexto } from "@/lib/contexto";

/**
 * Cabecalho que so aparece no papel: no PDF nao tem o seletor de empresa/loja/mes,
 * entao quem le precisa saber de que empresa, loja e periodo e aquele relatorio.
 */
export default function CabecalhoImpressao({ ctx, titulo, periodo }: { ctx: Contexto; titulo: string; periodo: string }) {
  const loja = ctx.lojaId ? ctx.lojas.find((l) => l.id === ctx.lojaId)?.nome ?? "—" : "Todas as lojas (consolidado)";
  const emitido = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <div className="mb-4 hidden border-b border-slate-300 pb-2 print:block">
      <p className="text-base font-bold">{titulo}</p>
      <p className="text-xs text-slate-600">
        {ctx.empresaNome} · {loja} · {periodo} · emitido em {emitido}
      </p>
    </div>
  );
}
