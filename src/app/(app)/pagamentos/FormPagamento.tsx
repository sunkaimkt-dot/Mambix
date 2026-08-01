"use client";
import { useRef, useState } from "react";
import { salvarPagamento } from "@/lib/acoes";
import { Campo, inputCls } from "@/components/ui";
import { CFC, MESES } from "@/lib/formato";

type Opt = { codigo: number; nome: string; grupo?: string };

export default function FormPagamento({
  empresaId,
  lojas,
  bancos,
  codigos,
  formas,
  familia,
  mes,
  ano,
}: {
  empresaId: string;
  lojas: { id: string; nome: string }[];
  bancos: { id: string; nome: string }[];
  codigos: Opt[];
  formas: Opt[];
  familia: Opt[];
  mes: number;
  ano: number;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [jaPago, setJaPago] = useState(false);
  const hoje = `${ano}-${String(mes).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setErro(null);
        setSalvando(true);
        const r = await salvarPagamento(fd);
        setSalvando(false);
        if (r.ok) {
          ref.current?.reset();
          setJaPago(false);
        } else setErro(r.erro ?? "Não foi possível salvar.");
      }}
      className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-12"
    >
      <input type="hidden" name="empresa_id" value={empresaId} />
      <input type="hidden" name="comp_mes" value={mes} />
      <input type="hidden" name="comp_ano" value={ano} />

      <Campo rotulo="Vencimento" className="xl:col-span-1">
        <input type="date" name="vencimento" required defaultValue={hoje} className={inputCls} />
      </Campo>

      <Campo rotulo="CFC" className="xl:col-span-1">
        <select name="cfc" required className={inputCls} defaultValue="1">
          {CFC.map((c) => (
            <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nome}</option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Código da despesa" className="col-span-2 xl:col-span-3">
        <select name="cd" required className={inputCls} defaultValue="">
          <option value="" disabled>Selecione…</option>
          {codigos.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} - {c.nome || "(sem nome)"}
            </option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Descrição" className="col-span-2 xl:col-span-2">
        <input name="descricao" className={inputCls} placeholder="Ex.: aluguel de junho" />
      </Campo>

      <Campo rotulo="Valor (R$)" className="xl:col-span-1">
        <input name="valor" required inputMode="decimal" placeholder="0,00" className={inputCls} />
      </Campo>

      <Campo rotulo="Forma de pagto." className="xl:col-span-1">
        <select name="cp" className={inputCls} defaultValue="">
          <option value="">—</option>
          {formas.map((f) => (
            <option key={f.codigo} value={f.codigo}>{f.nome || f.codigo}</option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Banco / caixa" className="xl:col-span-1">
        <select name="banco_id" className={inputCls} defaultValue="">
          <option value="">—</option>
          {bancos.map((b) => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Loja" className="xl:col-span-1">
        <select name="loja_id" className={inputCls} defaultValue={lojas[0]?.id ?? ""}>
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Casa (opcional)" className="xl:col-span-1">
        <select name="cod_familia" className={inputCls} defaultValue="">
          <option value="">—</option>
          {familia.map((f) => (
            <option key={f.codigo} value={f.codigo}>{f.codigo} - {f.nome || "(sem nome)"}</option>
          ))}
        </select>
      </Campo>

      <div className="col-span-2 flex flex-wrap items-end gap-3 xl:col-span-12">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="ja_pago"
            checked={jaPago}
            onChange={(e) => setJaPago(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Já foi pago
        </label>

        {jaPago && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Pago em</span>
            <input type="date" name="data_pagamento" defaultValue={hoje} className={`${inputCls} w-auto`} />
          </label>
        )}

        <span className="text-xs text-slate-400">
          Competência: {MESES[mes - 1]}/{ano} — muda no seletor acima se a conta for de outro mês.
        </span>
        <button
          disabled={salvando}
          className="ml-auto rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Lançar pagamento"}
        </button>
      </div>

      {erro && <p className="col-span-2 text-sm text-red-600 xl:col-span-12">{erro}</p>}
    </form>
  );
}
