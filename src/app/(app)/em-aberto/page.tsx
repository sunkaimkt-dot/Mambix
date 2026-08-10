import { carregarContexto, primeiroDia } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import Baixa from "@/components/Baixa";
import { Cartao, Vazio } from "@/components/ui";
import { brl, MESES } from "@/lib/formato";

/**
 * Contas com saldo em aberto, atrasadas primeiro.
 *
 * Existe para responder a duvida que o cliente levantou: "lancei o aluguel em
 * junho e nao paguei; em julho vou pagar -- como faco sem duplicar a DRE?".
 * A resposta e nao lancar de novo: achar a conta aqui e dar baixa com a data de
 * julho. A competencia continua junho, o dinheiro sai em julho.
 */
export default async function EmAberto({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const supabase = await supabaseServer();
  const inicioDoMes = primeiroDia(ctx.ano, ctx.mes);

  const [listaRes, codigosRes, formasRes, bancosRes] = await Promise.all([
    supabase
      .from("pagamentos_saldo")
      .select("id, vencimento, cd, descricao, valor, total_pago, saldo, comp_mes, comp_ano, loja_id")
      .eq("empresa_id", ctx.empresaId)
      .eq("pago", false)
      .order("vencimento"),
    supabase.from("codigos_despesa").select("codigo, nome").eq("empresa_id", ctx.empresaId).order("codigo"),
    supabase.from("formas_pagamento").select("codigo, nome").eq("empresa_id", ctx.empresaId).order("codigo"),
    supabase.from("bancos").select("id, nome").eq("empresa_id", ctx.empresaId).eq("ativo", true).order("nome"),
  ]);

  const nomeCodigo = new Map((codigosRes.data ?? []).map((c) => [c.codigo, c.nome]));
  const lista = (listaRes.data ?? []).filter((p) => !ctx.lojaId || p.loja_id === ctx.lojaId);

  const { data: baixasData } = await supabase
    .from("pagamento_baixas")
    .select("id, pagamento_id, data_pagamento, valor")
    .in("pagamento_id", lista.length ? lista.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"])
    .order("data_pagamento");

  const baixasPor = new Map<string, { id: string; data_pagamento: string; valor: number }[]>();
  for (const b of baixasData ?? []) {
    const arr = baixasPor.get(b.pagamento_id) ?? [];
    arr.push({ id: b.id, data_pagamento: b.data_pagamento, valor: Number(b.valor) });
    baixasPor.set(b.pagamento_id, arr);
  }

  const atrasadas = lista.filter((p) => p.vencimento < inicioDoMes);
  const doMesOuFuturas = lista.filter((p) => p.vencimento >= inicioDoMes);

  const totalAtrasado = atrasadas.reduce((s, p) => s + Number(p.saldo), 0);
  const totalAberto = lista.reduce((s, p) => s + Number(p.saldo), 0);

  const formas = (formasRes.data ?? []).filter((f) => f.nome !== "");
  const bancos = bancosRes.data ?? [];

  function Tabela({ linhas, titulo, alerta }: { linhas: typeof lista; titulo: string; alerta?: boolean }) {
    if (linhas.length === 0) return null;
    return (
      <Cartao className="mb-6">
        <p className={`border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${
          alerta ? "text-negativo" : "text-slate-500"
        }`}>
          {titulo}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Vencimento</th>
                <th className="px-3 py-2 font-semibold">Competência</th>
                <th className="px-3 py-2 font-semibold">Cód.</th>
                <th className="px-3 py-2 font-semibold">Descrição</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
                <th className="px-3 py-2 text-right font-semibold">Já pago</th>
                <th className="px-3 py-2 text-right font-semibold">Falta</th>
                <th className="px-3 py-2 font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {p.vencimento.split("-").reverse().join("/")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {MESES[p.comp_mes - 1]}/{p.comp_ano}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="font-medium">{p.cd}</span>{" "}
                    <span className="text-slate-500">{nomeCodigo.get(p.cd)}</span>
                  </td>
                  <td className="px-3 py-2">{p.descricao}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{brl(Number(p.valor))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-500">
                    {Number(p.total_pago) > 0 ? brl(Number(p.total_pago)) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                    {brl(Number(p.saldo))}
                  </td>
                  <td className="px-3 py-2">
                    <Baixa
                      pagamentoId={p.id}
                      valor={Number(p.valor)}
                      totalPago={Number(p.total_pago)}
                      baixas={baixasPor.get(p.id) ?? []}
                      formas={formas}
                      bancos={bancos}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    );
  }

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Contas em aberto"
        subtitulo="Pague daqui em vez de lançar de novo — assim a competência não duplica"
        ctx={ctx}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total em aberto</p>
          <p className="text-xl font-bold text-amber-700">{brl(totalAberto)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Vencido e não pago</p>
          <p className={`text-xl font-bold ${totalAtrasado > 0 ? "text-negativo" : "text-slate-400"}`}>
            {brl(totalAtrasado)}
          </p>
        </div>
      </div>

      <Tabela linhas={atrasadas} titulo="Vencidas — pague com a data real do pagamento" alerta />
      <Tabela linhas={doMesOuFuturas} titulo="A vencer" />

      {lista.length === 0 && (
        <Cartao>
          <Vazio texto="Nenhuma conta em aberto. Tudo quitado." />
        </Cartao>
      )}
    </main>
  );
}
