import { carregarContexto } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import FormParametros from "./FormParametros";
import { Cartao } from "@/components/ui";
import { MESES } from "@/lib/formato";

export default async function Parametros({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("parametros_mes")
    .select("margem_bruta_pct, clientes")
    .eq("empresa_id", ctx.empresaId)
    .eq("ano", ctx.ano)
    .eq("mes", ctx.mes)
    .maybeSingle();

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Parâmetros do mês"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — margem bruta e número de clientes`}
        ctx={ctx}
      />
      <Cartao className="max-w-xl p-5">
        <FormParametros
          empresaId={ctx.empresaId}
          ano={ctx.ano}
          mes={ctx.mes}
          margem={data?.margem_bruta_pct ? Number(data.margem_bruta_pct) * 100 : null}
          clientes={data?.clientes ?? null}
        />
      </Cartao>
    </main>
  );
}
