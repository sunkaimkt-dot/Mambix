import { carregarContexto, possoGravar } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import { carregarReferencias } from "@/lib/importacao-acoes";
import Cabecalho from "@/components/Cabecalho";
import { Cartao } from "@/components/ui";
import Importador from "./Importador";
import HistoricoImportacoes, { type Lote } from "./HistoricoImportacoes";

export default async function Importar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const supabase = await supabaseServer();
  const [ref, podeGravar, lotesRes] = await Promise.all([
    carregarReferencias(ctx.empresaId),
    possoGravar(),
    supabase
      .from("importacoes")
      .select("id, tipo, arquivo, loja_id, criado_em, linhas_arquivo, linhas_importadas, linhas_rejeitadas, valor_importado, desfeita_em")
      .eq("empresa_id", ctx.empresaId)
      .order("criado_em", { ascending: false })
      .limit(20),
  ]);

  const nomeLoja = Object.fromEntries(ctx.lojas.map((l) => [l.id, l.nome]));
  const lotes: Lote[] = (lotesRes.data ?? []).map((l) => ({
    ...l,
    valor_importado: Number(l.valor_importado),
    loja: l.loja_id ? nomeLoja[l.loja_id] ?? "—" : "—",
  }));
  const lojaPadrao = ctx.lojaId ?? ctx.lojas.find((l) => l.is_matriz)?.id ?? ctx.lojas[0]?.id ?? "";

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Importar Excel, CSV ou extrato"
        subtitulo="Planilhas de pagamentos, receitas e caixa diário, ou extrato bancário (PDF/OFX) — confere linha a linha antes de gravar"
        ctx={ctx}
      />

      {lotesRes.error && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          O histórico de importações ainda não está disponível neste banco (falta aplicar a migration 0120). A importação
          não vai funcionar até isso ser feito.
        </div>
      )}

      {!podeGravar ? (
        <Cartao className="p-6">
          <p className="text-sm text-slate-600">
            Seu acesso é de <strong>consulta</strong>: você pode ver o histórico, mas não pode importar lançamentos.
          </p>
        </Cartao>
      ) : (
        <Importador
          key={ctx.empresaId}
          empresaId={ctx.empresaId}
          lojas={ctx.lojas.map((l) => ({ id: l.id, nome: l.nome }))}
          lojaPadrao={lojaPadrao}
          referencias={ref}
        />
      )}

      <HistoricoImportacoes lotes={lotes} podeDesfazer={podeGravar} />
    </main>
  );
}
