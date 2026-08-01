import { supabaseServer } from "@/lib/supabase-server";
import { primeiroDia, ultimoDia } from "@/lib/contexto";
import { GRUPOS_DRE, GRUPOS_DFC_EXTRA } from "@/lib/formato";

export type LinhaCodigo = { codigo: number; nome: string; valor: number };
export type Grupo = { chave: string; rotulo: string; de: number; ate: number; total: number };

/** DRE = regime de competencia: pagamentos cujo comp_mes/comp_ano batem, pagos ou nao. */
export async function dadosDRE(empresaId: string, ano: number, mes: number, lojaId: string | null) {
  const supabase = await supabaseServer();

  let q = supabase
    .from("pagamentos")
    .select("cd, valor, loja_id")
    .eq("empresa_id", empresaId)
    .eq("comp_ano", ano)
    .eq("comp_mes", mes);
  if (lojaId) q = q.eq("loja_id", lojaId);

  let qv = supabase
    .from("caixa_diario")
    .select("tipo_venda, valor, loja_id")
    .eq("empresa_id", empresaId)
    .gte("data", primeiroDia(ano, mes))
    .lte("data", ultimoDia(ano, mes));
  if (lojaId) qv = qv.eq("loja_id", lojaId);

  const [pagRes, vendasRes, codigosRes, tiposRes, paramRes] = await Promise.all([
    q,
    qv,
    supabase.from("codigos_despesa").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_venda").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("parametros_mes").select("margem_bruta_pct").eq("empresa_id", empresaId).eq("ano", ano).eq("mes", mes).maybeSingle(),
  ]);

  const pagamentos = pagRes.data ?? [];
  const codigos = codigosRes.data ?? [];

  const porCodigo: LinhaCodigo[] = codigos.map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    valor: pagamentos.filter((p) => p.cd === c.codigo).reduce((s, p) => s + Number(p.valor), 0),
  }));

  const grupos: Grupo[] = GRUPOS_DRE.map((g) => ({
    ...g,
    total: porCodigo.filter((c) => c.codigo >= g.de && c.codigo <= g.ate).reduce((s, c) => s + c.valor, 0),
  }));

  const vendas = vendasRes.data ?? [];
  const porTipoVenda = (tiposRes.data ?? [])
    .filter((t) => t.nome !== "")
    .map((t) => ({
      codigo: t.codigo,
      nome: t.nome,
      valor: vendas.filter((v) => v.tipo_venda === t.codigo).reduce((s, v) => s + Number(v.valor), 0),
    }));

  const faturamento = vendas.reduce((s, v) => s + Number(v.valor), 0);
  const despesas = grupos.reduce((s, g) => s + g.total, 0);
  const margem = Number(paramRes.data?.margem_bruta_pct ?? 0);
  const lucroBruto = faturamento * margem;
  const cmv = faturamento - lucroBruto;
  const resultado = lucroBruto - despesas;

  return { porCodigo, grupos, porTipoVenda, faturamento, despesas, margem, lucroBruto, cmv, resultado };
}

/**
 * DFC = regime de caixa. Le das BAIXAS, nao dos pagamentos: o que importa aqui e
 * o dia em que o dinheiro saiu, que pode ser de mes diferente do vencimento.
 * Um aluguel que venceu em junho e foi pago em julho aparece no DFC de julho.
 */
export async function dadosDFC(empresaId: string, ano: number, mes: number, lojaId: string | null) {
  const supabase = await supabaseServer();
  const ini = primeiroDia(ano, mes);
  const fim = ultimoDia(ano, mes);

  const q = supabase
    .from("pagamento_baixas")
    .select("valor, pagamentos!inner(cd, cfc, loja_id)")
    .eq("empresa_id", empresaId)
    .gte("data_pagamento", ini)
    .lte("data_pagamento", fim);

  const [baixaRes, recRes, codigosRes, tiposRes] = await Promise.all([
    q,
    supabase.from("receitas").select("tipo_recebimento, valor").eq("empresa_id", empresaId).gte("data", ini).lte("data", fim),
    supabase.from("codigos_despesa").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_recebimento").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
  ]);

  type BaixaJoin = { valor: number; pagamentos: { cd: number; cfc: number; loja_id: string | null } | null };
  const pagamentos = ((baixaRes.data ?? []) as unknown as BaixaJoin[])
    .filter((b) => b.pagamentos && (!lojaId || b.pagamentos.loja_id === lojaId))
    .map((b) => ({ valor: Number(b.valor), cd: b.pagamentos!.cd, cfc: b.pagamentos!.cfc }));
  const porCodigo: LinhaCodigo[] = (codigosRes.data ?? []).map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    valor: pagamentos.filter((p) => p.cd === c.codigo).reduce((s, p) => s + Number(p.valor), 0),
  }));

  const grupos: Grupo[] = [...GRUPOS_DRE, ...GRUPOS_DFC_EXTRA].map((g) => ({
    ...g,
    total: porCodigo.filter((c) => c.codigo >= g.de && c.codigo <= g.ate).reduce((s, c) => s + c.valor, 0),
  }));

  const receitas = recRes.data ?? [];
  const porTipoRecebimento = (tiposRes.data ?? [])
    .filter((t) => t.nome !== "")
    .map((t) => ({
      codigo: t.codigo,
      nome: t.nome,
      valor: receitas.filter((r) => r.tipo_recebimento === t.codigo).reduce((s, r) => s + Number(r.valor), 0),
    }));

  const porCFC = [1, 2, 3, 4].map((c) => ({
    cfc: c,
    total: pagamentos.filter((p) => p.cfc === c).reduce((s, p) => s + Number(p.valor), 0),
  }));

  const entradas = receitas.reduce((s, r) => s + Number(r.valor), 0);
  const saidas = pagamentos.reduce((s, p) => s + Number(p.valor), 0);

  return { porCodigo, grupos, porTipoRecebimento, porCFC, entradas, saidas, resultado: entradas - saidas };
}

export type SerieAnual = {
  codigo: number;
  nome: string;
  regime: "competencia" | "caixa";
  ano: number;
  meses: number[]; // 12 posicoes, janeiro a dezembro
};

/**
 * Evolucao de 12 meses de um codigo de despesa.
 * O regime acompanha a tela de origem: na DRE olha a competencia, no DFC olha
 * a data em que o dinheiro saiu. O mesmo codigo pode ter curvas diferentes nos
 * dois relatorios -- e justamente essa diferenca que revela atraso de pagamento.
 */
export async function serieAnualCodigo(
  empresaId: string,
  codigo: number,
  ano: number,
  regime: "competencia" | "caixa",
  lojaId: string | null
): Promise<SerieAnual> {
  const supabase = await supabaseServer();
  const meses = Array(12).fill(0) as number[];

  const { data: cod } = await supabase
    .from("codigos_despesa")
    .select("nome")
    .eq("empresa_id", empresaId)
    .eq("codigo", codigo)
    .maybeSingle();

  if (regime === "competencia") {
    let q = supabase
      .from("pagamentos")
      .select("comp_mes, valor, loja_id")
      .eq("empresa_id", empresaId)
      .eq("cd", codigo)
      .eq("comp_ano", ano);
    if (lojaId) q = q.eq("loja_id", lojaId);
    const { data } = await q;
    for (const p of data ?? []) meses[p.comp_mes - 1] += Number(p.valor);
  } else {
    const { data } = await supabase
      .from("pagamento_baixas")
      .select("data_pagamento, valor, pagamentos!inner(cd, loja_id)")
      .eq("empresa_id", empresaId)
      .eq("pagamentos.cd", codigo)
      .gte("data_pagamento", `${ano}-01-01`)
      .lte("data_pagamento", `${ano}-12-31`);

    type Linha = { data_pagamento: string; valor: number; pagamentos: { loja_id: string | null } | null };
    for (const b of (data ?? []) as unknown as Linha[]) {
      if (lojaId && b.pagamentos?.loja_id !== lojaId) continue;
      meses[Number(b.data_pagamento.slice(5, 7)) - 1] += Number(b.valor);
    }
  }

  return { codigo, nome: cod?.nome ?? "", regime, ano, meses };
}
