"use client";
import { useMemo, useState } from "react";
import type { LinhaRevisao } from "@/lib/extrato";
import type { Referencias } from "@/lib/importacao";
import { brl } from "@/lib/formato";
import { inputCls } from "@/components/ui";

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Revisao do extrato (PDF/OFX), antes da importacao normal.
 *
 * O sistema sugere: debito ou credito, codigo de despesa e forma de pagamento
 * (debitos), tipo de recebimento (creditos). Aqui o usuario confere e corrige
 * linha a linha. Nada e gravado nesta etapa -- a especificacao manda nunca
 * gravar sem confirmacao humana.
 */
export default function RevisaoExtrato({
  nomeArquivo,
  linhasIniciais,
  referencias,
  semBanco,
  aoConfirmar,
  aoCancelar,
}: {
  nomeArquivo: string;
  linhasIniciais: LinhaRevisao[];
  referencias: Referencias;
  semBanco: boolean;
  aoConfirmar: (linhas: LinhaRevisao[]) => void;
  aoCancelar: () => void;
}) {
  const [linhas, setLinhas] = useState(linhasIniciais);
  const [filtro, setFiltro] = useState<"todas" | "pendentes">("todas");

  const codigos = referencias.codigos.filter((c) => c.nome);
  const formas = referencias.formas.filter((c) => c.nome);
  const tipos = referencias.tiposRecebimento.filter((c) => c.nome);

  const pendente = (l: LinhaRevisao) =>
    l.incluir && (l.natureza === "debito" ? !l.codigo : !l.tipo);
  const resumo = useMemo(() => {
    const incl = linhas.filter((l) => l.incluir);
    return {
      debitos: incl.filter((l) => l.natureza === "debito"),
      creditos: incl.filter((l) => l.natureza === "credito"),
      pendentes: incl.filter(pendente).length,
      incertas: incl.filter((l) => l.naturezaIncerta).length,
    };
  }, [linhas]);

  const muda = (i: number, p: Partial<LinhaRevisao>) =>
    setLinhas(linhas.map((l, j) => (j === i ? { ...l, ...p } : l)));

  // Aplica o mesmo codigo a todas as linhas com a mesma descricao ainda sem codigo.
  const mudaCodigo = (i: number, codigo: number | null) => {
    const desc = linhas[i].descricao;
    setLinhas(
      linhas.map((l, j) =>
        j === i || (l.natureza === "debito" && !l.codigo && l.descricao === desc) ? { ...l, codigo } : l
      )
    );
  };

  const visiveis = linhas.map((l, i) => ({ l, i })).filter(({ l }) => filtro === "todas" || pendente(l) || l.naturezaIncerta);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">2. Revise o extrato — {nomeArquivo}</p>
        <div className="flex gap-1.5 text-xs">
          {(["todas", "pendentes"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded px-2 py-1 ${filtro === f ? "bg-marca-clara font-medium text-marca" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {f === "todas" ? `Todas (${linhas.length})` : `Para revisar (${resumo.pendentes + resumo.incertas})`}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        A classificação é uma sugestão a partir da descrição de cada movimento. Confira principalmente as linhas em
        amarelo (sem código, ou sem certeza se é entrada ou saída). Ao escolher um código, ele vale também para as
        outras linhas com a mesma descrição.
      </p>
      {semBanco && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Escolha acima o <strong>banco padrão</strong> = o banco deste extrato. É nele que pagamentos e receitas vão
          ficar registrados.
        </p>
      )}

      <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2"></th>
              <th className="px-2 py-2">Data</th>
              <th className="px-2 py-2">Descrição</th>
              <th className="px-2 py-2 text-right">Valor</th>
              <th className="px-2 py-2">Entrada/Saída</th>
              <th className="px-2 py-2">Classificação</th>
              <th className="px-2 py-2">Forma</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map(({ l, i }) => (
              <tr
                key={i}
                className={`border-t border-slate-100 ${!l.incluir ? "opacity-40" : pendente(l) || l.naturezaIncerta ? "bg-amber-50/60" : ""}`}
              >
                <td className="px-2 py-1">
                  <input type="checkbox" checked={l.incluir} onChange={(e) => muda(i, { incluir: e.target.checked })} className="h-4 w-4" />
                </td>
                <td className="whitespace-nowrap px-2 py-1 tabular-nums">{dataBR(l.data)}</td>
                <td className="px-2 py-1">{l.descricao}</td>
                <td className={`whitespace-nowrap px-2 py-1 text-right tabular-nums ${l.natureza === "debito" ? "text-negativo" : "text-positivo"}`}>
                  {l.natureza === "debito" ? "−" : "+"}
                  {brl(l.valor)}
                </td>
                <td className="px-2 py-1">
                  <select
                    value={l.natureza}
                    onChange={(e) => {
                      const nat = e.target.value as LinhaRevisao["natureza"];
                      muda(i, { natureza: nat, naturezaIncerta: false, codigo: nat === "debito" ? l.codigo : null, tipo: nat === "credito" ? (l.tipo ?? 12) : null });
                    }}
                    className={`${inputCls} py-1 text-xs`}
                  >
                    <option value="debito">Saída (pagamento)</option>
                    <option value="credito">Entrada (receita)</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  {l.natureza === "debito" ? (
                    <select
                      value={l.codigo ?? ""}
                      onChange={(e) => mudaCodigo(i, e.target.value ? Number(e.target.value) : null)}
                      className={`${inputCls} py-1 text-xs ${!l.codigo && l.incluir ? "border-amber-400" : ""}`}
                    >
                      <option value="">Código da despesa…</option>
                      {codigos.map((c) => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={l.tipo ?? ""}
                      onChange={(e) => muda(i, { tipo: e.target.value ? Number(e.target.value) : null })}
                      className={`${inputCls} py-1 text-xs`}
                    >
                      <option value="">Tipo de recebimento…</option>
                      {tipos.map((c) => (
                        <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nome}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-2 py-1">
                  {l.natureza === "debito" && (
                    <select
                      value={l.forma ?? ""}
                      onChange={(e) => muda(i, { forma: e.target.value ? Number(e.target.value) : null })}
                      className={`${inputCls} py-1 text-xs`}
                    >
                      <option value="">—</option>
                      {formas.map((c) => (
                        <option key={c.codigo} value={c.codigo}>{c.nome}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          {resumo.debitos.length} saída(s): <strong>{brl(resumo.debitos.reduce((s, l) => s + l.valor, 0))}</strong> ·{" "}
          {resumo.creditos.length} entrada(s): <strong>{brl(resumo.creditos.reduce((s, l) => s + l.valor, 0))}</strong>
          {resumo.pendentes > 0 && <span className="ml-2 text-amber-700">· {resumo.pendentes} sem classificação</span>}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={aoCancelar} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Escolher outro arquivo
          </button>
          <button
            type="button"
            onClick={() => aoConfirmar(linhas)}
            className="rounded-lg bg-marca px-5 py-2 text-sm font-semibold text-white hover:bg-marca-escura"
          >
            Continuar para a conferência
          </button>
        </div>
      </div>
    </div>
  );
}
