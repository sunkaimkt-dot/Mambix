import { carregarContexto, primeiroDia, ultimoDia } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import Cabecalho from "@/components/Cabecalho";
import FormParametros from "./FormParametros";
import FormSaldoInicial from "./FormSaldoInicial";
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
  const anoAnt = ctx.mes === 1 ? ctx.ano - 1 : ctx.ano;
  const mesAnt = ctx.mes === 1 ? 12 : ctx.mes - 1;

  const [{ data }, { data: anterior }, { data: bancos }, { data: recAnt }, { data: baixasAnt }] = await Promise.all([
    supabase
      .from("parametros_mes")
      .select("margem_bruta_pct, clientes, saldo_inicial")
      .eq("empresa_id", ctx.empresaId)
      .eq("ano", ctx.ano)
      .eq("mes", ctx.mes)
      .maybeSingle(),
    supabase
      .from("parametros_mes")
      .select("saldo_inicial")
      .eq("empresa_id", ctx.empresaId)
      .eq("ano", anoAnt)
      .eq("mes", mesAnt)
      .maybeSingle(),
    supabase.from("bancos").select("id, nome, ativo").eq("empresa_id", ctx.empresaId).order("nome"),
    supabase
      .from("receitas")
      .select("banco_id, valor")
      .eq("empresa_id", ctx.empresaId)
      .gte("data", primeiroDia(anoAnt, mesAnt))
      .lte("data", ultimoDia(anoAnt, mesAnt)),
    supabase
      .from("pagamento_baixas")
      .select("banco_id, valor")
      .eq("empresa_id", ctx.empresaId)
      .gte("data_pagamento", primeiroDia(anoAnt, mesAnt))
      .lte("data_pagamento", ultimoDia(anoAnt, mesAnt)),
  ]);

  const atuais = (data?.saldo_inicial ?? {}) as Record<string, number>;
  const saldoAnt = (anterior?.saldo_inicial ?? null) as Record<string, number> | null;

  /* Sugestao = saldo final do mes anterior, banco a banco:
     saldo inicial anterior + receitas - pagamentos (baixas) daquele banco.
     So existe quando o mes anterior teve saldo informado; sem esse ponto de
     partida, o numero seria so o movimento, e pareceria saldo sem ser. */
  let sugestao: Record<string, number> | null = null;
  if (saldoAnt) {
    sugestao = {};
    for (const b of bancos ?? []) sugestao[b.id] = Number(saldoAnt[b.id] ?? 0);
    for (const r of recAnt ?? []) if (r.banco_id) sugestao[r.banco_id] = (sugestao[r.banco_id] ?? 0) + Number(r.valor);
    for (const x of baixasAnt ?? []) if (x.banco_id) sugestao[x.banco_id] = (sugestao[x.banco_id] ?? 0) - Number(x.valor);
    for (const k of Object.keys(sugestao)) sugestao[k] = Math.round(sugestao[k] * 100) / 100;
  }
  // Banco desligado so aparece se ja tiver saldo informado neste mes.
  const listaBancos = (bancos ?? []).filter((b) => b.ativo || atuais[b.id] !== undefined);

  return (
    <main className="p-6">
      <Cabecalho
        titulo="Parâmetros do mês"
        subtitulo={`${MESES[ctx.mes - 1]}/${ctx.ano} — margem bruta, número de clientes e saldo inicial dos bancos`}
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

      <Cartao className="mt-6 max-w-xl p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Saldo inicial dos bancos — 1º de {MESES[ctx.mes - 1]}/{ctx.ano}
        </p>
        <p className="mb-4 text-xs text-slate-400">
          Quanto havia em cada banco/caixa no primeiro dia do mês. É o ponto de partida do Fluxo Diário. Deixe em
          branco o banco que não usa.
        </p>
        <FormSaldoInicial
          empresaId={ctx.empresaId}
          ano={ctx.ano}
          mes={ctx.mes}
          bancos={listaBancos.map((b) => ({ id: b.id, nome: b.nome }))}
          atuais={atuais}
          sugestao={sugestao}
        />
      </Cartao>
    </main>
  );
}
