"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { inputCls } from "@/components/ui";

/**
 * Filtro do relatorio inteiro -- o "filtro da planilha" que o cliente pediu.
 *
 * O estado mora na URL, nao em memoria: assim ele pode salvar o link de uma
 * visao filtrada, voltar pelo historico do navegador e recarregar sem perder o
 * que estava vendo. Trocar de mes tambem preserva o filtro.
 */
export default function FiltroRelatorio({
  formas,
  regime,
}: {
  formas: { codigo: number; nome: string }[];
  regime: "competencia" | "caixa";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [texto, setTexto] = useState(sp.get("q") ?? "");
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");

  const cp = sp.get("cp") ?? "";
  const situacao = sp.get("situacao") ?? "";
  const ativo = Boolean(sp.get("q") || sp.get("min") || sp.get("max") || cp || situacao);

  function aplicar(mudancas: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === "") p.delete(k);
      else p.set(k, v);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  function limpar() {
    const p = new URLSearchParams(sp.toString());
    ["q", "min", "max", "cp", "situacao"].forEach((k) => p.delete(k));
    setTexto("");
    setMin("");
    setMax("");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className={`mb-4 rounded-xl border p-3 ${ativo ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ q: texto.trim(), min: min.trim(), max: max.trim() });
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Descrição contém
          </span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="ex.: manutenção"
            className={`${inputCls} w-52`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Valor de
          </span>
          <input
            value={min}
            onChange={(e) => setMin(e.target.value)}
            inputMode="decimal"
            placeholder="mín."
            className={`${inputCls} w-24`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            até
          </span>
          <input
            value={max}
            onChange={(e) => setMax(e.target.value)}
            inputMode="decimal"
            placeholder="máx."
            className={`${inputCls} w-24`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Forma
          </span>
          <select
            value={cp}
            onChange={(e) => aplicar({ cp: e.target.value })}
            className={`${inputCls} w-44`}
          >
            <option value="">Todas</option>
            {formas.map((f) => (
              <option key={f.codigo} value={f.codigo}>{f.nome}</option>
            ))}
          </select>
        </label>

        {regime === "competencia" && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Situação
            </span>
            <select
              value={situacao}
              onChange={(e) => aplicar({ situacao: e.target.value })}
              className={`${inputCls} w-36`}
            >
              <option value="">Todas</option>
              <option value="pagos">Só pagas</option>
              <option value="abertos">Só em aberto</option>
            </select>
          </label>
        )}

        <button className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-900">
          Filtrar
        </button>

        {ativo && (
          <button
            type="button"
            onClick={limpar}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Limpar filtro
          </button>
        )}
      </form>

      {ativo && (
        <p className="mt-2 text-xs leading-relaxed text-amber-900">
          <strong>Relatório filtrado.</strong> As despesas abaixo mostram só o que passou no filtro —
          o faturamento e as entradas continuam cheios, então lucro e resultado não representam o mês
          inteiro. Limpe o filtro para ver os números fechados.
        </p>
      )}
    </div>
  );
}
