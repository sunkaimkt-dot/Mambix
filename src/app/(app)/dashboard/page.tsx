import Link from "next/link";
import { carregarContexto, primeiroDia, ultimoDia } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import { brl, MESES } from "@/lib/formato";

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await carregarContexto(sp);
  if (!ctx) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-500">Nenhuma empresa cadastrada ainda.</p>
      </main>
    );
  }

  const supabase = await supabaseServer();
  const ini = primeiroDia(ctx.ano, ctx.mes);
  const fim = ultimoDia(ctx.ano, ctx.mes);

  const [vendas, recebido, pagoRes, aPagarRes, atrasadoRes] = await Promise.all([
    supabase.from("caixa_diario").select("valor").eq("empresa_id", ctx.empresaId).gte("data", ini).lte("data", fim),
    supabase.from("receitas").select("valor").eq("empresa_id", ctx.empresaId).gte("data", ini).lte("data", fim),
    // Saidas do mes = baixas, nao vencimentos: e a data do pagamento que conta.
    supabase.from("pagamento_baixas").select("valor").eq("empresa_id", ctx.empresaId).gte("data_pagamento", ini).lte("data_pagamento", fim),
    supabase.from("pagamentos_saldo").select("saldo").eq("empresa_id", ctx.empresaId).eq("comp_ano", ctx.ano).eq("comp_mes", ctx.mes),
    // Contas vencidas antes do mes e ainda nao quitadas.
    supabase.from("pagamentos_saldo").select("saldo").eq("empresa_id", ctx.empresaId).eq("pago", false).lt("vencimento", ini),
  ]);

  const soma = (r: { data: { valor: number }[] | null }) => (r.data ?? []).reduce((s, x) => s + Number(x.valor), 0);
  const somaSaldo = (r: { data: { saldo: number }[] | null }) => (r.data ?? []).reduce((s, x) => s + Number(x.saldo), 0);
  const faturamento = soma(vendas);
  const entradas = soma(recebido);
  const saidas = soma(pagoRes);
  const aPagar = somaSaldo(aPagarRes);
  const atrasado = somaSaldo(atrasadoRes);

  const cards = [
    { rotulo: "Faturamento (vendas)", valor: faturamento, cor: "text-slate-900" },
    { rotulo: "Entradas no caixa", valor: entradas, cor: "text-emerald-700" },
    { rotulo: "Saídas do caixa", valor: saidas, cor: "text-red-700" },
    { rotulo: "Resultado de caixa", valor: entradas - saidas, cor: entradas - saidas >= 0 ? "text-emerald-700" : "text-red-700" },
    { rotulo: "Contas em aberto no mês", valor: aPagar, cor: "text-amber-700" },
    { rotulo: "Atrasado de meses anteriores", valor: atrasado, cor: atrasado > 0 ? "text-red-700" : "text-slate-400" },
  ];

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  ).toString();

  return (
    <main className="p-6">
      <Cabecalho titulo="Painel" subtitulo={`${MESES[ctx.mes - 1]} de ${ctx.ano} — ${ctx.empresaNome}`} ctx={ctx} />

      <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{c.rotulo}</p>
            <p className={`text-xl font-bold ${c.cor}`}>{brl(c.valor)}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Começar por aqui</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/pagamentos", t: "Pagamentos", d: "Tudo que venceu ou foi pago no mês" },
            { href: "/receitas", t: "Receitas", d: "Tudo que entrou no caixa" },
            { href: "/caixa", t: "Caixa Diário", d: "Fechamento de vendas por dia" },
          ].map((a) => (
            <Link
              key={a.href}
              href={`${a.href}${qs ? `?${qs}` : ""}`}
              className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:shadow-sm"
            >
              <p className="font-semibold">{a.t}</p>
              <p className="text-sm text-slate-500">{a.d}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
