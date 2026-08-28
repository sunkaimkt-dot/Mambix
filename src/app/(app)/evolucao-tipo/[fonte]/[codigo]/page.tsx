import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { serieAnualTipo } from "@/lib/relatorios";
import Cabecalho from "@/components/Cabecalho";
import GraficoAnual from "@/components/GraficoAnual";
import { Cartao } from "@/components/ui";

/**
 * Evolucao anual de um tipo de venda (faturamento, DRE) ou tipo de recebimento
 * (entrada de caixa, DFC). Chega-se aqui clicando na tabela "Por tipo de
 * venda/recebimento" da DRE ou do DFC. Ao contrario de /evolucao e
 * /evolucao-grupo, aqui nao ha alternancia de regime: cada fonte pertence a
 * um unico relatorio (venda -> DRE, recebimento -> DFC).
 */
export default async function EvolucaoTipo({
  params,
  searchParams,
}: {
  params: Promise<{ fonte: string; codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { fonte: fonteTxt, codigo: codigoTxt } = await params;
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const fonte = fonteTxt === "recebimento" ? "recebimento" : "venda";
  const codigo = Number(codigoTxt);
  const serie = await serieAnualTipo(ctx.empresaId, fonte, codigo, ctx.ano, ctx.lojaId);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  );
  const voltarPara = fonte === "recebimento" ? "/dfc" : "/dre";

  return (
    <main className="p-6">
      <Cabecalho
        titulo={`${codigo} — ${serie.nome || "(sem nome)"}`}
        subtitulo={
          fonte === "recebimento"
            ? `Entradas de caixa em ${ctx.ano} — pelo mês em que o dinheiro entrou`
            : `Faturamento em ${ctx.ano} — pelo mês da venda`
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
      </div>

      <Cartao className="p-4">
        <GraficoAnual serie={{ ...serie, titulo: `${codigo} - ${serie.nome}` }} />
      </Cartao>
    </main>
  );
}
