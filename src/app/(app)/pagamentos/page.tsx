import { carregarContexto } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import FormPagamento from "./FormPagamento";
import BotaoExcluir from "@/components/BotaoExcluir";
import Baixa from "@/components/Baixa";
import { Cartao, Vazio } from "@/components/ui";
import { brl, MESES, GRUPOS_DRE, GRUPOS_DFC_EXTRA } from "@/lib/formato";

export default async function Pagamentos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) return <main className="p-6"><p className="text-sm text-slate-500">Cadastre uma empresa primeiro.</p></main>;

  const supabase = await supabaseServer();
  const [codigosRes, formasRes, bancosRes, listaRes] = await Promise.all([
    supabase.from("codigos_despesa").select("codigo, nome, grupo").eq("empresa_id", ctx.empresaId).order("codigo"),
    supabase.from("formas_pagamento").select("codigo, nome").eq("empresa_id", ctx.empresaId).order("codigo"),
    supabase.from("bancos").select("id, nome").eq("empresa_id", ctx.empresaId).eq("ativo", true).order("nome"),
    supabase
      .from("pagamentos_saldo")
      .select("id, vencimento, cfc, cd, descricao, valor, pago, cp, comp_mes, comp_ano, loja_id, banco_id, total_pago, saldo")
      .eq("empresa_id", ctx.empresaId)
      .eq("comp_ano", ctx.ano)
      .eq("comp_mes", ctx.mes)
      .order("vencimento"),
  ]);

  const codigos = (codigosRes.data ?? []).filter((c) => c.nome !== "");
  // Oferecidos no campo de juro da baixa, quando o valor pago passa do saldo.
  const codigosJuros = codigos.filter((c) => c.grupo === "FINANCEIRAS");
  const nomeCodigo = new Map((codigosRes.data ?? []).map((c) => [c.codigo, c.nome]));
  const nomeForma = new Map((formasRes.data ?? []).map((f) => [f.codigo, f.nome]));
  const nomeBanco = new Map((bancosRes.data ?? []).map((b) => [b.id, b.nome]));
  const lista = (listaRes.data ?? []).filter((p) => !ctx.lojaId || p.loja_id === ctx.lojaId);

  // Baixas de todos os lancamentos da tela, para montar o historico de cada linha.
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

  const total = lista.reduce((s, p) => s + Number(p.valor), 0);
  const totalPago = lista.reduce((s, p) => s + Number(p.total_pago), 0);

  const grupos = [...GRUPOS_DRE, ...GRUPOS_DFC_EXTRA].map((g) => ({
    rotulo: g.rotulo,
    total: lista.filter((p) => p.cd >= g.de && p.cd <= g.ate).reduce((s, p) => s + Number(p.valor), 0),
  }));

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Pagamentos"
        subtitulo={`Competência ${MESES[ctx.mes - 1]}/${ctx.ano} — lance tudo que venceu no mês, pago ou não`}
        ctx={ctx}
      />

      <Cartao tour="form" className="mb-6 p-4">
        <FormPagamento
          empresaId={ctx.empresaId}
          lojas={ctx.lojas}
          bancos={bancosRes.data ?? []}
          codigos={codigos}
          formas={(formasRes.data ?? []).filter((f) => f.nome !== "")}
          mes={ctx.mes}
          ano={ctx.ano}
        />
      </Cartao>

      <div data-tour="totais" className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total do mês (competência)</p>
          <p className="text-xl font-bold">{brl(total)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Já pago</p>
          <p className="text-xl font-bold text-sky-700">{brl(totalPago)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Em aberto</p>
          <p className="text-xl font-bold text-amber-700">{brl(total - totalPago)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
        <Cartao tour="lista" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Venc.</th>
                  <th className="px-3 py-2 font-semibold">Cód.</th>
                  <th className="px-3 py-2 font-semibold">Descrição</th>
                  <th className="px-3 py-2 font-semibold">Forma</th>
                  <th className="px-3 py-2 font-semibold">Banco</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                  <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                  <th className="px-3 py-2 font-semibold">Situação</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{p.vencimento.slice(8, 10)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="font-medium">{p.cd}</span>{" "}
                      <span className="text-slate-500">{nomeCodigo.get(p.cd)}</span>
                    </td>
                    <td className="px-3 py-2">{p.descricao}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{p.cp ? nomeForma.get(p.cp) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                      {p.banco_id ? nomeBanco.get(p.banco_id) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{brl(Number(p.valor))}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-500">
                      {Number(p.saldo) > 0.009 ? brl(Number(p.saldo)) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Baixa
                        pagamentoId={p.id}
                        valor={Number(p.valor)}
                        totalPago={Number(p.total_pago)}
                        baixas={baixasPor.get(p.id) ?? []}
                        formas={(formasRes.data ?? []).filter((f) => f.nome !== "")}
                        bancos={bancosRes.data ?? []}
                        codigosJuros={codigosJuros}
                      />
                    </td>
                    <td className="px-3 py-2 text-right"><BotaoExcluir tabela="pagamentos" id={p.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length === 0 && <Vazio texto="Nenhum pagamento lançado neste mês." />}
          </div>
        </Cartao>

        <Cartao tour="grupos" className="h-fit p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Total por grupo</p>
          <ul className="space-y-1.5 text-sm">
            {grupos.map((g) => (
              <li key={g.rotulo} className="flex justify-between gap-2">
                <span className="text-slate-600">{g.rotulo}</span>
                <span className="font-medium tabular-nums">{brl(g.total)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </main>
  );
}
