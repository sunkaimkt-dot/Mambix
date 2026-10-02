import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import Cabecalho from "@/components/Cabecalho";
import { Cartao } from "@/components/ui";
import { brl, MESES, MESES_CURTO } from "@/lib/formato";
import { seriesGraficos } from "@/lib/graficos-dados";
import { comparativo, totalEMedia, type Indicador, type SerieAno } from "@/lib/graficos-calculo";
import { ColunasPorMes, LinhasPorAno, type Serie } from "@/components/GraficosComparativos";

/**
 * Graficos (especificacao 5.9): faturamento e lucro liquido.
 * Evolucao 12 meses, comparativos (mes anterior, mesmo mes do ano anterior,
 * acumulado x ano anterior), ticket medio, numero de clientes e anos anteriores.
 */
export default async function Graficos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const ind: Indicador = sp.ind === "lucro" ? "lucro" : "faturamento";
  const series = await seriesGraficos(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId);
  const doAno = series.find((s) => s.ano === ctx.ano)!;
  const doAnoAnterior = series.find((s) => s.ano === ctx.ano - 1);

  const comp = comparativo(series, ctx.ano, ctx.mes, ind);
  const compTicket = comparativo(series, ctx.ano, ctx.mes, "ticket");
  const compClientes = comparativo(series, ctx.ano, ctx.mes, "clientes");

  const nomeInd = ind === "lucro" ? "Lucro líquido" : "Faturamento";
  const paraSerie = (s: SerieAno, campo: keyof Omit<SerieAno, "ano">): Serie => ({
    rotulo: String(s.ano),
    valores: s[campo],
    destaque: s.ano === ctx.ano,
  });

  const anoContraAno = [doAnoAnterior, doAno].filter((s): s is SerieAno => !!s).map((s) => paraSerie(s, ind));
  const todosAnos = series.map((s) => paraSerie(s, ind));

  const semMargem = ind === "lucro" && doAno.lucro.slice(0, ctx.mes).some((v) => v === null);
  const semClientes = doAno.clientes.slice(0, ctx.mes).every((v) => v === null);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
    );
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `?${p.toString()}`;
  };

  const ref = `${MESES_CURTO[ctx.mes - 1]}/${ctx.ano}`;
  const mesAntRef = ctx.mes === 1 ? `DEZ/${ctx.ano - 1}` : `${MESES_CURTO[ctx.mes - 2]}/${ctx.ano}`;
  const anoAntRef = `${MESES_CURTO[ctx.mes - 1]}/${ctx.ano - 1}`;

  return (
    <main className="p-6">
      <Cabecalho titulo="Gráficos" subtitulo={`${nomeInd} — referência ${MESES[ctx.mes - 1]}/${ctx.ano}`} ctx={ctx} />

      <div className="mb-6 flex gap-1.5">
        {(["faturamento", "lucro"] as const).map((i) => (
          <Link
            key={i}
            href={qs({ ind: i })}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              ind === i ? "bg-marca-clara font-medium text-marca" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {i === "lucro" ? "Lucro líquido" : "Faturamento"}
          </Link>
        ))}
      </div>

      {semMargem && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Alguns meses estão sem margem bruta em Parâmetros do mês. Sem ela não dá para calcular o lucro, e esses meses
          aparecem vazios.
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicadores titulo={`${nomeInd} — ${ref}`} valor={comp.atual} />
        <Indicadores titulo={`x mês anterior (${mesAntRef})`} valor={comp.mesAnterior} variacao={comp.varMesAnterior} />
        <Indicadores titulo={`x mesmo mês do ano anterior (${anoAntRef})`} valor={comp.mesmoMesAnoAnterior} variacao={comp.varAnoAnterior} />
        <Indicadores
          titulo={`Acumulado JAN–${MESES_CURTO[ctx.mes - 1]}/${ctx.ano}`}
          valor={comp.acumulado}
          variacao={comp.varAcumulado}
          nota={comp.acumuladoAnoAnterior !== null ? `${ctx.ano - 1}: ${brl(comp.acumuladoAnoAnterior)}` : undefined}
        />
      </div>

      <Cartao className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {nomeInd} mês a mês — {ctx.ano} x {ctx.ano - 1}
        </h2>
        <ColunasPorMes series={anoContraAno} />
      </Cartao>

      <Cartao className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold">{nomeInd} — anos anteriores</h2>
        <LinhasPorAno series={todosAnos} />
      </Cartao>

      {ind === "faturamento" && (
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Cartao className="p-4">
            <h2 className="mb-1 text-sm font-semibold">Ticket médio</h2>
            <p className="mb-3 text-xs text-slate-500">
              Faturamento ÷ número de clientes. {ref}: <strong>{fmtOuTraco(compTicket.atual)}</strong>
              {compTicket.varMesAnterior !== null && <> ({sinal(compTicket.varMesAnterior)} x mês anterior)</>}
            </p>
            <ColunasPorMes
              series={[doAnoAnterior, doAno].filter((s): s is SerieAno => !!s).map((s) => paraSerie(s, "ticket"))}
              vazio="Informe o número de clientes em Parâmetros do mês para ver o ticket médio."
            />
          </Cartao>
          <Cartao className="p-4">
            <h2 className="mb-1 text-sm font-semibold">Número de clientes</h2>
            <p className="mb-3 text-xs text-slate-500">
              {ref}: <strong>{compClientes.atual ?? "—"}</strong>
              {compClientes.varMesAnterior !== null && <> ({sinal(compClientes.varMesAnterior)} x mês anterior)</>}
            </p>
            <ColunasPorMes
              series={[doAnoAnterior, doAno].filter((s): s is SerieAno => !!s).map((s) => paraSerie(s, "clientes"))}
              vazio="Informe o número de clientes em Parâmetros do mês."
              formato={(v) => (v === null ? "—" : String(v))}
            />
            {semClientes && (
              <p className="mt-2 text-xs text-slate-400">Nenhum mês deste ano tem número de clientes informado.</p>
            )}
          </Cartao>
        </div>
      )}

      <Cartao className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Mês</th>
              {series.map((s) => (
                <th key={s.ano} className="px-3 py-2 text-right">{s.ano}</th>
              ))}
              <th className="px-3 py-2 text-right">{ctx.ano} x {ctx.ano - 1}</th>
            </tr>
          </thead>
          <tbody>
            {MESES_CURTO.map((m, i) => {
              const a = doAno[ind][i];
              const b = doAnoAnterior?.[ind][i] ?? null;
              const v = a !== null && b !== null && b !== 0 ? (a - b) / Math.abs(b) : null;
              return (
                <tr key={m} className="border-b border-slate-100">
                  <td className="px-3 py-1.5 font-medium">{m}</td>
                  {series.map((s) => (
                    <td key={s.ano} className="px-3 py-1.5 text-right tabular-nums">{fmtOuTraco(s[ind][i])}</td>
                  ))}
                  <td className={`px-3 py-1.5 text-right tabular-nums ${corVar(v)}`}>{v === null ? "—" : sinal(v)}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="px-3 py-2">Total</td>
              {series.map((s) => (
                <td key={s.ano} className="px-3 py-2 text-right tabular-nums">{fmtOuTraco(totalEMedia(s[ind]).total)}</td>
              ))}
              <td />
            </tr>
            <tr className="text-slate-500">
              <td className="px-3 pb-2">Média/mês</td>
              {series.map((s) => (
                <td key={s.ano} className="px-3 pb-2 text-right tabular-nums">{fmtOuTraco(totalEMedia(s[ind]).media)}</td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </Cartao>
    </main>
  );
}

const fmtOuTraco = (v: number | null) => (v === null ? "—" : brl(v));
const sinal = (v: number) =>
  `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
const corVar = (v: number | null) => (v === null ? "text-slate-400" : v > 0 ? "text-positivo" : v < 0 ? "text-negativo" : "");

function Indicadores({ titulo, valor, variacao, nota }: { titulo: string; valor: number | null; variacao?: number | null; nota?: string }) {
  return (
    <Cartao className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{fmtOuTraco(valor)}</p>
      {variacao !== undefined && (
        <p className={`text-xs tabular-nums ${corVar(variacao)}`}>
          {variacao === null ? "sem base para comparar" : `variação: ${sinal(variacao)}`}
        </p>
      )}
      {nota && <p className="text-xs text-slate-400">{nota}</p>}
    </Cartao>
  );
}
