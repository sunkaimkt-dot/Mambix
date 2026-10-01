import { carregarContexto } from "@/lib/contexto";
import { lerBase } from "@/lib/relatorios-contabeis";
import { evolucaoDFC } from "@/lib/contabil-calculo";
import TelaEvolucao from "@/components/TelaEvolucao";

/**
 * Evolucao DFC (especificacao 5.8): o DFC dos 12 meses do ano lado a lado,
 * regime de caixa. Cada mes bate com o DFC daquele mes (npm run testar:relatorios).
 * Entradas sem filtro de loja, igual ao DFC atual.
 */
export default async function EvolucaoDFC({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const ev = evolucaoDFC(await lerBase(ctx.empresaId, ctx.ano, ctx.lojaId));

  return (
    <TelaEvolucao
      ev={ev}
      ctx={ctx}
      sp={sp}
      titulo="Evolução DFC"
      subtitulo={`${ctx.ano} — regime de caixa, mês a mês${ctx.lojaId ? " · entradas sem filtro de loja (igual ao DFC)" : ""}`}
      rotuloBase="entradas"
      regime="caixa"
      rota="/evolucao-dfc"
    />
  );
}
