import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { lerBase, lerLucroDesejavel } from "@/lib/relatorios-contabeis";
import { calcularDREContabil, calcularDREMes, LUCRO_DESEJAVEL_PADRAO, MAPA_DRE_CONTABIL } from "@/lib/contabil-calculo";
import Cabecalho from "@/components/Cabecalho";
import CabecalhoImpressao from "@/components/CabecalhoImpressao";
import BotaoImprimir from "@/components/BotaoImprimir";
import CampoLucroDesejavel from "@/components/CampoLucroDesejavel";
import { DemonstrativoContabil, Equilibrio, type LinhaDemo } from "@/components/DemonstrativoContabil";
import { Cartao } from "@/components/ui";
import { MESES } from "@/lib/formato";

const lista = (cs: number[]) => (cs.length > 3 && cs[cs.length - 1] - cs[0] === cs.length - 1 ? `${cs[0]}–${cs[cs.length - 1]}` : cs.join(", "));

/**
 * DRE Contabil (especificacao 5.5): a mesma DRE Gerencial do mes, em regime de
 * competencia, arrumada no formato de apresentacao. O Resultado Liquido daqui e
 * sempre igual ao Resultado da DRE Gerencial (o teste confere).
 */
export default async function DREContabil({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const ld = lerLucroDesejavel(sp, LUCRO_DESEJAVEL_PADRAO);
  const base = await lerBase(ctx.empresaId, ctx.ano, ctx.lojaId, ctx.mes, ctx.mes);
  const d = calcularDREContabil(calcularDREMes(base, ctx.mes), ld);
  const m = MAPA_DRE_CONTABIL;

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  ).toString();
  const periodo = `${MESES[ctx.mes - 1]}/${ctx.ano}`;

  const linhas: LinhaDemo[] = [
    { rotulo: "Receita Bruta (faturamento)", valor: d.receitaBruta, tipo: "total", nota: "Caixa Diário" },
    { rotulo: "(−) Impostos sobre vendas", valor: -d.impostosSobreVendas, nota: `códigos ${lista(m.impostosSobreVendas)}` },
    { rotulo: "(−) Descontos concedidos", valor: -d.descontos, nota: `código ${lista(m.descontos)}` },
    { rotulo: "(−) Devoluções", valor: -d.devolucoes, nota: `código ${lista(m.devolucoes)}` },
    { rotulo: "(=) Receita Líquida", valor: d.receitaLiquida, tipo: "subtotal" },
    { rotulo: "(−) CMV / CPV", valor: -d.cmv, nota: d.margem ? "faturamento × (1 − margem bruta)" : "margem bruta não informada" },
    { rotulo: "(−) Custos variáveis", valor: -d.custosVariaveis, nota: `códigos ${lista(m.custosVariaveis)}` },
    { rotulo: "(=) Lucro Bruto / Margem de Contribuição", valor: d.margemContribuicao, tipo: "subtotal" },
    ...d.despesas.map((g, i) => ({
      rotulo: `(−) ${g.rotulo}`,
      valor: -g.total,
      nota: `códigos ${lista(m.despesas[i].codigos)}`,
    })),
    { rotulo: "(=) Resultado Operacional", valor: d.resultadoOperacional, tipo: "subtotal" },
    { rotulo: "(−) IR / CSLL", valor: -d.irCsll, nota: `códigos ${lista(m.irCsll)}` },
    { rotulo: "(=) Resultado Líquido", valor: d.resultadoLiquido, tipo: "final" },
  ];

  return (
    <main className="p-6">
      <Cabecalho titulo="DRE Contábil" subtitulo={`${periodo} — regime de competência, formato de apresentação`} ctx={ctx} />
      <CabecalhoImpressao ctx={ctx} titulo="DRE Contábil — regime de competência" periodo={periodo} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <CampoLucroDesejavel sp={sp} valor={ld} />
        <BotaoImprimir />
      </div>

      {d.margem === 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A <strong>margem bruta</strong> deste mês não foi informada, então o CMV aparece igual ao faturamento.
          Defina em{" "}
          <Link href={`/parametros${qs ? `?${qs}` : ""}`} className="font-semibold underline">
            Parâmetros do mês
          </Link>
          .
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Cartao tour="demonstrativo" className="p-4">
          <DemonstrativoContabil linhas={linhas} base={d.receitaBruta} />
        </Cartao>
        <div className="space-y-4">
          <Cartao tour="equilibrio" className="p-4 avoid-break">
            <Equilibrio
              e={d.equilibrio}
              rotuloFixos="Despesas operacionais"
              fixos={d.totalDespesas}
              receitaAtual={d.receitaBruta}
            />
          </Cartao>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Mesma base da DRE Gerencial: o Resultado Líquido aqui é igual ao Resultado de lá — só muda a arrumação das
            linhas. Investimentos, estoque e retirada de sócio não entram (aparecem no Fluxo Contábil).
          </p>
        </div>
      </div>
    </main>
  );
}
