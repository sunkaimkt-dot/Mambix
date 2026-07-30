"use client";
import { useState, useTransition } from "react";
import { salvarCaixa } from "@/lib/acoes";
import { brl } from "@/lib/formato";

type Tipo = { codigo: number; nome: string };

export default function GradeCaixa({
  empresaId,
  lojaId,
  ano,
  mes,
  tipos,
  valores,
}: {
  empresaId: string;
  lojaId: string;
  ano: number;
  mes: number;
  tipos: Tipo[];
  valores: Record<string, number>;
}) {
  const dias = new Date(ano, mes, 0).getDate();
  const [dados, setDados] = useState(valores);
  const [salvando, iniciar] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function chave(dia: number, tipo: number) {
    return `${dia}-${tipo}`;
  }

  function gravar(dia: number, tipo: number, texto: string) {
    const valor = Number(texto.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(valor)) return;
    setDados((d) => ({ ...d, [chave(dia, tipo)]: valor }));
    const fd = new FormData();
    fd.set("empresa_id", empresaId);
    fd.set("loja_id", lojaId);
    fd.set("data", `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
    fd.set("tipo_venda", String(tipo));
    fd.set("valor", String(valor));
    iniciar(async () => {
      const r = await salvarCaixa(fd);
      setErro(r.ok ? null : r.erro ?? "Não foi possível salvar.");
    });
  }

  const totalTipo = (t: number) =>
    Array.from({ length: dias }, (_, i) => dados[chave(i + 1, t)] ?? 0).reduce((a, b) => a + b, 0);
  const totalDia = (d: number) => tipos.reduce((s, t) => s + (dados[chave(d, t.codigo)] ?? 0), 0);
  const totalGeral = tipos.reduce((s, t) => s + totalTipo(t.codigo), 0);

  return (
    <div className="overflow-x-auto">
      {salvando && <p className="px-3 py-1 text-xs text-emerald-600">salvando…</p>}
      {erro && <p className="px-3 py-1 text-xs text-red-600">{erro}</p>}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold">Dia</th>
            {tipos.map((t) => (
              <th key={t.codigo} className="px-2 py-2 text-right font-semibold">{t.nome}</th>
            ))}
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: dias }, (_, i) => i + 1).map((dia) => (
            <tr key={dia} className="hover:bg-slate-50">
              <td className="sticky left-0 z-10 bg-white px-3 py-1 font-medium tabular-nums">{dia}</td>
              {tipos.map((t) => {
                const k = chave(dia, t.codigo);
                const v = dados[k] ?? 0;
                return (
                  <td key={t.codigo} className="px-1 py-1">
                    {editando === k ? (
                      <input
                        autoFocus
                        defaultValue={v ? String(v).replace(".", ",") : ""}
                        onBlur={(e) => {
                          gravar(dia, t.codigo, e.target.value || "0");
                          setEditando(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditando(null);
                        }}
                        className="w-24 rounded border border-emerald-400 px-1.5 py-1 text-right text-sm outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditando(k)}
                        className={`w-full rounded px-1.5 py-1 text-right tabular-nums hover:bg-emerald-50 ${
                          v ? "" : "text-slate-300"
                        }`}
                      >
                        {v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
                      </button>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-1 text-right font-medium tabular-nums">
                {totalDia(dia) ? brl(totalDia(dia)) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-100 font-semibold">
          <tr>
            <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2">Total</td>
            {tipos.map((t) => (
              <td key={t.codigo} className="px-2 py-2 text-right tabular-nums">
                {totalTipo(t.codigo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums">{brl(totalGeral)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
