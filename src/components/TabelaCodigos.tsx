import Link from "next/link";
import { brl, pct } from "@/lib/formato";
import type { LinhaCodigo } from "@/lib/relatorios";

/**
 * Tabela de codigos da DRE e do DFC.
 * Codigo com valor vira link para a evolucao de 12 meses -- pedido do cliente:
 * "a pessoa clica no codigo e ja mostra o grafico do ano".
 */
export default function TabelaCodigos({
  linhas,
  base,
  titulo,
  regime,
  qs = "",
}: {
  linhas: LinhaCodigo[];
  base: number;
  titulo: string;
  regime: "competencia" | "caixa";
  qs?: string;
}) {
  const metade = Math.ceil(linhas.length / 2);
  const colunas = [linhas.slice(0, metade), linhas.slice(metade)];

  const paramsBase = new URLSearchParams(qs);
  paramsBase.set("regime", regime);
  const sufixo = `?${paramsBase.toString()}`;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {titulo}
        <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
          clique no código para ver a evolução do ano
        </span>
      </p>
      <div className="grid gap-x-8 lg:grid-cols-2">
        {colunas.map((col, i) => (
          <table key={i} className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-10 py-1 font-semibold">Cód.</th>
                <th className="py-1 font-semibold">Descrição</th>
                <th className="py-1 text-right font-semibold">Valor</th>
                <th className="w-16 py-1 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {col.map((l) => (
                <tr key={l.codigo} className={l.valor ? "" : "text-slate-300"}>
                  <td className="py-0.5 tabular-nums">
                    {l.valor ? (
                      <Link
                        href={`/evolucao/${l.codigo}${sufixo}`}
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        {l.codigo}
                      </Link>
                    ) : (
                      l.codigo
                    )}
                  </td>
                  <td className="truncate py-0.5">{l.nome || "—"}</td>
                  <td className="py-0.5 text-right tabular-nums">{l.valor ? brl(l.valor) : "—"}</td>
                  <td className="py-0.5 text-right tabular-nums">{l.valor && base ? pct(l.valor / base) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
