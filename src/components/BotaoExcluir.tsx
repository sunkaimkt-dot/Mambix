"use client";
import { useRouter } from "next/navigation";
import { excluirLancamento } from "@/lib/acoes";
import { useTransition } from "react";

export default function BotaoExcluir({
  tabela,
  id,
}: {
  tabela: "pagamentos" | "receitas" | "caixa_diario";
  id: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (confirm("Excluir este lançamento?"))
          iniciar(async () => { await excluirLancamento(tabela, id); router.refresh(); });
      }}
      className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-40"
      title="Excluir"
    >
      excluir
    </button>
  );
}
