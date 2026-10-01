import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { dadosFluxoDiario } from "@/lib/relatorios-diarios";
import Cabecalho from "@/components/Cabecalho";
import { Cartao } from "@/components/ui";
import { SEMANA_CURTA } from "@/components/GraficosPainel";
import { brl, MESES, CFC } from "@/lib/formato";

/*
 * Fluxo Diario (especificacao 5.3): o caixa do mes dia a dia, em regime de
 * caixa -- entradas = receitas pela data, saidas = baixas pela data do
 * pagamento. Os totais do mes batem com o DFC do mesmo mes.
 */
export default async function FluxoDiario({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const d = await dadosFluxoDiario(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId);
  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  ).toString();

  const avisoSaldo =
    d.origemSaldoInicial === "sem-saldo"
      ? "Nenhum saldo inicial informado para este mês — o fluxo começa em R$ 0,00 e mostra só a movimentação do mês."
      : d.origemSaldoInicial === "loja"
        ? "Com uma loja escolhida o saldo inicial não é usado (ele é por banco, da empresa toda). O fluxo mostra só a movimentação da loja."
        : null;

  const cor = (v: number) => (v > 0 ? "text-positivo" : v < 0 ? "text-negativo" : "text-slate-400");

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Fluxo Diário"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — regime de caixa, dia a dia (mesma base do DFC)`}
        ctx={ctx}
      />

      {avisoSaldo && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{avisoSaldo}</p>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { rotulo: "Saldo inicial", valor: d.saldoInicialMes, cls: "text-slate-900" },
          { rotulo: "Entradas", valor: d.entradas, cls: "text-positivo" },
          { rotulo: "Saídas", valor: d.saidas, cls: "text-negativo" },
          { rotulo: "Saldo final", valor: d.saldoFinal, cls: d.saldoFinal >= 0 ? "text-positivo" : "text-negativo" },
        ].map((c) => (
          <Cartao key={c.rotulo} className="p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{c.rotulo}</p>
            <p className={`text-xl font-bold tabular-nums ${c.cls}`}>{brl(c.valor)}</p>
          </Cartao>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Cartao className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Dia</th>
                <th className="px-3 py-2 text-right">Saldo inicial</th>
                <th className="px-3 py-2 text-right">Entradas</th>
                <th className="px-3 py-2 text-right">Saídas</th>
                <th className="px-3 py-2 text-right">Saldo do dia</th>
                <th className="px-3 py-2 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.linhas.map((l) => {
                const parado = l.entradas === 0 && l.saidas === 0;
                const fimDeSemana = l.diaSemana === 0 || l.diaSemana === 6;
                return (
                  <tr key={l.dia} className={`${parado ? "text-slate-400" : ""} ${fimDeSemana ? "bg-slate-50/60" : ""}`}>
                    <td className="px-3 py-1.5 tabular-nums">
                      {String(l.dia).padStart(2, "0")}
                      <span className="ml-1.5 text-xs text-slate-400">{SEMANA_CURTA[l.diaSemana]}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{brl(l.saldoInicial)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{l.entradas ? <span className="text-positivo">{brl(l.entradas)}</span> : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{l.saidas ? <span className="text-negativo">{brl(l.saidas)}</span> : "—"}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${parado ? "" : cor(l.saldoDia)}`}>{parado ? "—" : brl(l.saldoDia)}</td>
                    <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${l.acumulado < 0 ? "text-negativo" : "text-slate-900"}`}>
                      {brl(l.acumulado)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold">
              <tr>
                <td className="px-3 py-2">Total do mês</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(d.saldoInicialMes)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-positivo">{brl(d.entradas)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-negativo">{brl(d.saidas)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${cor(d.entradas - d.saidas)}`}>{brl(d.entradas - d.saidas)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${d.saldoFinal < 0 ? "text-negativo" : ""}`}>{brl(d.saldoFinal)}</td>
              </tr>
            </tfoot>
          </table>
        </Cartao>

        <div className="space-y-6">
          <Cartao className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Saídas por CFC</p>
            <ul className="space-y-1 text-sm">
              {d.porCFC.map((c) => (
                <li key={c.cfc} className="flex justify-between">
                  <span className="text-slate-600">{CFC.find((x) => x.codigo === c.cfc)?.nome}</span>
                  <span className="font-medium tabular-nums">{brl(c.total)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{brl(d.porCFC.reduce((s, c) => s + c.total, 0))}</span>
              </li>
            </ul>
          </Cartao>

          <Cartao className="p-4 text-xs leading-relaxed text-slate-500">
            <p className="mb-1 font-semibold text-slate-600">Como ler</p>
            <p>
              Entradas vêm da tela Receitas (pela data); saídas, das baixas de pagamento (pela data em que o
              dinheiro saiu). Com todas as lojas, os totais do mês são os mesmos do{" "}
              <Link href={`/dfc${qs ? `?${qs}` : ""}`} className="font-medium text-marca hover:underline">
                Fluxo de Caixa (DFC)
              </Link>
              . Com uma loja escolhida, aqui as entradas também são filtradas pela loja (no DFC, hoje, não são).
            </p>
          </Cartao>
        </div>
      </div>
    </main>
  );
}
