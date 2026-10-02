import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { carregarBaseSimulador, PERIODOS_BASE } from "@/lib/simulador-dados";
import Cabecalho from "@/components/Cabecalho";
import { MESES_CURTO, MESES } from "@/lib/formato";
import Simulador from "./Simulador";

export default async function PaginaSimulador({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const pedido = Number(sp.n);
  const n = (PERIODOS_BASE as readonly number[]).includes(pedido) ? pedido : 1;
  const base = await carregarBaseSimulador(ctx.empresaId, ctx.ano, ctx.mes, n, ctx.lojaId);

  const qs = (novoN: number) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    p.set("n", String(novoN));
    return `?${p.toString()}`;
  };
  const rotuloMeses = (ms: { ano: number; mes: number }[]) => ms.map((m) => `${MESES_CURTO[m.mes - 1]}/${String(m.ano).slice(2)}`).join(", ");

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Simulador de cenários"
        subtitulo={`E se…? Base: ${n === 1 ? `${MESES[ctx.mes - 1]}/${ctx.ano}` : `média de até ${n} meses até ${MESES_CURTO[ctx.mes - 1]}/${ctx.ano}`}`}
        ctx={ctx}
      />

      <div data-tour="base" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Base:</span>
        {PERIODOS_BASE.map((p) => (
          <Link
            key={p}
            href={qs(p)}
            className={`rounded-lg border px-3 py-1 ${p === n ? "border-marca bg-marca-clara font-medium text-marca" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {p === 1 ? "só o mês" : `média ${p} meses`}
          </Link>
        ))}
      </div>

      {(base.dre.excluidos.length > 0 || base.dfc.excluidos.length > 0) && n > 1 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {base.dre.excluidos.length > 0 && (
            <p>
              <strong>DRE</strong> — fora da média: {base.dre.excluidos.map((x) => `${MESES_CURTO[x.mes - 1]}/${String(x.ano).slice(2)} (${x.motivo})`).join(", ")}.
              {base.dre.meses.length > 0 && ` Média de ${base.dre.meses.length} mês(es): ${rotuloMeses(base.dre.meses)}.`}
            </p>
          )}
          {base.dfc.excluidos.length > 0 && (
            <p>
              <strong>DFC</strong> — fora da média: {base.dfc.excluidos.map((x) => `${MESES_CURTO[x.mes - 1]}/${String(x.ano).slice(2)} (${x.motivo})`).join(", ")}.
              {base.dfc.meses.length > 0 && ` Média de ${base.dfc.meses.length} mês(es): ${rotuloMeses(base.dfc.meses)}.`}
            </p>
          )}
        </div>
      )}

      <Simulador
        key={`${ctx.empresaId}-${ctx.ano}-${ctx.mes}-${n}-${ctx.lojaId ?? ""}`}
        baseDRE={base.dre}
        baseDFC={base.dfc}
        semMargemNoMes={base.dre.semMargem}
        lojaEscolhida={!!ctx.lojaId}
      />
    </main>
  );
}
