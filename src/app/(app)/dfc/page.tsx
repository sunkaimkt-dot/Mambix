import { carregarContexto } from "@/lib/contexto";
import { dadosDFC } from "@/lib/relatorios";
import Cabecalho from "@/components/Cabecalho";
import TabelaCodigos from "@/components/TabelaCodigos";
import { Cartao } from "@/components/ui";
import { brl, MESES, CFC } from "@/lib/formato";

export default async function DFC({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const d = await dadosDFC(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId);
  const base = d.entradas;

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Fluxo de Caixa (DFC)"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — regime de caixa (só o que entrou e saiu de fato)`}
        ctx={ctx}
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao className="p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Entradas</p>
            <p className="text-lg font-bold text-emerald-700">{brl(d.entradas)}</p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {d.porTipoRecebimento.map((t) => (
                <tr key={t.codigo} className={t.valor ? "" : "text-slate-300"}>
                  <td className="py-1">{t.nome}</td>
                  <td className="py-1 text-right tabular-nums">{brl(t.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>

        <Cartao className="p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Saídas por grupo</p>
            <p className="text-lg font-bold text-red-700">{brl(d.saidas)}</p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {d.grupos.map((g) => (
                <tr key={g.chave} className={g.total ? "" : "text-slate-300"}>
                  <td className="py-1">{g.rotulo}</td>
                  <td className="py-1 text-right tabular-nums">{brl(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Cartao className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Entradas</p>
              <p className="text-lg font-bold text-emerald-700">{brl(d.entradas)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saídas</p>
              <p className="text-lg font-bold text-red-700">{brl(d.saidas)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resultado do mês</p>
              <p className={`text-lg font-bold ${d.resultado >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {brl(d.resultado)}
              </p>
            </div>
          </div>
        </Cartao>

        <Cartao className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Saídas por CFC</p>
          <ul className="space-y-1 text-sm">
            {d.porCFC.map((c) => (
              <li key={c.cfc} className="flex justify-between">
                <span className="text-slate-600">{CFC.find((x) => x.codigo === c.cfc)?.nome}</span>
                <span className="font-medium tabular-nums">{brl(c.total)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>

      <Cartao className="p-4">
        <TabelaCodigos linhas={d.porCodigo} base={base} titulo="Detalhamento por código (1 a 100)" />
      </Cartao>
    </main>
  );
}
