import { carregarContexto, primeiroDia, ultimoDia } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import GradeCaixa from "./GradeCaixa";
import { Cartao } from "@/components/ui";
import { MESES } from "@/lib/formato";

export default async function Caixa({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const supabase = await supabaseServer();
  const loja = ctx.lojaId ?? ctx.lojas[0]?.id;
  const [tiposRes, dadosRes] = await Promise.all([
    supabase.from("tipos_venda").select("codigo, nome").eq("empresa_id", ctx.empresaId).order("codigo"),
    supabase
      .from("caixa_diario")
      .select("data, tipo_venda, valor")
      .eq("empresa_id", ctx.empresaId)
      .eq("loja_id", loja)
      .gte("data", primeiroDia(ctx.ano, ctx.mes))
      .lte("data", ultimoDia(ctx.ano, ctx.mes)),
  ]);

  const valores: Record<string, number> = {};
  for (const d of dadosRes.data ?? []) {
    valores[`${Number(d.data.slice(8, 10))}-${d.tipo_venda}`] = Number(d.valor);
  }

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Caixa Diário"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — fechamento de vendas por dia (clique numa célula para editar)`}
        ctx={ctx}
      />
      <Cartao tour="grade" className="overflow-hidden">
        <GradeCaixa
          empresaId={ctx.empresaId}
          lojaId={loja}
          ano={ctx.ano}
          mes={ctx.mes}
          tipos={(tiposRes.data ?? []).filter((t) => t.nome !== "")}
          valores={valores}
        />
      </Cartao>
    </main>
  );
}
