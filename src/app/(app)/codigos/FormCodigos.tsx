"use client";
import { useState } from "react";
import { salvarCodigos } from "@/lib/acoes";
import { inputCls } from "@/components/ui";

export type ItemCodigo = { codigo: number; nome: string };
export type Faixa = { rotulo: string; de: number; ate: number };

/**
 * Edicao dos codigos de uma empresa.
 *
 * Os GRUPOS sao fixos e definidos por faixa de codigo -- o cliente foi explicito:
 * "a estrutura nao muda, dentro de cada grupo eu personalizo". Por isso o grupo
 * aparece so como cabecalho, sem campo para editar: mexer nele bagunçaria a DRE
 * de todo mundo. Deixar o nome em branco tira o codigo das listas de lancamento.
 */
export default function FormCodigos({
  empresaId,
  tabela,
  itens,
  faixas,
}: {
  empresaId: string;
  tabela: string;
  itens: ItemCodigo[];
  faixas?: Faixa[];
}) {
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const [erro, setErro] = useState<string | null>(null);

  const blocos = faixas
    ? faixas.map((f) => ({ rotulo: f.rotulo, itens: itens.filter((i) => i.codigo >= f.de && i.codigo <= f.ate) }))
    : [{ rotulo: "", itens }];

  return (
    <form
      action={async (fd) => {
        setErro(null);
        setEstado("salvando");
        const r = await salvarCodigos(fd);
        setEstado(r.ok ? "salvo" : "parado");
        if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
        else setTimeout(() => setEstado("parado"), 2500);
      }}
    >
      <input type="hidden" name="empresa_id" value={empresaId} />
      <input type="hidden" name="tabela" value={tabela} />

      <div className="space-y-6">
        {blocos.map((b) => (
          <div key={b.rotulo || "unico"}>
            {b.rotulo && (
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {b.rotulo}{" "}
                <span className="font-normal normal-case tracking-normal text-slate-400">
                  (códigos {b.itens[0]?.codigo}–{b.itens[b.itens.length - 1]?.codigo})
                </span>
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {b.itens.map((i) => (
                <label key={i.codigo} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-400">{i.codigo}</span>
                  <input
                    name={`nome_${i.codigo}`}
                    defaultValue={i.nome}
                    placeholder="(não usado)"
                    className={inputCls}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-slate-200 bg-white py-3">
        <button
          disabled={estado === "salvando"}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {estado === "salvando" ? "Salvando…" : "Salvar alterações"}
        </button>
        {estado === "salvo" && <span className="text-sm font-medium text-emerald-700">Salvo.</span>}
        {erro && <span className="text-sm text-red-600">{erro}</span>}
        <span className="ml-auto text-xs text-slate-400">Vale só para esta empresa.</span>
      </div>
    </form>
  );
}
