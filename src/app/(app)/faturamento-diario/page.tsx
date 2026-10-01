import { carregarContexto } from "@/lib/contexto";
import { dadosFaturamentoDiario } from "@/lib/relatorios-diarios";
import Cabecalho from "@/components/Cabecalho";
import { Cartao } from "@/components/ui";
import { BarrasHorizontais, GraficoDiario, SEMANA_CURTA } from "@/components/GraficosPainel";
import { brl, MESES, MESES_CURTO } from "@/lib/formato";

/*
 * Faturamento Diario (especificacao 5.4): o que foi VENDIDO por dia, vindo do
 * Caixa Diario (tipo de venda) -- a mesma base do faturamento da DRE. Nao usa
 * Receitas: receita e o que entrou no caixa, faturamento e o que foi vendido.
 */
const SEMANA_LONGA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function FaturamentoDiario({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const d = await dadosFaturamentoDiario(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId);
  const ant = d.comparacao.mesAnterior;
  const rotuloAnt = `${MESES_CURTO[ant.mes - 1]}/${ant.ano}`;
  const variacao = d.comparacao.anterior ? d.comparacao.atual / d.comparacao.anterior - 1 : null;
  const tiposComValor = d.tipos.filter((t) => t.total !== 0);
  // Segunda a domingo, que e como o comercio le a semana.
  const ordemSemana = [1, 2, 3, 4, 5, 6, 0];

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Faturamento Diário"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — vendas do Caixa Diário, dia a dia`}
        ctx={ctx}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao className="p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Faturamento do mês</p>
          <p className="text-xl font-bold tabular-nums">{brl(d.total)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Média diária</p>
          <p className="text-xl font-bold tabular-nums">{brl(d.mediaDiaria)}</p>
          <p className="text-xs text-slate-500">{d.diasComVenda} dia{d.diasComVenda === 1 ? "" : "s"} com venda</p>
        </Cartao>
        <Cartao className="p-4 sm:col-span-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Comparação com {rotuloAnt} (dia 1 ao {d.comparacao.ateDia})
          </p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-xl font-bold tabular-nums">{brl(d.comparacao.atual)}</p>
            <p className="text-sm text-slate-500 tabular-nums">contra {brl(d.comparacao.anterior)}</p>
            {variacao !== null ? (
              <p className={`text-sm font-semibold tabular-nums ${variacao >= 0 ? "text-positivo" : "text-negativo"}`}>
                {variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </p>
            ) : (
              <p className="text-sm text-slate-400">sem vendas em {rotuloAnt} para comparar</p>
            )}
          </div>
        </Cartao>
      </section>

      <Cartao className="mb-6 p-4">
        <GraficoDiario
          valores={d.linhas.map((l) => l.total)}
          diasSemana={d.linhas.map((l) => l.diaSemana)}
          anteriores={d.linhas.map((l) => l.totalMesAnterior)}
          rotuloSerie={`Faturamento ${MESES_CURTO[ctx.mes - 1]}/${ctx.ano}`}
          rotuloAnterior={`Mesmo dia em ${rotuloAnt}`}
          vazio="Nenhuma venda lançada no Caixa Diário neste mês."
        />
      </Cartao>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao className="p-4">
          <p className="mb-1 text-sm font-semibold">Média por dia da semana</p>
          <p className="mb-3 text-xs text-slate-500">Considera só os dias com venda lançada.</p>
          <BarrasHorizontais
            vazio="Nenhuma venda no mês."
            itens={ordemSemana.map((i) => {
              const m = d.mediaPorDiaSemana[i];
              return { rotulo: SEMANA_LONGA[i], valor: m.media, detalhe: m.dias ? `${m.dias} dia${m.dias > 1 ? "s" : ""}` : undefined, cor: "#059669" };
            })}
          />
        </Cartao>
        <Cartao className="p-4">
          <p className="mb-1 text-sm font-semibold">Por tipo de venda</p>
          <p className="mb-3 text-xs text-slate-500">% sobre o faturamento do mês.</p>
          <BarrasHorizontais
            vazio="Nenhuma venda no mês."
            itens={d.tipos.map((t) => ({
              rotulo: t.nome,
              valor: t.total,
              detalhe: d.total ? `${((t.total / d.total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : undefined,
            }))}
          />
        </Cartao>
      </div>

      <Cartao className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Dia</th>
              {tiposComValor.map((t) => (
                <th key={t.codigo} className="px-3 py-2 text-right">{t.nome}</th>
              ))}
              <th className="px-3 py-2 text-right">Total do dia</th>
              <th className="px-3 py-2 text-right">Acumulado</th>
              <th className="px-3 py-2 text-right">{rotuloAnt}</th>
              <th className="px-3 py-2 text-right">Acum. {rotuloAnt}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.linhas.map((l) => {
              const fimDeSemana = l.diaSemana === 0 || l.diaSemana === 6;
              return (
                <tr key={l.dia} className={`${l.total ? "" : "text-slate-400"} ${fimDeSemana ? "bg-slate-50/60" : ""}`}>
                  <td className="px-3 py-1.5 tabular-nums">
                    {String(l.dia).padStart(2, "0")}
                    <span className="ml-1.5 text-xs text-slate-400">{SEMANA_CURTA[l.diaSemana]}</span>
                  </td>
                  {tiposComValor.map((t) => (
                    <td key={t.codigo} className="px-3 py-1.5 text-right tabular-nums">
                      {l.porTipo[t.codigo] ? brl(l.porTipo[t.codigo]) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">{l.total ? brl(l.total) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{brl(l.acumulado)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                    {l.totalMesAnterior === null ? "" : l.totalMesAnterior ? brl(l.totalMesAnterior) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                    {l.acumuladoMesAnterior === null ? "" : brl(l.acumuladoMesAnterior)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 font-semibold">
            <tr>
              <td className="px-3 py-2">Total</td>
              {tiposComValor.map((t) => (
                <td key={t.codigo} className="px-3 py-2 text-right tabular-nums">{brl(t.total)}</td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums">{brl(d.total)}</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                {brl(d.totalMesAnterior)}
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </Cartao>
    </main>
  );
}
