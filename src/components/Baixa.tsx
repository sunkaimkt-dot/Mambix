"use client";
import { useState, useTransition } from "react";
import { registrarBaixa, estornarBaixa } from "@/lib/acoes";
import { brl } from "@/lib/formato";
import { inputCls } from "@/components/ui";

export type BaixaRegistrada = {
  id: string;
  data_pagamento: string;
  valor: number;
};

/**
 * Controle de pagamento de uma conta.
 *
 * Substitui o antigo interruptor "Pago / Em aberto", que so virava um booleano e
 * deixava a saida no mes do vencimento. Aqui a data do pagamento e obrigatoria:
 * e ela que leva o valor para o mes certo no fluxo de caixa.
 */
export default function Baixa({
  pagamentoId,
  valor,
  totalPago,
  baixas,
  formas,
  bancos,
}: {
  pagamentoId: string;
  valor: number;
  totalPago: number;
  baixas: BaixaRegistrada[];
  formas: { codigo: number; nome: string }[];
  bancos: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const saldo = Number((valor - totalPago).toFixed(2));
  const quitado = saldo <= 0.009;
  const parcial = totalPago > 0 && !quitado;
  const hoje = new Date().toISOString().slice(0, 10);

  const cor = quitado
    ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
    : parcial
      ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
      : "bg-amber-100 text-amber-700 hover:bg-amber-200";

  const rotulo = quitado ? "Pago" : parcial ? `Parcial · falta ${brl(saldo)}` : "Em aberto";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cor}`}
      >
        {rotulo}
      </button>

      {/* Modal, nao popover: a tabela vive dentro de um container com rolagem
          horizontal, e um menu posicionado por absolute era cortado por ele. */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={() => setAberto(false)}
        >
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Registrar pagamento</p>
            <span className="text-xs text-slate-500">
              total {brl(valor)}
            </span>
          </div>
          {baixas.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Pagamentos registrados
              </p>
              <ul className="space-y-1">
                {baixas.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="tabular-nums text-slate-600">
                      {b.data_pagamento.split("-").reverse().join("/")}
                    </span>
                    <span className="tabular-nums font-medium">{brl(Number(b.valor))}</span>
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => iniciar(() => void estornarBaixa(b.id))}
                      className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
                      title="Desfazer este pagamento"
                    >
                      estornar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quitado ? (
            <p className="text-sm text-slate-500">Conta quitada.</p>
          ) : (
            <form
              action={async (fd) => {
                setErro(null);
                const r = await registrarBaixa(fd);
                if (r.ok) setAberto(false);
                else setErro(r.erro ?? "Não foi possível registrar.");
              }}
              className="space-y-2"
            >
              <input type="hidden" name="pagamento_id" value={pagamentoId} />

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Pago em
                  </span>
                  <input type="date" name="data_pagamento" required defaultValue={hoje} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Valor
                  </span>
                  <input
                    name="valor"
                    required
                    inputMode="decimal"
                    defaultValue={saldo.toFixed(2).replace(".", ",")}
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Forma
                  </span>
                  <select name="cp" className={inputCls} defaultValue="">
                    <option value="">—</option>
                    {formas.map((f) => (
                      <option key={f.codigo} value={f.codigo}>{f.nome || f.codigo}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Banco
                  </span>
                  <select name="banco_id" className={inputCls} defaultValue="">
                    <option value="">—</option>
                    {bancos.map((b) => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-400">
                Pagou menos que o total? Ajuste o valor — a conta continua em aberto pelo restante.
              </p>

              <div className="flex gap-2">
                <button className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
                  Registrar pagamento
                </button>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
                >
                  Fechar
                </button>
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}
            </form>
          )}

          {quitado && (
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="mt-3 w-full rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Fechar
            </button>
          )}
        </div>
        </div>
      )}
    </>
  );
}
