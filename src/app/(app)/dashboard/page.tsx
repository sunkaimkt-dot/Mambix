import Link from "next/link";
import { carregarContexto } from "@/lib/contexto";
import Cabecalho from "@/components/Cabecalho";
import { Cartao } from "@/components/ui";
import { brl, MESES, MESES_CURTO } from "@/lib/formato";
import { dadosDRE } from "@/lib/relatorios";
import {
  contasAPagar,
  resumoMes,
  serieCaixa12Meses,
  serieResultado12Meses,
} from "@/lib/relatorios-diarios";
import { BarrasHorizontais, GraficoEntradasSaidas, GraficoResultado, type ItemBarra } from "@/components/GraficosPainel";

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

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD

  const [resumo, caixa12, resultado12, dre, faixasAPagar] = await Promise.all([
    resumoMes(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId),
    serieCaixa12Meses(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId),
    serieResultado12Meses(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId),
    dadosDRE(ctx.empresaId, ctx.ano, ctx.mes, ctx.lojaId),
    contasAPagar(ctx.empresaId, ctx.lojaId, hoje),
  ]);

  const faturamento = resumo.faturamento;
  const entradas = resumo.entradas;
  const saidas = resumo.saidas;
  const aPagar = resumo.emAbertoNoMes;
  const atrasado = resumo.atrasadoAntes;

  // Despesas por grupo (competencia, mes selecionado): os 5 maiores + "Outros".
  const gruposOrdenados = [...dre.grupos].filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
  const TOPO = 5;
  const itensGrupo: ItemBarra[] = gruposOrdenados.slice(0, TOPO).map((g) => ({
    rotulo: g.rotulo,
    valor: g.total,
    detalhe: dre.despesas ? `${((g.total / dre.despesas) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : undefined,
  }));
  const resto = gruposOrdenados.slice(TOPO).reduce((s, g) => s + g.total, 0);
  if (resto > 0) itensGrupo.push({ rotulo: "Outros", valor: resto, cor: "#94a3b8" });

  const itensAPagar: ItemBarra[] = faixasAPagar.map((f) => ({
    rotulo: f.rotulo,
    valor: f.valor,
    detalhe: f.quantidade ? `${f.quantidade} conta${f.quantidade > 1 ? "s" : ""}` : undefined,
    cor: f.atrasado ? "#dc2626" : "#d97706",
  }));
  const totalAPagar30 = faixasAPagar.reduce((s, f) => s + f.valor, 0);

  const cards = [
    { rotulo: "Faturamento (vendas)", valor: faturamento, cor: "text-slate-900" },
    { rotulo: "Entradas no caixa", valor: entradas, cor: "text-positivo" },
    { rotulo: "Saídas do caixa", valor: saidas, cor: "text-negativo" },
    { rotulo: "Resultado de caixa", valor: entradas - saidas, cor: entradas - saidas >= 0 ? "text-positivo" : "text-negativo" },
    { rotulo: "Contas em aberto no mês", valor: aPagar, cor: "text-amber-700" },
    { rotulo: "Atrasado de meses anteriores", valor: atrasado, cor: atrasado > 0 ? "text-negativo" : "text-slate-400" },
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

      <section className="mb-8 grid gap-6 xl:grid-cols-2">
        <Cartao className="p-4">
          <h2 className="text-sm font-semibold">Entradas x Saídas — últimos 12 meses</h2>
          <p className="mb-3 text-xs text-slate-500">
            Regime de caixa (mesma base do DFC), até {MESES_CURTO[ctx.mes - 1]}/{ctx.ano}
          </p>
          <GraficoEntradasSaidas pontos={caixa12} />
        </Cartao>

        <Cartao className="p-4">
          <h2 className="text-sm font-semibold">Resultado mensal — últimos 12 meses</h2>
          <p className="mb-3 text-xs text-slate-500">
            Regime de competência (mesma conta da DRE: faturamento × margem − despesas)
          </p>
          <GraficoResultado pontos={resultado12} />
        </Cartao>

        <Cartao className="p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Despesas por grupo — {MESES[ctx.mes - 1]}/{ctx.ano}</h2>
              <p className="text-xs text-slate-500">Competência, grupos da DRE. % sobre o total de despesas.</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-negativo">{brl(dre.despesas)}</p>
          </div>
          <BarrasHorizontais itens={itensGrupo} vazio="Nenhuma despesa com competência neste mês." />
        </Cartao>

        <Cartao className="p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Contas a pagar — atrasado e próximos 30 dias</h2>
              <p className="text-xs text-slate-500">Contado a partir de hoje, pelo saldo que falta pagar.</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-amber-700">{brl(totalAPagar30)}</p>
          </div>
          <BarrasHorizontais itens={itensAPagar} vazio="Nenhuma conta em aberto vencida ou vencendo nos próximos 30 dias." />
          <Link
            href={`/em-aberto${qs ? `?${qs}` : ""}`}
            className="mt-3 inline-block text-xs font-medium text-marca hover:underline"
          >
            Ver contas em aberto →
          </Link>
        </Cartao>
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
              className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-marca hover:shadow-sm"
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
