import { brl, pct } from "@/lib/formato";
import type { PontoEquilibrio } from "@/lib/contabil-calculo";

export type LinhaDemo = {
  rotulo: string;
  valor: number;
  /** total = linha de abertura; subtotal = (=) intermediario; final = resultado */
  tipo?: "total" | "subtotal" | "final";
  nota?: string;
};

/** Demonstrativo em cascata (DRE Contabil e Fluxo Contabil), com % sobre a base. */
export function DemonstrativoContabil({ linhas, base }: { linhas: LinhaDemo[]; base: number }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
          <th className="py-2 text-left font-semibold">Conta</th>
          <th className="py-2 text-right font-semibold">Valor</th>
          <th className="w-20 py-2 text-right font-semibold">%</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => {
          // -0 (ex.: "−R$ 0,00") vira 0
          const l = { ...linha, valor: linha.valor || 0 };
          const forte = l.tipo === "subtotal" || l.tipo === "final" || l.tipo === "total";
          const cor =
            l.tipo === "final" ? (l.valor >= 0 ? "text-positivo" : "text-negativo") : l.valor < 0 ? "text-slate-700" : "text-slate-900";
          return (
            <tr
              key={i}
              className={`${l.tipo === "subtotal" || l.tipo === "final" ? "border-t border-slate-300 bg-slate-50" : "border-t border-slate-100"} ${
                l.tipo === "final" ? "text-base" : ""
              }`}
            >
              <td className={`py-1.5 pr-2 ${forte ? "font-semibold" : "pl-4 text-slate-700"}`}>
                {l.rotulo}
                {l.nota && <span className="ml-2 text-[11px] font-normal text-slate-400">{l.nota}</span>}
              </td>
              <td className={`py-1.5 text-right tabular-nums ${forte ? "font-bold" : ""} ${cor}`}>{brl(l.valor)}</td>
              <td className="py-1.5 text-right text-xs tabular-nums text-slate-500">{base ? pct(l.valor / base) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Bloco de ponto de equilibrio: margem de contribuicao %, PEF e PEE. */
export function Equilibrio({
  e,
  rotuloFixos,
  fixos,
  receitaAtual,
}: {
  e: PontoEquilibrio;
  rotuloFixos: string;
  fixos: number;
  receitaAtual: number;
}) {
  const item = (rotulo: string, valor: number | null, explica: string) => (
    <div className="border-t border-slate-100 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{rotulo}</span>
        <span className="font-bold tabular-nums">{valor === null ? "não atingível" : brl(valor)}</span>
      </div>
      <p className="text-[11px] text-slate-500">{explica}</p>
      {valor !== null && receitaAtual > 0 && (
        <p className={`text-[11px] font-medium ${receitaAtual >= valor ? "text-positivo" : "text-negativo"}`}>
          {receitaAtual >= valor
            ? `Receita do mês está ${pct(receitaAtual / valor - 1)} acima`
            : `Falta ${brl(valor - receitaAtual)} de receita`}
        </p>
      )}
    </div>
  );
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ponto de equilíbrio</p>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">Margem de contribuição</span>
        <span className="font-semibold tabular-nums">{pct(e.mcPct)}</span>
      </div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">{rotuloFixos}</span>
        <span className="font-semibold tabular-nums">{brl(fixos)}</span>
      </div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-slate-600">Lucro desejável</span>
        <span className="font-semibold tabular-nums">{pct(e.lucroDesejavelPct)}</span>
      </div>
      {item("PEF — financeiro", e.pef, `Receita que paga ${rotuloFixos.toLowerCase()}: fixos ÷ margem de contribuição %.`)}
      {item("PEE — econômico", e.pee, "Receita que paga os fixos e entrega o lucro desejável: fixos ÷ (MC% − lucro desejável %).")}
    </div>
  );
}
