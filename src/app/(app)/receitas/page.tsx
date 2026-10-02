import { carregarContexto, primeiroDia, ultimoDia } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import FormReceita from "./FormReceita";
import BotaoExcluir from "@/components/BotaoExcluir";
import { Cartao, Vazio } from "@/components/ui";
import { brl, MESES } from "@/lib/formato";

export default async function Receitas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const supabase = await supabaseServer();
  const ini = primeiroDia(ctx.ano, ctx.mes);
  const fim = ultimoDia(ctx.ano, ctx.mes);

  const [tiposRes, bancosRes, listaRes] = await Promise.all([
    supabase.from("tipos_recebimento").select("codigo, nome").eq("empresa_id", ctx.empresaId).order("codigo"),
    supabase.from("bancos").select("id, nome").eq("empresa_id", ctx.empresaId).eq("ativo", true).order("nome"),
    supabase
      .from("receitas")
      .select("id, data, descricao, valor, banco_id, tipo_recebimento")
      .eq("empresa_id", ctx.empresaId)
      .gte("data", ini)
      .lte("data", fim)
      .order("data"),
  ]);

  const tipos = (tiposRes.data ?? []).filter((t) => t.nome !== "");
  const nomeTipo = new Map((tiposRes.data ?? []).map((t) => [t.codigo, t.nome]));
  const nomeBanco = new Map((bancosRes.data ?? []).map((b) => [b.id, b.nome]));
  const lista = listaRes.data ?? [];
  const total = lista.reduce((s, r) => s + Number(r.valor), 0);

  const porTipo = tipos.map((t) => ({
    nome: t.nome,
    total: lista.filter((r) => r.tipo_recebimento === t.codigo).reduce((s, r) => s + Number(r.valor), 0),
  }));

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Receitas"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — o que de fato entrou no caixa`}
        ctx={ctx}
      />

      <Cartao tour="form" className="mb-6 p-4">
        <FormReceita
          empresaId={ctx.empresaId}
          lojas={ctx.lojas}
          bancos={bancosRes.data ?? []}
          tipos={tipos}
          mes={ctx.mes}
          ano={ctx.ano}
        />
      </Cartao>

      <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
        <Cartao tour="lista" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Entradas do mês</p>
            <p className="text-sm font-bold text-positivo">{brl(total)}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Dia</th>
                <th className="px-3 py-2 font-semibold">Descrição</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Banco</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 tabular-nums">{r.data.slice(8, 10)}</td>
                  <td className="px-3 py-2">{r.descricao}</td>
                  <td className="px-3 py-2 text-slate-500">{nomeTipo.get(r.tipo_recebimento)}</td>
                  <td className="px-3 py-2 text-slate-500">{r.banco_id ? nomeBanco.get(r.banco_id) : "—"}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{brl(Number(r.valor))}</td>
                  <td className="px-3 py-2 text-right"><BotaoExcluir tabela="receitas" id={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <Vazio texto="Nenhuma entrada lançada neste mês." />}
        </Cartao>

        <Cartao tour="resumo" className="h-fit p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Por tipo de recebimento</p>
          <ul className="space-y-1.5 text-sm">
            {porTipo.map((t) => (
              <li key={t.nome} className="flex justify-between gap-2">
                <span className="text-slate-600">{t.nome}</span>
                <span className="font-medium tabular-nums">{brl(t.total)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </main>
  );
}
