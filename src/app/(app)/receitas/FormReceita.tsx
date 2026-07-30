"use client";
import { useRef, useState } from "react";
import { salvarReceita } from "@/lib/acoes";
import { Campo, inputCls } from "@/components/ui";

export default function FormReceita({
  empresaId,
  lojas,
  bancos,
  tipos,
  mes,
  ano,
}: {
  empresaId: string;
  lojas: { id: string; nome: string }[];
  bancos: { id: string; nome: string }[];
  tipos: { codigo: number; nome: string }[];
  mes: number;
  ano: number;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const hoje = `${ano}-${String(mes).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setErro(null);
        setSalvando(true);
        try {
          await salvarReceita(fd);
          ref.current?.reset();
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Erro ao salvar");
        } finally {
          setSalvando(false);
        }
      }}
      className="grid grid-cols-2 gap-3 md:grid-cols-6"
    >
      <input type="hidden" name="empresa_id" value={empresaId} />
      <Campo rotulo="Data">
        <input type="date" name="data" required defaultValue={hoje} className={inputCls} />
      </Campo>
      <Campo rotulo="Descrição" className="col-span-2">
        <input name="descricao" className={inputCls} placeholder="Ex.: Cielo crédito" />
      </Campo>
      <Campo rotulo="Tipo de recebimento">
        <select name="tipo_recebimento" required className={inputCls} defaultValue="">
          <option value="" disabled>Selecione…</option>
          {tipos.map((t) => (
            <option key={t.codigo} value={t.codigo}>{t.nome}</option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Banco">
        <select name="banco_id" className={inputCls} defaultValue="">
          <option value="">—</option>
          {bancos.map((b) => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Valor (R$)">
        <input name="valor" required inputMode="decimal" placeholder="0,00" className={inputCls} />
      </Campo>
      <input type="hidden" name="loja_id" value={lojas[0]?.id ?? ""} />
      <div className="col-span-2 flex justify-end md:col-span-6">
        <button
          disabled={salvando}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Lançar entrada"}
        </button>
      </div>
      {erro && <p className="col-span-2 text-sm text-red-600 md:col-span-6">{erro}</p>}
    </form>
  );
}
