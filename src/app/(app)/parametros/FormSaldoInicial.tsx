"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarSaldoInicial } from "@/lib/acoes";
import { inputCls } from "@/components/ui";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FormSaldoInicial({
  empresaId,
  ano,
  mes,
  bancos,
  atuais,
  sugestao,
}: {
  empresaId: string;
  ano: number;
  mes: number;
  bancos: { id: string; nome: string }[];
  atuais: Record<string, number>;
  sugestao: Record<string, number> | null;
}) {
  const router = useRouter();
  const inicial = () =>
    Object.fromEntries(bancos.map((b) => [b.id, atuais[b.id] !== undefined ? fmt(Number(atuais[b.id])) : ""]));
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = Object.values(valores).reduce((s, v) => {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return s + (Number.isNaN(n) ? 0 : n);
  }, 0);

  if (bancos.length === 0) {
    return <p className="text-sm text-slate-500">Cadastre os bancos em Bancos e lojas primeiro.</p>;
  }

  return (
    <form
      action={async (fd) => {
        setSalvando(true);
        setOk(false);
        setErro(null);
        const r = await salvarSaldoInicial(fd);
        setSalvando(false);
        if (r.ok) { setOk(true); router.refresh(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      }}
      className="space-y-3"
    >
      <input type="hidden" name="empresa_id" value={empresaId} />
      <input type="hidden" name="ano" value={ano} />
      <input type="hidden" name="mes" value={mes} />

      {sugestao && (
        <button
          type="button"
          onClick={() =>
            setValores(Object.fromEntries(bancos.map((b) => [b.id, sugestao[b.id] ? fmt(sugestao[b.id]) : ""])))
          }
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="Saldo inicial do mês anterior + receitas − pagamentos de cada banco"
        >
          Preencher com o saldo final do mês anterior
        </button>
      )}

      <ul className="divide-y divide-slate-100">
        {bancos.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-1.5">
            <span className="flex-1 text-sm">{b.nome}</span>
            <input
              name={`saldo_${b.id}`}
              inputMode="decimal"
              value={valores[b.id] ?? ""}
              onChange={(e) => setValores({ ...valores, [b.id]: e.target.value })}
              placeholder="0,00"
              className={`${inputCls} max-w-[160px] text-right`}
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
        <span className="font-semibold">Total</span>
        <span className="font-semibold tabular-nums">R$ {fmt(total)}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={salvando}
          className="rounded-lg bg-marca px-5 py-2 text-sm font-semibold text-white hover:bg-marca-escura disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar saldos"}
        </button>
        {ok && <span className="text-sm text-marca">Salvo.</span>}
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>
    </form>
  );
}
