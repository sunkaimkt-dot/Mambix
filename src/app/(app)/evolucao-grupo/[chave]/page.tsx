import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { serieAnualGrupo } from "@/lib/relatorios";
import Cabecalho from "@/components/Cabecalho";
import GraficoAnual from "@/components/GraficoAnual";
import { Cartao } from "@/components/ui";

/**
 * Evolucao anual de um GRUPO de despesas (ex.: "INVESTIMENTOS", "FIXAS").
 * Chega-se aqui clicando no grupo na tabela "Total por grupo" da DRE ou do DFC.
 * Mesma logica de /evolucao/[codigo], so trocando codigo por faixa de codigos.
 */
export default async function EvolucaoGrupo({
  params,
  searchParams,
}: {
  params: Promise<{ chave: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { chave } = await params;
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const regime = sp.regime === "caixa" ? "caixa" : "competencia";
  const serie = await serieAnualGrupo(ctx.empresaId, chave, ctx.ano, regime, ctx.lojaId);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => k !== "regime" && typeof v === "string") as [string, string][]
  );
  const qsOutro = new URLSearchParams(qs);
  qsOutro.set("regime", regime === "caixa" ? "competencia" : "caixa");
  const voltarPara = regime === "caixa" ? "/dfc" : "/dre";

  return (
    <main className="p-6">
      <Cabecalho
        titulo={serie.rotulo}
        subtitulo={
          regime === "caixa"
            ? `Saídas de caixa em ${ctx.ano} — pelo mês em que o dinheiro saiu`
            : `Competência em ${ctx.ano} — pelo mês a que a despesa se refere`
        }
        ctx={ctx}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`${voltarPara}?${qs.toString()}`}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          ← Voltar
        </Link>
        <Link
          href={`/evolucao-grupo/${chave}?${qsOutro.toString()}`}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Ver por {regime === "caixa" ? "competência" : "caixa"}
        </Link>
      </div>

      <Cartao className="p-4">
        <GraficoAnual serie={{ ...serie, titulo: serie.rotulo }} />
      </Cartao>

      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-slate-500">
        <strong>Competência</strong> mostra o mês a que as despesas do grupo pertencem, tenham sido pagas ou não.
        <strong> Caixa</strong> mostra o mês em que o dinheiro efetivamente saiu. Quando as duas curvas
        diferem, há conta sendo paga fora do mês de vencimento.
      </p>
    </main>
  );
}
