import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { lerBase, lerLucroDesejavel } from "@/lib/relatorios-contabeis";
import {
  calcularDFCMes,
  calcularFluxoContabil,
  saldoInicialDoMes,
  LUCRO_DESEJAVEL_PADRAO,
} from "@/lib/contabil-calculo";
import Cabecalho from "@/components/Cabecalho";
import CabecalhoImpressao from "@/components/CabecalhoImpressao";
import BotaoImprimir from "@/components/BotaoImprimir";
import CampoLucroDesejavel from "@/components/CampoLucroDesejavel";
import { DemonstrativoContabil, Equilibrio, type LinhaDemo } from "@/components/DemonstrativoContabil";
import { Cartao } from "@/components/ui";
import { brl, MESES } from "@/lib/formato";

/**
 * Fluxo Contabil (especificacao 5.6): o DFC do mes, em regime de caixa, no
 * formato de apresentacao. As saidas sao classificadas pelo CFC que o consultor
 * escolheu em cada pagamento (1 fixa, 2 variavel, 3 nao operacional,
 * 4 investimento). O Resultado Liquido e sempre Entradas - Saidas do DFC.
 */
export default async function FluxoContabil({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const ld = lerLucroDesejavel(sp, LUCRO_DESEJAVEL_PADRAO);
  const base = await lerBase(ctx.empresaId, ctx.ano, ctx.lojaId, ctx.mes, ctx.mes);
  // Saldo inicial: mesma fonte do Fluxo Diario (Combo 1). E por banco, da
  // empresa toda -- com uma loja escolhida nao faz sentido somar.
  const saldoInicial = ctx.lojaId ? 0 : saldoInicialDoMes(base, ctx.mes);
  const f = calcularFluxoContabil(calcularDFCMes(base, ctx.mes), base.receitas, ctx.mes, saldoInicial, ld);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  ).toString();
  const periodo = `${MESES[ctx.mes - 1]}/${ctx.ano}`;

  const linhas: LinhaDemo[] = [
    { rotulo: "(+) Receitas operacionais", valor: f.receitasOperacionais, tipo: "total", nota: "recebimentos tipos 1–8" },
    { rotulo: "(−) Custo variável", valor: -f.custoVariavel, nota: "CFC 2" },
    { rotulo: "(=) Margem de Contribuição", valor: f.margemContribuicao, tipo: "subtotal" },
    { rotulo: "(−) Despesas fixas", valor: -f.despesasFixas, nota: "CFC 1" },
    { rotulo: "(=) LOAI — lucro operacional antes dos investimentos", valor: f.loai, tipo: "subtotal" },
    { rotulo: "(−) Investimentos", valor: -f.investimentos, nota: "CFC 4" },
    { rotulo: "(=) Lucro Operacional", valor: f.lucroOperacional, tipo: "subtotal" },
    { rotulo: "(+) Entradas não operacionais", valor: f.entradasNaoOperacionais, nota: "recebimentos tipos 9–12" },
    { rotulo: "(−) Saídas não operacionais", valor: -f.saidasNaoOperacionais, nota: "CFC 3" },
    { rotulo: "(=) Resultado Líquido do mês", valor: f.resultadoLiquido, tipo: "final" },
  ];

  return (
    <main className="p-6">
      <Cabecalho titulo="Fluxo Contábil" subtitulo={`${periodo} — regime de caixa, formato de apresentação`} ctx={ctx} />
      <CabecalhoImpressao ctx={ctx} titulo="Fluxo Contábil — regime de caixa" periodo={periodo} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <CampoLucroDesejavel sp={sp} valor={ld} />
        <BotaoImprimir />
      </div>

      {ctx.lojaId ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Com uma loja escolhida o <strong>saldo inicial</strong> não é usado: ele é por banco, da empresa toda. As
          entradas também não são filtradas por loja (mesma regra do DFC atual).
        </div>
      ) : (
        f.saldoInicial === 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            O <strong>saldo inicial</strong> deste mês está zerado (nenhuma tela grava esse campo ainda), então o saldo
            final mostra só o resultado do mês.{" "}
            <Link href={`/dfc${qs ? `?${qs}` : ""}`} className="font-semibold underline">
              Ver o DFC
            </Link>
            .
          </div>
        )
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Cartao className="p-4">
          <DemonstrativoContabil linhas={linhas} base={f.receitasOperacionais} />
          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-3">
            {[
              { r: "Saldo inicial", v: f.saldoInicial },
              { r: "Resultado do mês", v: f.resultadoLiquido },
              { r: "Saldo final", v: f.saldoFinal },
            ].map((c) => (
              <div key={c.r}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.r}</p>
                <p className={`text-lg font-bold tabular-nums ${c.v < 0 ? "text-negativo" : "text-slate-900"}`}>{brl(c.v)}</p>
              </div>
            ))}
          </div>
        </Cartao>
        <div className="space-y-4">
          <Cartao className="p-4 avoid-break">
            <Equilibrio
              e={f.equilibrio}
              rotuloFixos="Despesas fixas"
              fixos={f.despesasFixas}
              receitaAtual={f.receitasOperacionais}
            />
          </Cartao>
          <p className="text-[11px] leading-relaxed text-slate-500">
            As saídas seguem o <strong>CFC</strong> escolhido em cada pagamento. O Resultado Líquido é igual a
            Entradas − Saídas do DFC do mês.
          </p>
        </div>
      </div>
    </main>
  );
}
