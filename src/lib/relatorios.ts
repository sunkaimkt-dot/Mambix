import { supabaseServer } from "@/lib/supabase-server";
import { primeiroDia, ultimoDia } from "@/lib/contexto";
import { GRUPOS_DRE, GRUPOS_DFC_EXTRA, brl } from "@/lib/formato";

const TODOS_GRUPOS = [...GRUPOS_DRE, ...GRUPOS_DFC_EXTRA];

export type LinhaCodigo = { codigo: number; nome: string; valor: number };
export type Grupo = { chave: string; rotulo: string; de: number; ate: number; total: number };

/**
 * Filtro do relatorio inteiro -- o equivalente ao filtro da planilha.
 * Afeta apenas as DESPESAS. Faturamento e entradas continuam cheios, porque
 * filtrar venda por "descricao da despesa" nao faz sentido; a tela avisa isso.
 */
export type FiltroRelatorio = {
  texto?: string;
  min?: number;
  max?: number;
  cp?: number;
  situacao?: "pagos" | "abertos";
};

export function filtroVazio(f: FiltroRelatorio) {
  return (
    !f.texto?.trim() &&
    f.min === undefined &&
    f.max === undefined &&
    f.cp === undefined &&
    !f.situacao
  );
}

/** Le o filtro a partir dos parametros da URL. */
export function lerFiltro(sp: Record<string, string | string[] | undefined>): FiltroRelatorio {
  const txt = (k: string) => (typeof sp[k] === "string" && sp[k] !== "" ? (sp[k] as string) : undefined);
  const nmr = (k: string) => {
    const v = txt(k);
    if (v === undefined) return undefined;
    const n = Number(v.replace(",", "."));
    return Number.isNaN(n) ? undefined : n;
  };
  const sit = txt("situacao");
  return {
    texto: txt("q"),
    min: nmr("min"),
    max: nmr("max"),
    cp: nmr("cp"),
    situacao: sit === "pagos" || sit === "abertos" ? sit : undefined,
  };
}

/** DRE = regime de competencia: pagamentos cujo comp_mes/comp_ano batem, pagos ou nao. */
export async function dadosDRE(
  empresaId: string,
  ano: number,
  mes: number,
  lojaId: string | null,
  filtro: FiltroRelatorio = {}
) {
  const supabase = await supabaseServer();

  let q = supabase
    .from("pagamentos")
    .select("cd, valor, loja_id")
    .eq("empresa_id", empresaId)
    .eq("comp_ano", ano)
    .eq("comp_mes", mes);
  if (lojaId) q = q.eq("loja_id", lojaId);
  if (filtro.texto?.trim()) q = q.ilike("descricao", `%${filtro.texto.trim()}%`);
  if (filtro.min !== undefined) q = q.gte("valor", filtro.min);
  if (filtro.max !== undefined) q = q.lte("valor", filtro.max);
  if (filtro.cp !== undefined) q = q.eq("cp", filtro.cp);
  if (filtro.situacao) q = q.eq("pago", filtro.situacao === "pagos");

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
export async function dadosDFC(
  empresaId: string,
  ano: number,
  mes: number,
  lojaId: string | null,
  filtro: FiltroRelatorio = {}
) {
  const supabase = await supabaseServer();
  const ini = primeiroDia(ano, mes);
  const fim = ultimoDia(ano, mes);

  let q = supabase
    .from("pagamento_baixas")
    .select("valor, pagamentos!inner(cd, cfc, loja_id, descricao)")
    .eq("empresa_id", empresaId)
    .gte("data_pagamento", ini)
    .lte("data_pagamento", fim);
  // No caixa o valor filtrado e o da BAIXA, nao o da conta: se ele procura
  // pagamentos acima de 500, quer os que sairam acima de 500.
  if (filtro.texto?.trim()) q = q.ilike("pagamentos.descricao", `%${filtro.texto.trim()}%`);
  if (filtro.min !== undefined) q = q.gte("valor", filtro.min);
  if (filtro.max !== undefined) q = q.lte("valor", filtro.max);
  if (filtro.cp !== undefined) q = q.eq("cp", filtro.cp);

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

export type LinhaDetalhe = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  loja: string | null;
  forma: string | null;
  banco: string | null;
  situacao: string | null;
};

/**
 * Lancamentos que formaram o total de um codigo no mes.
 *
 * O regime importa e nao e detalhe: na DRE lista os PAGAMENTOS por competencia
 * (uma conta de 1.000 aparece uma linha de 1.000, paga ou nao); no DFC lista as
 * BAIXAS (a mesma conta paga em duas parcelas vira duas linhas, em meses
 * diferentes). Se misturasse, a soma do detalhe nao bateria com o total que o
 * usuario clicou -- e e justamente essa conferencia que ele quer fazer.
 */
export async function detalhesCodigo(
  empresaId: string,
  codigo: number,
  ano: number,
  mes: number,
  regime: "competencia" | "caixa",
  lojaId: string | null,
  filtro: FiltroRelatorio = {}
): Promise<LinhaDetalhe[]> {
  const supabase = await supabaseServer();
  const ini = primeiroDia(ano, mes);
  const fim = ultimoDia(ano, mes);

  const [formasRes, bancosRes, lojasRes] = await Promise.all([
    supabase.from("formas_pagamento").select("codigo, nome").eq("empresa_id", empresaId),
    supabase.from("bancos").select("id, nome").eq("empresa_id", empresaId),
    supabase.from("lojas").select("id, nome").eq("empresa_id", empresaId),
  ]);
  const nomeForma = new Map((formasRes.data ?? []).map((f) => [f.codigo, f.nome]));
  const nomeBanco = new Map((bancosRes.data ?? []).map((b) => [b.id, b.nome]));
  const nomeLoja = new Map((lojasRes.data ?? []).map((l) => [l.id, l.nome]));

  if (regime === "competencia") {
    let q = supabase
      .from("pagamentos_saldo")
      .select("id, vencimento, descricao, valor, saldo, pago, cp, banco_id, loja_id")
      .eq("empresa_id", empresaId)
      .eq("cd", codigo)
      .eq("comp_ano", ano)
      .eq("comp_mes", mes)
      .order("vencimento");
    if (lojaId) q = q.eq("loja_id", lojaId);
    // O detalhe herda o filtro do relatorio: se a tela esta filtrada, a soma do
    // modal tem que continuar batendo com o numero que ele clicou.
    if (filtro.texto?.trim()) q = q.ilike("descricao", `%${filtro.texto.trim()}%`);
    if (filtro.min !== undefined) q = q.gte("valor", filtro.min);
    if (filtro.max !== undefined) q = q.lte("valor", filtro.max);
    if (filtro.cp !== undefined) q = q.eq("cp", filtro.cp);
    if (filtro.situacao) q = q.eq("pago", filtro.situacao === "pagos");
    const { data } = await q;

    return (data ?? []).map((p) => ({
      id: p.id,
      data: p.vencimento,
      descricao: p.descricao || "(sem descrição)",
      valor: Number(p.valor),
      loja: p.loja_id ? nomeLoja.get(p.loja_id) ?? null : null,
      forma: p.cp ? nomeForma.get(p.cp) ?? null : null,
      banco: p.banco_id ? nomeBanco.get(p.banco_id) ?? null : null,
      situacao: p.pago
        ? "Pago"
        : Number(p.saldo) < Number(p.valor)
          ? `Parcial · falta ${brl(Number(p.saldo))}`
          : "Em aberto",
    }));
  }

  let qb = supabase
    .from("pagamento_baixas")
    .select("id, data_pagamento, valor, cp, banco_id, pagamentos!inner(cd, descricao, loja_id)")
    .eq("empresa_id", empresaId)
    .eq("pagamentos.cd", codigo)
    .gte("data_pagamento", ini)
    .lte("data_pagamento", fim)
    .order("data_pagamento");
  if (filtro.texto?.trim()) qb = qb.ilike("pagamentos.descricao", `%${filtro.texto.trim()}%`);
  if (filtro.min !== undefined) qb = qb.gte("valor", filtro.min);
  if (filtro.max !== undefined) qb = qb.lte("valor", filtro.max);
  if (filtro.cp !== undefined) qb = qb.eq("cp", filtro.cp);
  const { data } = await qb;

  type Linha = {
    id: string;
    data_pagamento: string;
    valor: number;
    cp: number | null;
    banco_id: string | null;
    pagamentos: { descricao: string; loja_id: string | null } | null;
  };

  return ((data ?? []) as unknown as Linha[])
    .filter((b) => !lojaId || b.pagamentos?.loja_id === lojaId)
    .map((b) => ({
      id: b.id,
      data: b.data_pagamento,
      descricao: b.pagamentos?.descricao || "(sem descrição)",
      valor: Number(b.valor),
      loja: b.pagamentos?.loja_id ? nomeLoja.get(b.pagamentos.loja_id) ?? null : null,
      forma: b.cp ? nomeForma.get(b.cp) ?? null : null,
      banco: b.banco_id ? nomeBanco.get(b.banco_id) ?? null : null,
      situacao: null,
    }));
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

export type SerieAnualGrupo = {
  chave: string;
  rotulo: string;
  regime: "competencia" | "caixa";
  ano: number;
  meses: number[]; // 12 posicoes, janeiro a dezembro
};

/**
 * Evolucao de 12 meses de um GRUPO de despesas (a mesma faixa de codigos que
 * aparece em "Despesas por grupo" na DRE e "Saidas por grupo" no DFC).
 * Mesma logica da serieAnualCodigo, so trocando "cd = codigo" por
 * "cd between de and ate".
 */
export async function serieAnualGrupo(
  empresaId: string,
  chave: string,
  ano: number,
  regime: "competencia" | "caixa",
  lojaId: string | null
): Promise<SerieAnualGrupo> {
  const supabase = await supabaseServer();
  const meses = Array(12).fill(0) as number[];
  const grupo = TODOS_GRUPOS.find((g) => g.chave === chave);
  if (!grupo) return { chave, rotulo: chave, regime, ano, meses };

  if (regime === "competencia") {
    let q = supabase
      .from("pagamentos")
      .select("comp_mes, valor, cd, loja_id")
      .eq("empresa_id", empresaId)
      .eq("comp_ano", ano)
      .gte("cd", grupo.de)
      .lte("cd", grupo.ate);
    if (lojaId) q = q.eq("loja_id", lojaId);
    const { data } = await q;
    for (const p of data ?? []) meses[p.comp_mes - 1] += Number(p.valor);
  } else {
    const { data } = await supabase
      .from("pagamento_baixas")
      .select("data_pagamento, valor, pagamentos!inner(cd, loja_id)")
      .eq("empresa_id", empresaId)
      .gte("pagamentos.cd", grupo.de)
      .lte("pagamentos.cd", grupo.ate)
      .gte("data_pagamento", `${ano}-01-01`)
      .lte("data_pagamento", `${ano}-12-31`);

    type Linha = { data_pagamento: string; valor: number; pagamentos: { loja_id: string | null } | null };
    for (const b of (data ?? []) as unknown as Linha[]) {
      if (lojaId && b.pagamentos?.loja_id !== lojaId) continue;
      meses[Number(b.data_pagamento.slice(5, 7)) - 1] += Number(b.valor);
    }
  }

  return { chave, rotulo: grupo.rotulo, regime, ano, meses };
}

export type SerieAnualTipo = {
  codigo: number;
  nome: string;
  fonte: "venda" | "recebimento";
  ano: number;
  meses: number[]; // 12 posicoes, janeiro a dezembro
};

/**
 * Evolucao de 12 meses de uma forma de entrada de dinheiro: tipo de venda
 * (faturamento, na DRE -- tabela caixa_diario) ou tipo de recebimento
 * (entradas de caixa, no DFC -- tabela receitas). As duas tem o mesmo
 * formato -- codigo, nome, data, valor -- so a tabela de origem muda.
 */
export async function serieAnualTipo(
  empresaId: string,
  fonte: "venda" | "recebimento",
  codigo: number,
  ano: number,
  lojaId: string | null
): Promise<SerieAnualTipo> {
  const supabase = await supabaseServer();
  const meses = Array(12).fill(0) as number[];

  const tabela = fonte === "venda" ? "caixa_diario" : "receitas";
  const colunaTipo = fonte === "venda" ? "tipo_venda" : "tipo_recebimento";
  const tabelaTipos = fonte === "venda" ? "tipos_venda" : "tipos_recebimento";

  const [{ data: tipo }, dadosRes] = await Promise.all([
    supabase.from(tabelaTipos).select("nome").eq("empresa_id", empresaId).eq("codigo", codigo).maybeSingle(),
    (() => {
      let q = supabase
        .from(tabela)
        .select(`data, valor, ${colunaTipo}, loja_id`)
        .eq("empresa_id", empresaId)
        .eq(colunaTipo, codigo)
        .gte("data", `${ano}-01-01`)
        .lte("data", `${ano}-12-31`);
      if (lojaId) q = q.eq("loja_id", lojaId);
      return q;
    })(),
  ]);

  type Linha = { data: string; valor: number };
  for (const r of (dadosRes.data ?? []) as unknown as Linha[]) {
    meses[Number(r.data.slice(5, 7)) - 1] += Number(r.valor);
  }

  return { codigo, nome: tipo?.nome ?? "", fonte, ano, meses };
}
