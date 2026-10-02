import Link from "next/link";
import type { Evolucao, LinhaEvolucao } from "@/lib/contabil-calculo";
import type { Contexto } from "@/lib/contexto";
import Cabecalho from "@/components/Cabecalho";
import CabecalhoImpressao from "@/components/CabecalhoImpressao";
import BotaoImprimir from "@/components/BotaoImprimir";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import { Cartao } from "@/components/ui";
import { MESES_CURTO, num, pct } from "@/lib/formato";

/**
 * Tela comum da Evolucao DRE e da Evolucao DFC: grafico + tabela de 12 meses,
 * total e media, em R$ ou em % da base (faturamento na DRE, entradas no DFC).
 * Clicar numa linha abre a evolucao daquele codigo / grupo / tipo, que ja existe.
 */
export default function TelaEvolucao({
  ev,
  ctx,
  sp,
  titulo,
  subtitulo,
  rotuloBase,
  regime,
  rota,
}: {
  ev: Evolucao;
  ctx: Contexto;
  sp: Record<string, string | string[] | undefined>;
  titulo: string;
  subtitulo: string;
  rotuloBase: string;
  regime: "competencia" | "caixa";
  rota: string;
}) {
  const emPct = sp.modo === "pct";
  const todosCodigos = sp.codigos === "todos";

  const params = Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][];
  const link = (troca: Record<string, string | null>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(troca)) (v === null ? q.delete(k) : q.set(k, v));
    const s = q.toString();
    return `${rota}${s ? `?${s}` : ""}`;
  };
  // Destino do clique: leva empresa/loja/ano, sem os controles desta tela.
  const qsDestino = new URLSearchParams(params.filter(([k]) => !["modo", "codigos", "regime"].includes(k)));
  if (regime === "caixa") qsDestino.set("regime", "caixa");
  const destino = (l: LinhaEvolucao) => (l.link ? `${l.link}?${qsDestino.toString()}` : null);

  const media = (total: number) => (ev.mesesComMovimento ? total / ev.mesesComMovimento : 0);
  const celula = (v: number, baseMes: number) => {
    if (emPct) return baseMes ? pct(v / baseMes) : "—";
    return v === 0 ? "–" : num(v);
  };

  const botao = (ativo: boolean, href: string, texto: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ativo ? "bg-marca text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
    >
      {texto}
    </Link>
  );

  return (
    <main className="p-6 pagina-paisagem">
      <Cabecalho titulo={titulo} subtitulo={subtitulo} ctx={ctx} />
      <CabecalhoImpressao ctx={ctx} titulo={titulo} periodo={`Ano ${ev.ano}${emPct ? ` · em % ${rotuloBase === "faturamento" ? "do faturamento" : "das entradas"}` : " · em R$"}`} />

      <div data-tour="opcoes" className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        {botao(!emPct, link({ modo: null }), "R$")}
        {botao(emPct, link({ modo: "pct" }), `% ${rotuloBase === "faturamento" ? "do faturamento" : "das entradas"}`)}
        <span className="mx-2 h-5 w-px bg-slate-200" />
        {botao(!todosCodigos, link({ codigos: null }), "Só códigos com valor")}
        {botao(todosCodigos, link({ codigos: "todos" }), "Todos os códigos")}
        <span className="flex-1" />
        <BotaoImprimir />
      </div>
      <p className="mb-4 text-xs text-slate-500 print:hidden">
        Ano escolhido no seletor acima (o mês não muda nada aqui). Clique numa linha para ver a evolução daquele item.
      </p>

      <Cartao tour="grafico" className="mb-6 p-4">
        <GraficoEvolucao ano={ev.ano} {...ev.grafico} />
      </Cartao>

      <Cartao tour="tabela" className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-xs print:min-w-0 print:text-[8px]">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold">{emPct ? "%" : "R$"}</th>
              {MESES_CURTO.map((m, i) => (
                <th key={m} className="px-1.5 py-2 text-right font-semibold">
                  {m}
                  {ev.semMargem?.[i] && ev.base[i] !== 0 && (
                    <span className="block text-[9px] font-normal normal-case text-amber-600" title="Margem bruta não informada em Parâmetros: CMV, lucro bruto e resultado deste mês ficam distorcidos">
                      s/ margem
                    </span>
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold">Total</th>
              <th className="px-2 py-2 text-right font-semibold" title={`Total dividido pelos ${ev.mesesComMovimento} meses com movimento`}>
                Média
              </th>
            </tr>
          </thead>
          {ev.secoes.map((s) => {
            const linhas = s.codigos && !todosCodigos ? s.linhas.filter((l) => l.meses.some((v) => v !== 0)) : s.linhas;
            return (
              <tbody key={s.titulo} className={s.codigos ? "quebra-antes" : ""}>
                <tr>
                  <td colSpan={15} className="sticky left-0 bg-slate-50 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {s.titulo}
                  </td>
                </tr>
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-3 py-2 text-slate-400">Nenhum valor no ano.</td>
                  </tr>
                )}
                {linhas.map((l) => {
                  const href = destino(l);
                  const negativo = l.destaque && l.total < 0;
                  return (
                    <tr key={l.id} className={`border-t border-slate-100 hover:bg-slate-50 ${l.destaque ? "font-semibold" : ""}`}>
                      <td className="sticky left-0 max-w-[240px] truncate bg-white px-3 py-1" title={l.rotulo}>
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {l.rotulo}
                          </Link>
                        ) : (
                          l.rotulo
                        )}
                      </td>
                      {l.meses.map((v, i) => (
                        <td key={i} className={`px-1.5 py-1 text-right tabular-nums ${v === 0 ? "text-slate-300" : l.destaque && v < 0 ? "text-negativo" : ""}`}>
                          {celula(v, ev.base[i])}
                        </td>
                      ))}
                      <td className={`px-2 py-1 text-right font-semibold tabular-nums ${negativo ? "text-negativo" : ""}`}>
                        {celula(l.total, ev.baseTotal)}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                        {celula(media(l.total), media(ev.baseTotal))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </Cartao>

      <p className="mt-3 text-[11px] text-slate-500">
        Cada mês tem exatamente os mesmos números da {regime === "caixa" ? "DFC" : "DRE Gerencial"} daquele mês
        {regime === "caixa" ? " (regime de caixa)" : " (regime de competência)"}. Média = total ÷ {ev.mesesComMovimento}{" "}
        {ev.mesesComMovimento === 1 ? "mês" : "meses"} com movimento.
      </p>
    </main>
  );
}
