import { carregarContexto } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import { Cartao } from "@/components/ui";
import { ListaBancos, ListaLojas } from "./Listas";

/**
 * Bancos e lojas da empresa aberta.
 *
 * Bancos alimentam "local de pagamento" (Pagamentos), "banco" (Receitas) e o
 * saldo inicial do Fluxo Diario. Lojas separam matriz e filiais nos
 * lancamentos e nos relatorios.
 */
export default async function BancosELojas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const supabase = await supabaseServer();
  const [bancosRes, lojasRes] = await Promise.all([
    supabase.from("bancos").select("id, nome, ativo").eq("empresa_id", ctx.empresaId).order("ativo", { ascending: false }).order("nome"),
    supabase.from("lojas").select("id, nome, is_matriz").eq("empresa_id", ctx.empresaId).order("is_matriz", { ascending: false }).order("nome"),
  ]);

  return (
    <main className="p-6">
      <Cabecalho titulo="Bancos e lojas" subtitulo={ctx.empresaNome} ctx={ctx} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao tour="bancos" className="p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bancos e caixas</p>
          <p className="mb-4 text-xs text-slate-400">
            Onde o dinheiro entra e sai. Desligar não apaga: o banco só some das listas de lançamento novo. O saldo
            inicial de cada um fica em Parâmetros do mês.
          </p>
          <ListaBancos empresaId={ctx.empresaId} bancos={bancosRes.data ?? []} />
        </Cartao>
        <Cartao tour="lojas" className="p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Lojas</p>
          <p className="mb-4 text-xs text-slate-400">
            Matriz e filiais. Os relatórios podem ser vistos por loja ou com todas juntas (consolidado).
          </p>
          <ListaLojas empresaId={ctx.empresaId} lojas={lojasRes.data ?? []} />
        </Cartao>
      </div>
    </main>
  );
}
