import { carregarContexto } from "@/lib/contexto";
import { dadosDRE } from "@/lib/relatorios";
import Cabecalho from "@/components/Cabecalho";
import TabelaCodigos from "@/components/TabelaCodigos";
import { Cartao } from "@/components/ui";
import { brl, pct, MESES } from "@/lib/formato";
import Link from "next/link";

export default async function DRE({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const d = await dadosDRE(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId);
  const base = d.faturamento;

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  ).toString();

  return (
    <main className="p-6">
      <Cabecalho
        titulo="DRE Gerencial"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — regime de competência (o que pertence ao mês, pago ou não)`}
        ctx={ctx}
      />

      {d.margem === 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A <strong>margem bruta</strong> deste mês ainda não foi informada, então o CMV e o lucro bruto aparecem
          zerados. Defina em{" "}
          <Link href={`/parametros${qs ? `?${qs}` : ""}`} className="font-semibold underline">
            Parâmetros do mês
          </Link>
          .
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao className="p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Faturamento / Vendas</p>
            <p className="text-lg font-bold">{brl(d.faturamento)}</p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {d.porTipoVenda.map((t) => (
                <tr key={t.codigo} className={t.valor ? "" : "text-slate-300"}>
                  <td className="py-1">{t.nome}</td>
                  <td className="py-1 text-right tabular-nums">{brl(t.valor)}</td>
                  <td className="w-16 py-1 text-right tabular-nums">{base ? pct(t.valor / base) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>

        <Cartao className="p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Despesas por grupo</p>
            <p className="text-lg font-bold text-red-700">{brl(d.despesas)}</p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {d.grupos.map((g) => (
                <tr key={g.chave} className={g.total ? "" : "text-slate-300"}>
                  <td className="py-1">{g.rotulo}</td>
                  <td className="py-1 text-right tabular-nums">{brl(g.total)}</td>
                  <td className="w-16 py-1 text-right tabular-nums">{base ? pct(g.total / base) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-slate-400">
            Investimentos, estoque e retirada de sócio não entram na DRE — aparecem só no fluxo de caixa.
          </p>
        </Cartao>
      </div>

      <Cartao className="mb-6 p-4">
        <div className="grid gap-4 sm:grid-cols-5">
          {[
            { r: "Faturamento", v: d.faturamento, p: 1, cor: "text-slate-900" },
            { r: "CMV / CPV", v: d.cmv, p: base ? d.cmv / base : 0, cor: "text-slate-600" },
            { r: "Lucro bruto", v: d.lucroBruto, p: d.margem, cor: "text-slate-900" },
            { r: "Despesas", v: d.despesas, p: base ? d.despesas / base : 0, cor: "text-red-700" },
            {
              r: "Resultado",
              v: d.resultado,
              p: base ? d.resultado / base : 0,
              cor: d.resultado >= 0 ? "text-emerald-700" : "text-red-700",
            },
          ].map((c) => (
            <div key={c.r}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.r}</p>
              <p className={`text-lg font-bold ${c.cor}`}>{brl(c.v)}</p>
              <p className="text-xs text-slate-400">{pct(c.p)}</p>
            </div>
          ))}
        </div>
      </Cartao>

      <Cartao className="p-4">
        <TabelaCodigos
          linhas={d.porCodigo}
          base={base}
          titulo="Detalhamento por código (1 a 100)"
          regime="competencia"
          empresaId={ctx.empresaId}
          ano={ctx.ano}
          mes={ctx.mes}
          lojaId={ctx.lojaId}
          qs={qs}
        />
      </Cartao>
    </main>
  );
}
