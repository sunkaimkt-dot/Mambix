import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { dadosDRE, dadosDFC } from "@/lib/relatorios";
import Cabecalho from "@/components/Cabecalho";
import CabecalhoImpressao from "@/components/CabecalhoImpressao";
import BotaoImprimir from "@/components/BotaoImprimir";
import { Cartao } from "@/components/ui";
import { brl, pct, MESES } from "@/lib/formato";

type Linha = { codigo: number; nome: string; valor: number };

/**
 * Impressao (especificacao 5.12): versao de papel da DRE Gerencial e do DFC,
 * no formato da planilha -- totais por grupo + resultado, e os 100 codigos em
 * duas colunas (1-50 | 51-100). Usa dadosDRE/dadosDFC sem filtro, entao os
 * numeros sao os mesmos das telas.
 * As outras telas (DRE/Fluxo Contabil, Evolucoes) imprimem direto pelo botao.
 */
export default async function Impressao({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const rel = sp.rel === "dfc" ? "dfc" : "dre";
  const periodo = `${MESES[ctx.mes - 1]}/${ctx.ano}`;
  const params = Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][];
  const linkRel = (r: string) => {
    const q = new URLSearchParams(params);
    q.set("rel", r);
    return `/impressao?${q.toString()}`;
  };

  let titulo: string;
  let base: number;
  let resumo: { rotulo: string; valor: number; forte?: boolean }[];
  let grupos: { rotulo: string; total: number }[];
  let codigos: Linha[];
  let entradasLista: { nome: string; valor: number }[];
  let rotuloEntradas: string;

  if (rel === "dre") {
    const d = await dadosDRE(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId);
    titulo = "DRE Gerencial — regime de competência";
    base = d.faturamento;
    rotuloEntradas = "Faturamento por forma de venda";
    entradasLista = d.porTipoVenda;
    grupos = d.grupos;
    codigos = d.porCodigo;
    resumo = [
      { rotulo: "Faturamento", valor: d.faturamento, forte: true },
      { rotulo: "CMV / CPV", valor: d.cmv },
      { rotulo: `Lucro bruto${d.margem ? ` (margem ${pct(d.margem)})` : " (margem não informada)"}`, valor: d.lucroBruto },
      { rotulo: "Despesas", valor: d.despesas },
      { rotulo: "Resultado", valor: d.resultado, forte: true },
    ];
  } else {
    const d = await dadosDFC(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId);
    titulo = "Fluxo de Caixa (DFC) — regime de caixa";
    base = d.entradas;
    rotuloEntradas = "Entradas por tipo de recebimento";
    entradasLista = d.porTipoRecebimento;
    grupos = d.grupos;
    codigos = d.porCodigo;
    resumo = [
      { rotulo: "Entradas", valor: d.entradas, forte: true },
      { rotulo: "Saídas", valor: d.saidas },
      { rotulo: "Resultado do mês", valor: d.resultado, forte: true },
    ];
  }

  const metade = [codigos.filter((c) => c.codigo <= 50), codigos.filter((c) => c.codigo > 50)];

  const tabelaCodigos = (linhas: Linha[]) => (
    <table className="w-full text-xs">
      <tbody>
        {linhas.map((c) => (
          <tr key={c.codigo} className={`border-t border-slate-100 ${c.valor ? "" : "text-slate-400"}`}>
            <td className="w-7 py-0.5 tabular-nums text-slate-400">{String(c.codigo).padStart(2, "0")}</td>
            <td className="max-w-[180px] truncate py-0.5">{c.nome || "—"}</td>
            <td className="py-0.5 text-right tabular-nums">{c.valor ? brl(c.valor) : "–"}</td>
            <td className="w-14 py-0.5 text-right tabular-nums text-slate-500">{c.valor && base ? pct(c.valor / base) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <main className="p-6">
      <Cabecalho titulo="Impressão / PDF" subtitulo={`${periodo} — versão de papel, no formato da planilha`} ctx={ctx} />
      <CabecalhoImpressao ctx={ctx} titulo={titulo} periodo={periodo} />

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        {[
          ["dre", "DRE Gerencial"],
          ["dfc", "Fluxo de Caixa (DFC)"],
        ].map(([r, t]) => (
          <Link
            key={r}
            href={linkRel(r)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${rel === r ? "bg-marca text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {t}
          </Link>
        ))}
        <span className="flex-1" />
        <BotaoImprimir />
      </div>
      <p className="mb-4 text-xs text-slate-500 print:hidden">
        DRE Contábil, Fluxo Contábil e as Evoluções também têm o botão <strong>Imprimir / Salvar PDF</strong> na própria
        tela. Para PDF, escolha “Salvar como PDF” como destino da impressão.
      </p>

      <div className="mb-4 grid gap-4 md:grid-cols-3 print:grid-cols-3">
        <Cartao className="p-3 avoid-break">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotuloEntradas}</p>
          <table className="w-full text-xs">
            <tbody>
              {entradasLista.map((t) => (
                <tr key={t.nome} className={`border-t border-slate-100 ${t.valor ? "" : "text-slate-400"}`}>
                  <td className="py-0.5">{t.nome}</td>
                  <td className="py-0.5 text-right tabular-nums">{brl(t.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
        <Cartao className="p-3 avoid-break">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Totais por grupo</p>
          <table className="w-full text-xs">
            <tbody>
              {grupos.map((g) => (
                <tr key={g.rotulo} className={`border-t border-slate-100 ${g.total ? "" : "text-slate-400"}`}>
                  <td className="py-0.5">{g.rotulo}</td>
                  <td className="py-0.5 text-right tabular-nums">{brl(g.total)}</td>
                  <td className="w-14 py-0.5 text-right tabular-nums text-slate-500">{base ? pct(g.total / base) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
        <Cartao className="p-3 avoid-break">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
          <table className="w-full text-xs">
            <tbody>
              {resumo.map((r) => (
                <tr key={r.rotulo} className={`border-t border-slate-100 ${r.forte ? "font-bold" : ""}`}>
                  <td className="py-0.5">{r.rotulo}</td>
                  <td className={`py-0.5 text-right tabular-nums ${r.forte && r.valor < 0 ? "text-negativo" : ""}`}>{brl(r.valor)}</td>
                  <td className="w-14 py-0.5 text-right tabular-nums text-slate-500">{base ? pct(r.valor / base) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      </div>

      <Cartao className="p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Códigos de despesa</p>
        <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
          {tabelaCodigos(metade[0])}
          {tabelaCodigos(metade[1])}
        </div>
      </Cartao>
    </main>
  );
}
