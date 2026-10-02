import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import { Cartao } from "@/components/ui";
import { GRUPOS_DRE, GRUPOS_DFC_EXTRA } from "@/lib/formato";
import FormCodigos from "./FormCodigos";

const ABAS = [
  { chave: "despesa", rotulo: "Códigos de despesa", tabela: "codigos_despesa" },
  { chave: "recebimento", rotulo: "Tipos de recebimento", tabela: "tipos_recebimento" },
  { chave: "pagamento", rotulo: "Formas de pagamento", tabela: "formas_pagamento" },
  { chave: "venda", rotulo: "Tipos de venda (caixa)", tabela: "tipos_venda" },
] as const;

export default async function Codigos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const abaPedida = typeof sp.aba === "string" ? sp.aba : "despesa";
  const aba = ABAS.find((a) => a.chave === abaPedida) ?? ABAS[0];

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from(aba.tabela)
    .select("codigo, nome")
    .eq("empresa_id", ctx.empresaId)
    .order("codigo");

  const faixas =
    aba.chave === "despesa"
      ? [...GRUPOS_DRE, ...GRUPOS_DFC_EXTRA].map((g) => ({ rotulo: g.rotulo, de: g.de, ate: g.ate }))
      : undefined;

  const qsBase = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => k !== "aba" && typeof v === "string") as [string, string][]
  );

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Códigos e listas"
        subtitulo={`Personalize para ${ctx.empresaNome} — cada empresa tem a sua lista`}
        ctx={ctx}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {ABAS.map((a) => {
          const qs = new URLSearchParams(qsBase);
          qs.set("aba", a.chave);
          const ativa = a.chave === aba.chave;
          return (
            <Link
              key={a.chave}
              href={`/codigos?${qs.toString()}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                ativa ? "bg-marca-clara font-medium text-marca" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {a.rotulo}
            </Link>
          );
        })}
      </div>

      <Cartao className="p-4">
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          Os grupos são fixos — é o que mantém a DRE comparável entre empresas. Dentro de cada grupo,
          renomeie à vontade. Campo em branco some das listas de lançamento.
        </p>
        <FormCodigos
          key={aba.chave + ctx.empresaId}
          empresaId={ctx.empresaId}
          tabela={aba.tabela}
          itens={data ?? []}
          faixas={faixas}
        />
      </Cartao>
    </main>
  );
}
