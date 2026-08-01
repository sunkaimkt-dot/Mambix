"use client";
import { useEffect, useMemo, useState } from "react";
import { buscarDetalhes } from "@/lib/acoes";
import type { LinhaDetalhe } from "@/lib/relatorios";
import { brl, MESES } from "@/lib/formato";
import { inputCls } from "@/components/ui";

type Ordem = "data" | "valor" | "descricao";

/**
 * Abre a composicao de um codigo: quais lancamentos formaram aquele total.
 *
 * Pedido do cliente: "tive varias despesas de manutencao diferentes e no
 * relatorio aparece o total; preciso saber quais foram". No Excel ele resolvia
 * filtrando a planilha -- dai a busca e a ordenacao aqui dentro.
 */
export default function DetalheCodigo({
  empresaId,
  codigo,
  nome,
  total,
  ano,
  mes,
  regime,
  lojaId,
}: {
  empresaId: string;
  codigo: number;
  nome: string;
  total: number;
  ano: number;
  mes: number;
  regime: "competencia" | "caixa";
  lojaId: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaDetalhe[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("data");
  const [desc, setDesc] = useState(false);

  useEffect(() => {
    if (!aberto || linhas !== null) return;
    let cancelado = false;
    buscarDetalhes(empresaId, codigo, ano, mes, regime, lojaId)
      .then((r) => { if (!cancelado) setLinhas(r); })
      .catch(() => { if (!cancelado) setErro("Não foi possível carregar os lançamentos."); });
    return () => { cancelado = true; };
  }, [aberto, linhas, empresaId, codigo, ano, mes, regime, lojaId]);

  // Fecha no Esc, como qualquer janela.
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto]);

  const visiveis = useMemo(() => {
    if (!linhas) return [];
    const termo = busca.trim().toLowerCase();
    const filtradas = termo
      ? linhas.filter(
          (l) =>
            l.descricao.toLowerCase().includes(termo) ||
            (l.forma ?? "").toLowerCase().includes(termo) ||
            (l.banco ?? "").toLowerCase().includes(termo) ||
            (l.loja ?? "").toLowerCase().includes(termo)
        )
      : linhas;

    const ordenadas = [...filtradas].sort((a, b) => {
      if (ordem === "valor") return a.valor - b.valor;
      if (ordem === "descricao") return a.descricao.localeCompare(b.descricao, "pt-BR");
      return a.data.localeCompare(b.data);
    });
    return desc ? ordenadas.reverse() : ordenadas;
  }, [linhas, busca, ordem, desc]);

  const somaVisivel = visiveis.reduce((s, l) => s + l.valor, 0);
  const filtrando = busca.trim() !== "";

  function alternar(o: Ordem) {
    if (ordem === o) setDesc((v) => !v);
    else { setOrdem(o); setDesc(o === "valor"); }
  }
  const seta = (o: Ordem) => (ordem === o ? (desc ? " ↓" : " ↑") : "");

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Ver os lançamentos que formaram este valor"
        className="text-slate-400 hover:text-emerald-700"
      >
        {/* lista */}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 sm:p-8"
          onClick={() => setAberto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="font-semibold">
                  {codigo} — {nome || "(sem nome)"}
                </p>
                <p className="text-xs text-slate-500">
                  {MESES[mes - 1]}/{ano} ·{" "}
                  {regime === "caixa"
                    ? "pagamentos efetuados no mês"
                    : "lançamentos da competência, pagos ou não"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por descrição, forma, banco…"
                className={`${inputCls} max-w-xs`}
              />
              <span className="ml-auto text-sm">
                <span className="text-slate-500">{filtrando ? "Soma do filtro:" : "Total:"}</span>{" "}
                <span className="font-semibold tabular-nums">{brl(somaVisivel)}</span>
                {filtrando && (
                  <span className="ml-1 text-xs text-slate-400">de {brl(total)}</span>
                )}
              </span>
            </div>

            {erro && <p className="px-4 py-6 text-sm text-red-600">{erro}</p>}
            {!erro && linhas === null && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Carregando…</p>
            )}
            {!erro && linhas !== null && visiveis.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {filtrando ? "Nada encontrado com esse filtro." : "Nenhum lançamento neste código."}
              </p>
            )}

            {!erro && visiveis.length > 0 && (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">
                        <button type="button" onClick={() => alternar("data")} className="hover:text-slate-800">
                          {regime === "caixa" ? "Pago em" : "Vencimento"}{seta("data")}
                        </button>
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        <button type="button" onClick={() => alternar("descricao")} className="hover:text-slate-800">
                          Descrição{seta("descricao")}
                        </button>
                      </th>
                      <th className="px-3 py-2 font-semibold">Forma</th>
                      <th className="px-3 py-2 font-semibold">Banco</th>
                      {regime === "competencia" && <th className="px-3 py-2 font-semibold">Situação</th>}
                      <th className="px-4 py-2 text-right font-semibold">
                        <button type="button" onClick={() => alternar("valor")} className="hover:text-slate-800">
                          Valor{seta("valor")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiveis.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-1.5 tabular-nums">
                          {l.data.split("-").reverse().join("/")}
                        </td>
                        <td className="px-3 py-1.5">{l.descricao}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{l.forma ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{l.banco ?? "—"}</td>
                        {regime === "competencia" && (
                          <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-500">
                            {l.situacao}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-1.5 text-right font-medium tabular-nums">
                          {brl(l.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="border-t border-slate-100 px-4 py-2 text-[11px] leading-relaxed text-slate-400">
              {regime === "caixa"
                ? "Uma conta paga em parcelas aparece uma vez por pagamento — é assim que o fluxo de caixa enxerga."
                : "Cada conta aparece uma vez pelo valor total, tenha sido paga ou não."}{" "}
              Clique nos títulos para ordenar.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
