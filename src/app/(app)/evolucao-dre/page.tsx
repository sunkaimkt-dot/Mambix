import { carregarContexto } from "@/lib/contexto";
import { lerBase } from "@/lib/relatorios-contabeis";
import { evolucaoDRE } from "@/lib/contabil-calculo";
import TelaEvolucao from "@/components/TelaEvolucao";

/**
 * Evolucao DRE (especificacao 5.7): a DRE Gerencial dos 12 meses do ano lado a
 * lado, regime de competencia. Cada mes bate com a DRE Gerencial daquele mes
 * (npm run testar:relatorios).
 */
export default async function EvolucaoDRE({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const ev = evolucaoDRE(await lerBase(ctx.empresaId, ctx.ano, ctx.lojaId));

  return (
    <TelaEvolucao
      ev={ev}
      ctx={ctx}
      sp={sp}
      titulo="Evolução DRE"
      subtitulo={`${ctx.ano} — regime de competência, mês a mês`}
      rotuloBase="faturamento"
      regime="competencia"
      rota="/evolucao-dre"
    />
  );
}
