import { supabaseServer } from "@/lib/supabase-server";
import { primeiroDia, ultimoDia } from "@/lib/contexto";
import type { BaseAno, BaixaCaixa, PagamentoComp, ParametroMes, Receita, Venda } from "@/lib/contabil-calculo";

/*
 * Leituras do Combo 2 (DRE Contabil, Fluxo Contabil, Evolucao DRE/DFC).
 * Arquivo separado do relatorios.ts de proposito: os combos rodam em paralelo
 * e relatorios.ts nao pode ser editado. Os calculos ficam em contabil-calculo.ts.
 *
 * Toda consulta que pode passar de 1.000 linhas e PAGINADA (mesmo padrao do
 * relatorios-diarios.ts do Combo 1): o PostgREST corta em 1.000 sem avisar, e
 * num ano inteiro de lancamentos isso viraria numero errado e silencioso.
 */

const PAGINA = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarTudo<T>(montar: () => any): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar().range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const linhas = (data ?? []) as T[];
    tudo.push(...linhas);
    if (linhas.length < PAGINA) break;
  }
  return tudo;
}

/**
 * Le tudo o que os relatorios do combo precisam para um intervalo de meses do
 * mesmo ano (1 mes para DRE/Fluxo Contabil, 12 para as Evolucoes).
 *
 * Filtro de loja, igual a relatorios.ts:
 *   - pagamentos e caixa_diario: pela loja do lancamento;
 *   - baixas: pela loja da conta (pagamentos.loja_id);
 *   - receitas: SEM filtro de loja -- o DFC atual nao filtra. Divergencia com o
 *     Painel e os diarios do Combo 1 registrada em claude/combo-2.md, para
 *     decidir com o Marcelo.
 */
export async function lerBase(
  empresaId: string,
  ano: number,
  lojaId: string | null,
  mesIni = 1,
  mesFim = 12
): Promise<BaseAno> {
  const supabase = await supabaseServer();
  const ini = primeiroDia(ano, mesIni);
  const fim = ultimoDia(ano, mesFim);

  const pagamentosP = buscarTudo<PagamentoComp & { id: string }>(() => {
    let q = supabase
      .from("pagamentos")
      .select("id, cd, valor, comp_mes")
      .eq("empresa_id", empresaId)
      .eq("comp_ano", ano)
      .gte("comp_mes", mesIni)
      .lte("comp_mes", mesFim)
      .order("id");
    if (lojaId) q = q.eq("loja_id", lojaId);
    return q;
  });

  const vendasP = buscarTudo<Venda & { id: string }>(() => {
    let q = supabase
      .from("caixa_diario")
      .select("id, data, tipo_venda, valor")
      .eq("empresa_id", empresaId)
      .gte("data", ini)
      .lte("data", fim)
      .order("id");
    if (lojaId) q = q.eq("loja_id", lojaId);
    return q;
  });

  type BaixaJoin = {
    id: string;
    data_pagamento: string;
    valor: number;
    pagamentos: { cd: number; cfc: number; loja_id: string | null } | null;
  };
  const baixasP = buscarTudo<BaixaJoin>(() =>
    supabase
      .from("pagamento_baixas")
      .select("id, data_pagamento, valor, pagamentos!inner(cd, cfc, loja_id)")
      .eq("empresa_id", empresaId)
      .gte("data_pagamento", ini)
      .lte("data_pagamento", fim)
      .order("id")
  );

  const receitasP = buscarTudo<Receita & { id: string }>(() =>
    supabase
      .from("receitas")
      .select("id, data, tipo_recebimento, valor")
      .eq("empresa_id", empresaId)
      .gte("data", ini)
      .lte("data", fim)
      .order("id")
  );

  const [pagamentos, vendas, baixasJoin, receitas, codigosRes, tvRes, trRes, paramRes] = await Promise.all([
    pagamentosP,
    vendasP,
    baixasP,
    receitasP,
    supabase.from("codigos_despesa").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_venda").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_recebimento").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase
      .from("parametros_mes")
      .select("mes, margem_bruta_pct, saldo_inicial")
      .eq("empresa_id", empresaId)
      .eq("ano", ano)
      .gte("mes", mesIni)
      .lte("mes", mesFim),
  ]);

  const baixas: BaixaCaixa[] = baixasJoin
    .filter((b) => b.pagamentos && (!lojaId || b.pagamentos.loja_id === lojaId))
    .map((b) => ({ data_pagamento: b.data_pagamento, valor: Number(b.valor), cd: b.pagamentos!.cd, cfc: b.pagamentos!.cfc }));

  return {
    ano,
    codigos: codigosRes.data ?? [],
    tiposVenda: tvRes.data ?? [],
    tiposRecebimento: trRes.data ?? [],
    pagamentos,
    vendas,
    baixas,
    receitas,
    parametros: (paramRes.data ?? []) as ParametroMes[],
  };
}

/** Le o "lucro desejavel %" da URL (?ld=10 = 10%). Fora do intervalo 0-100 volta ao padrao. */
export function lerLucroDesejavel(sp: Record<string, string | string[] | undefined>, padrao: number): number {
  const v = typeof sp.ld === "string" ? Number(sp.ld.replace(",", ".")) : NaN;
  if (Number.isNaN(v) || v < 0 || v >= 100) return padrao;
  return v / 100;
}
