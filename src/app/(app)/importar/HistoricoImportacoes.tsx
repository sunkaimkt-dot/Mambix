"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { desfazerLote } from "@/lib/importacao-acoes";
import { Cartao, Vazio } from "@/components/ui";
import { brl } from "@/lib/formato";

export type Lote = {
  id: string;
  tipo: string;
  arquivo: string;
  loja: string;
  criado_em: string;
  linhas_arquivo: number;
  linhas_importadas: number;
  linhas_rejeitadas: number;
  valor_importado: number;
  desfeita_em: string | null;
};

const NOME_TIPO: Record<string, string> = {
  pagamentos: "Pagamentos",
  receitas: "Receitas",
  caixa_diario: "Caixa Diário",
};

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export default function HistoricoImportacoes({ lotes, podeDesfazer }: { lotes: Lote[]; podeDesfazer: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string; detalhes?: string[] } | null>(null);

  function desfazer(l: Lote) {
    const texto =
      `Desfazer a importação "${l.arquivo || NOME_TIPO[l.tipo]}"?\n\n` +
      (l.tipo === "caixa_diario"
        ? "Os dias importados voltam ao valor que tinham antes (ou ficam vazios). Dias alterados depois da importação são mantidos."
        : `Os ${l.linhas_importadas} lançamentos criados por ela serão excluídos` +
          (l.tipo === "pagamentos" ? ", junto com as baixas (inclusive baixas registradas depois)." : "."));
    if (!confirm(texto)) return;
    iniciar(async () => {
      const r = await desfazerLote(l.id);
      setAviso(
        r.ok
          ? { ok: true, texto: `Importação desfeita: ${r.desfeitos} item(ns).`, detalhes: r.mantidos }
          : { ok: false, texto: r.erro ?? "Não foi possível desfazer." }
      );
      router.refresh();
    });
  }

  return (
    <Cartao className="mt-6 p-4">
      <p className="mb-3 text-sm font-semibold">Importações anteriores</p>
      {aviso && (
        <div className={`mb-3 rounded-lg p-3 text-sm ${aviso.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {aviso.texto}
          {aviso.detalhes && aviso.detalhes.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {aviso.detalhes.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
      {lotes.length === 0 ? (
        <Vazio texto="Nenhuma importação feita nesta empresa ainda." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Quando</th>
                <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th className="px-3 py-2 text-left font-semibold">Arquivo</th>
                <th className="px-3 py-2 text-left font-semibold">Loja</th>
                <th className="px-3 py-2 text-right font-semibold">Importadas</th>
                <th className="px-3 py-2 text-right font-semibold">Fora</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lotes.map((l) => (
                <tr key={l.id} className={l.desfeita_em ? "text-slate-400" : ""}>
                  <td className="whitespace-nowrap px-3 py-2">{quando(l.criado_em)}</td>
                  <td className="px-3 py-2">{NOME_TIPO[l.tipo] ?? l.tipo}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2" title={l.arquivo}>{l.arquivo || "—"}</td>
                  <td className="px-3 py-2">{l.loja}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.linhas_importadas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.linhas_rejeitadas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(l.valor_importado)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {l.desfeita_em ? (
                      <span className="text-xs">desfeita em {quando(l.desfeita_em)}</span>
                    ) : podeDesfazer ? (
                      <button
                        type="button"
                        disabled={pendente}
                        onClick={() => desfazer(l)}
                        className="text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-40"
                      >
                        desfazer
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}
