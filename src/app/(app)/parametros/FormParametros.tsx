"use client";
import { useState } from "react";
import { salvarParametros } from "@/lib/acoes";
import { Campo, inputCls } from "@/components/ui";

export default function FormParametros({
  empresaId,
  ano,
  mes,
  margem,
  clientes,
}: {
  empresaId: string;
  ano: number;
  mes: number;
  margem: number | null;
  clientes: number | null;
}) {
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        setSalvando(true);
        setOk(false);
        setErro(null);
        try {
          await salvarParametros(fd);
          setOk(true);
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Erro ao salvar");
        } finally {
          setSalvando(false);
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="empresa_id" value={empresaId} />
      <input type="hidden" name="ano" value={ano} />
      <input type="hidden" name="mes" value={mes} />

      <Campo rotulo="Margem bruta (%)">
        <input
          name="margem"
          inputMode="decimal"
          defaultValue={margem !== null ? String(margem).replace(".", ",") : ""}
          placeholder="Ex.: 61,68"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-slate-500">
          Percentual do faturamento que sobra depois do custo da mercadoria. O sistema calcula o CMV a partir dele.
        </span>
      </Campo>

      <Campo rotulo="Número de clientes atendidos">
        <input
          name="clientes"
          inputMode="numeric"
          defaultValue={clientes ?? ""}
          placeholder="Opcional"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-slate-500">Usado para calcular o ticket médio.</span>
      </Campo>

      <div className="flex items-center gap-3">
        <button
          disabled={salvando}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {ok && <span className="text-sm text-emerald-700">Salvo.</span>}
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>
    </form>
  );
}
