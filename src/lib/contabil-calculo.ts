/*
 * Calculos do Combo 2: DRE Contabil, Fluxo Contabil, Evolucao DRE e Evolucao DFC.
 *
 * Este arquivo e PURO: nao fala com o banco. Recebe as linhas ja lidas
 * (relatorios-contabeis.ts busca) e devolve os numeros. Assim da para testar
 * sem Supabase e garantir que cada mes da Evolucao bate com a DRE Gerencial /
 * DFC daquele mes (supabase/testes/relatorios.test.mjs).
 *
 * As regras de cada mes COPIAM as de relatorios.ts (dadosDRE e dadosDFC), que
 * nao pode ser editado por este combo:
 *   - DRE (competencia): pagamentos por comp_mes/comp_ano, pagos ou nao;
 *     faturamento = caixa_diario; so entram codigos cadastrados; grupos 1-90.
 *   - DFC (caixa): baixas por data_pagamento (filtro de loja pela conta);
 *     entradas = receitas, SEM filtro de loja (igual ao DFC atual).
 */
import { GRUPOS_DRE, GRUPOS_DFC_EXTRA } from "@/lib/formato";

/* ------------------------------------------------------------------ */
/* Linhas de entrada (o formato que relatorios-contabeis.ts entrega)   */
/* ------------------------------------------------------------------ */

export type Codigo = { codigo: number; nome: string };
export type PagamentoComp = { cd: number; valor: number; comp_mes: number };
export type Venda = { data: string; tipo_venda: number; valor: number };
export type BaixaCaixa = { data_pagamento: string; valor: number; cd: number; cfc: number };
export type Receita = { data: string; tipo_recebimento: number; valor: number };
export type ParametroMes = { mes: number; margem_bruta_pct: number | null; saldo_inicial: Record<string, number> | null };

/** Tudo o que um ano (ou um mes) precisa. Os filtros de empresa/loja/periodo ja vieram aplicados. */
export type BaseAno = {
  ano: number;
  codigos: Codigo[];
  tiposVenda: Codigo[];
  tiposRecebimento: Codigo[];
  pagamentos: PagamentoComp[];
  vendas: Venda[];
  baixas: BaixaCaixa[];
  receitas: Receita[];
  parametros: ParametroMes[];
};

const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const mesDe = (data: string) => Number(data.slice(5, 7));

/* ------------------------------------------------------------------ */
/* Mes a mes -- mesma conta de dadosDRE / dadosDFC                      */
/* ------------------------------------------------------------------ */

export type LinhaValor = { codigo: number; nome: string; valor: number };
export type GrupoValor = { chave: string; rotulo: string; de: number; ate: number; total: number };

export type DREMes = {
  porCodigo: LinhaValor[];
  grupos: GrupoValor[];
  porTipoVenda: LinhaValor[];
  faturamento: number;
  despesas: number;
  margem: number;
  lucroBruto: number;
  cmv: number;
  resultado: number;
};

export function calcularDREMes(b: BaseAno, mes: number): DREMes {
  const pagamentos = b.pagamentos.filter((p) => p.comp_mes === mes);
  const porCodigo = b.codigos.map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    valor: soma(pagamentos.filter((p) => p.cd === c.codigo).map((p) => Number(p.valor))),
  }));
  const grupos = GRUPOS_DRE.map((g) => ({
    ...g,
    total: soma(porCodigo.filter((c) => c.codigo >= g.de && c.codigo <= g.ate).map((c) => c.valor)),
  }));
  const vendas = b.vendas.filter((v) => mesDe(v.data) === mes);
  const porTipoVenda = b.tiposVenda
    .filter((t) => t.nome !== "")
    .map((t) => ({
      codigo: t.codigo,
      nome: t.nome,
      valor: soma(vendas.filter((v) => v.tipo_venda === t.codigo).map((v) => Number(v.valor))),
    }));
  const faturamento = soma(vendas.map((v) => Number(v.valor)));
  const despesas = soma(grupos.map((g) => g.total));
  const margem = Number(b.parametros.find((p) => p.mes === mes)?.margem_bruta_pct ?? 0);
  const lucroBruto = faturamento * margem;
  const cmv = faturamento - lucroBruto;
  return { porCodigo, grupos, porTipoVenda, faturamento, despesas, margem, lucroBruto, cmv, resultado: lucroBruto - despesas };
}

export type DFCMes = {
  porCodigo: LinhaValor[];
  grupos: GrupoValor[];
  porTipoRecebimento: LinhaValor[];
  porCFC: { cfc: number; total: number }[];
  entradas: number;
  saidas: number;
  resultado: number;
};

export function calcularDFCMes(b: BaseAno, mes: number): DFCMes {
  const baixas = b.baixas.filter((x) => mesDe(x.data_pagamento) === mes);
  const porCodigo = b.codigos.map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    valor: soma(baixas.filter((p) => p.cd === c.codigo).map((p) => Number(p.valor))),
  }));
  const grupos = [...GRUPOS_DRE, ...GRUPOS_DFC_EXTRA].map((g) => ({
    ...g,
    total: soma(porCodigo.filter((c) => c.codigo >= g.de && c.codigo <= g.ate).map((c) => c.valor)),
  }));
  const receitas = b.receitas.filter((r) => mesDe(r.data) === mes);
  const porTipoRecebimento = b.tiposRecebimento
    .filter((t) => t.nome !== "")
    .map((t) => ({
      codigo: t.codigo,
      nome: t.nome,
      valor: soma(receitas.filter((r) => r.tipo_recebimento === t.codigo).map((r) => Number(r.valor))),
    }));
  const porCFC = [1, 2, 3, 4].map((c) => ({
    cfc: c,
    total: soma(baixas.filter((p) => p.cfc === c).map((p) => Number(p.valor))),
  }));
  const entradas = soma(receitas.map((r) => Number(r.valor)));
  const saidas = soma(baixas.map((p) => Number(p.valor)));
  return { porCodigo, grupos, porTipoRecebimento, porCFC, entradas, saidas, resultado: entradas - saidas };
}

/* ------------------------------------------------------------------ */
/* DRE Contabil                                                         */
/* ------------------------------------------------------------------ */

/**
 * Mapeamento dos codigos de despesa para as linhas contabeis.
 * PADRAO DE MERCADO (decisao do Neto, 01/10/2026). Fica tudo aqui para ser
 * facil de mudar se o Marcelo pedir outro arranjo.
 *
 * As faixas cobrem os codigos 1-90 sem sobra e sem repeticao (o teste confere),
 * por isso o Resultado Liquido da DRE Contabil e sempre igual ao Resultado da
 * DRE Gerencial -- so muda a arrumacao das linhas.
 */
export const MAPA_DRE_CONTABIL = {
  impostosSobreVendas: [61, 62, 63, 64, 70], // PIS, COFINS, ISS, ICMS, Simples Nacional
  descontos: [79], // descontos concedidos
  devolucoes: [59],
  custosVariaveis: faixa(81, 90),
  irCsll: [65, 66],
  despesas: [
    { chave: "PRO_LABORE", rotulo: "Pró-labore", codigos: faixa(1, 5) },
    { chave: "RH_PESSOAL", rotulo: "RH - Pessoal", codigos: faixa(6, 25) },
    { chave: "FIXAS", rotulo: "Fixas / Operacionais", codigos: faixa(26, 60).filter((c) => c !== 59) },
    { chave: "IMPOSTOS", rotulo: "Outros impostos e taxas (DARE, DARF, mobiliários)", codigos: [67, 68, 69] },
    { chave: "FINANCEIRAS", rotulo: "Financeiras", codigos: faixa(71, 80).filter((c) => c !== 79) },
  ],
};

function faixa(de: number, ate: number) {
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}

/** Lucro desejavel padrao (% do faturamento) quando o usuario nao informa. Editavel na tela. */
export const LUCRO_DESEJAVEL_PADRAO = 0.1;

export type PontoEquilibrio = {
  /** Margem de contribuicao em % da receita (0..1). */
  mcPct: number;
  /** Ponto de equilibrio financeiro: receita que paga os custos fixos. null = nao atingivel. */
  pef: number | null;
  /** Ponto de equilibrio economico: receita que paga os fixos E entrega o lucro desejavel. */
  pee: number | null;
  lucroDesejavelPct: number;
};

/**
 * Formulas classicas:
 *   PEF = fixos / MC%
 *   PEE = fixos / (MC% - lucro desejavel %)
 * Sem margem de contribuicao positiva (ou se o lucro desejavel come toda a
 * margem) nao existe receita que feche a conta -- devolve null.
 */
export function pontoEquilibrio(receita: number, mc: number, fixos: number, lucroDesejavelPct: number): PontoEquilibrio {
  const mcPct = receita > 0 ? mc / receita : 0;
  const pef = mcPct > 0 ? fixos / mcPct : null;
  const pee = mcPct - lucroDesejavelPct > 0 ? fixos / (mcPct - lucroDesejavelPct) : null;
  return { mcPct, pef, pee, lucroDesejavelPct };
}

export type DREContabil = {
  receitaBruta: number;
  impostosSobreVendas: number;
  descontos: number;
  devolucoes: number;
  receitaLiquida: number;
  cmv: number;
  custosVariaveis: number;
  margemContribuicao: number;
  despesas: { chave: string; rotulo: string; total: number }[];
  totalDespesas: number;
  resultadoOperacional: number;
  irCsll: number;
  resultadoLiquido: number;
  margem: number; // margem bruta informada em Parametros (0 = nao informada)
  equilibrio: PontoEquilibrio;
};

export function calcularDREContabil(d: DREMes, lucroDesejavelPct: number): DREContabil {
  const valor = (codigos: number[]) =>
    soma(d.porCodigo.filter((c) => codigos.includes(c.codigo)).map((c) => c.valor));
  const m = MAPA_DRE_CONTABIL;
  const receitaBruta = d.faturamento;
  const impostosSobreVendas = valor(m.impostosSobreVendas);
  const descontos = valor(m.descontos);
  const devolucoes = valor(m.devolucoes);
  const receitaLiquida = receitaBruta - impostosSobreVendas - descontos - devolucoes;
  const custosVariaveis = valor(m.custosVariaveis);
  const margemContribuicao = receitaLiquida - d.cmv - custosVariaveis;
  const despesas = m.despesas.map((g) => ({ chave: g.chave, rotulo: g.rotulo, total: valor(g.codigos) }));
  const totalDespesas = soma(despesas.map((g) => g.total));
  const resultadoOperacional = margemContribuicao - totalDespesas;
  const irCsll = valor(m.irCsll);
  return {
    receitaBruta,
    impostosSobreVendas,
    descontos,
    devolucoes,
    receitaLiquida,
    cmv: d.cmv,
    custosVariaveis,
    margemContribuicao,
    despesas,
    totalDespesas,
    resultadoOperacional,
    irCsll,
    resultadoLiquido: resultadoOperacional - irCsll,
    margem: d.margem,
    equilibrio: pontoEquilibrio(receitaBruta, margemContribuicao, totalDespesas, lucroDesejavelPct),
  };
}

/* ------------------------------------------------------------------ */
/* Fluxo Contabil                                                       */
/* ------------------------------------------------------------------ */

/**
 * Tipos de recebimento operacionais (vem da venda): dinheiro, cartoes, boletos,
 * cheques, PIX e antecipacoes. 9-12 (receitas financeiras, socios, emprestimos,
 * outras) sao nao operacionais. PADRAO DE MERCADO.
 */
export const RECEBIMENTOS_OPERACIONAIS = faixa(1, 8);

export type FluxoContabil = {
  saldoInicial: number;
  receitasOperacionais: number;
  custoVariavel: number; // CFC 2
  margemContribuicao: number;
  despesasFixas: number; // CFC 1
  loai: number;
  investimentos: number; // CFC 4
  lucroOperacional: number;
  entradasNaoOperacionais: number; // tipos 9-12
  saidasNaoOperacionais: number; // CFC 3
  resultadoLiquido: number;
  saldoFinal: number;
  equilibrio: PontoEquilibrio;
};

/**
 * Classificacao das saidas pelo CFC (PERSONALIZAVEL: e o consultor que escolhe
 * o CFC de cada pagamento). O Resultado Liquido e sempre Entradas - Saidas do DFC.
 */
export function calcularFluxoContabil(d: DFCMes, receitas: Receita[], mes: number, saldoInicial: number, lucroDesejavelPct: number): FluxoContabil {
  const doMes = receitas.filter((r) => mesDe(r.data) === mes);
  const receitasOperacionais = soma(
    doMes.filter((r) => RECEBIMENTOS_OPERACIONAIS.includes(r.tipo_recebimento)).map((r) => Number(r.valor))
  );
  const entradasNaoOperacionais = d.entradas - receitasOperacionais;
  const cfc = (n: number) => d.porCFC.find((c) => c.cfc === n)?.total ?? 0;
  const custoVariavel = cfc(2);
  const despesasFixas = cfc(1);
  const saidasNaoOperacionais = cfc(3);
  const investimentos = cfc(4);
  const margemContribuicao = receitasOperacionais - custoVariavel;
  const loai = margemContribuicao - despesasFixas;
  const lucroOperacional = loai - investimentos;
  const resultadoLiquido = lucroOperacional + entradasNaoOperacionais - saidasNaoOperacionais;
  return {
    saldoInicial,
    receitasOperacionais,
    custoVariavel,
    margemContribuicao,
    despesasFixas,
    loai,
    investimentos,
    lucroOperacional,
    entradasNaoOperacionais,
    saidasNaoOperacionais,
    resultadoLiquido,
    saldoFinal: saldoInicial + resultadoLiquido,
    equilibrio: pontoEquilibrio(receitasOperacionais, margemContribuicao, despesasFixas, lucroDesejavelPct),
  };
}

/** Soma do saldo inicial de todos os bancos (parametros_mes.saldo_inicial = {banco_id: valor}). */
export function saldoInicialDoMes(b: BaseAno, mes: number): number {
  const s = b.parametros.find((p) => p.mes === mes)?.saldo_inicial;
  if (!s) return 0;
  return soma(Object.values(s).map((v) => Number(v) || 0));
}

/* ------------------------------------------------------------------ */
/* Evolucao (12 meses)                                                  */
/* ------------------------------------------------------------------ */

export type LinhaEvolucao = {
  id: string;
  rotulo: string;
  meses: number[]; // 12 posicoes
  total: number;
  /** destino do clique (evolucao por codigo/grupo/tipo), sem querystring */
  link?: string;
  destaque?: boolean;
};

export type SecaoEvolucao = { titulo: string; linhas: LinhaEvolucao[]; codigos?: boolean };

export type Evolucao = {
  ano: number;
  secoes: SecaoEvolucao[];
  /** base do % de cada mes (faturamento na DRE, entradas no DFC) */
  base: number[];
  baseTotal: number;
  /** meses que tiveram algum movimento -- divisor da media */
  mesesComMovimento: number;
  /** so DRE: meses sem margem bruta informada */
  semMargem?: boolean[];
  grafico: { a: number[]; b: number[]; resultado: number[]; rotuloA: string; rotuloB: string };
};

const MESES12 = Array.from({ length: 12 }, (_, i) => i + 1);

function linha(id: string, rotulo: string, meses: number[], extra: Partial<LinhaEvolucao> = {}): LinhaEvolucao {
  return { id, rotulo, meses, total: soma(meses), ...extra };
}

export function evolucaoDRE(b: BaseAno): Evolucao {
  const ms = MESES12.map((m) => calcularDREMes(b, m));
  const tipos = ms[0].porTipoVenda;
  const grupos = ms[0].grupos;
  const codigos = ms[0].porCodigo;
  return {
    ano: b.ano,
    base: ms.map((d) => d.faturamento),
    baseTotal: soma(ms.map((d) => d.faturamento)),
    mesesComMovimento: ms.filter((d) => d.faturamento !== 0 || d.despesas !== 0).length,
    semMargem: ms.map((d) => d.margem === 0),
    secoes: [
      {
        titulo: "Faturamento por forma de venda",
        linhas: tipos.map((t, i) =>
          linha(`venda-${t.codigo}`, t.nome, ms.map((d) => d.porTipoVenda[i].valor), { link: `/evolucao-tipo/venda/${t.codigo}` })
        ),
      },
      {
        titulo: "Despesas por grupo",
        linhas: grupos.map((g, i) =>
          linha(`grupo-${g.chave}`, g.rotulo, ms.map((d) => d.grupos[i].total), { link: `/evolucao-grupo/${g.chave}` })
        ),
      },
      {
        titulo: "Resultado",
        linhas: [
          linha("faturamento", "Faturamento", ms.map((d) => d.faturamento), { destaque: true }),
          linha("cmv", "CMV / CPV", ms.map((d) => d.cmv)),
          linha("lucro-bruto", "Lucro bruto", ms.map((d) => d.lucroBruto)),
          linha("despesas", "Despesas", ms.map((d) => d.despesas)),
          linha("resultado", "Resultado", ms.map((d) => d.resultado), { destaque: true }),
        ],
      },
      {
        titulo: "Detalhamento por código",
        codigos: true,
        linhas: codigos.map((c, i) =>
          linha(`cd-${c.codigo}`, `${String(c.codigo).padStart(2, "0")} ${c.nome}`, ms.map((d) => d.porCodigo[i].valor), {
            link: `/evolucao/${c.codigo}`,
          })
        ),
      },
    ],
    grafico: {
      a: ms.map((d) => d.faturamento),
      b: ms.map((d) => d.despesas),
      resultado: ms.map((d) => d.resultado),
      rotuloA: "Faturamento",
      rotuloB: "Despesas",
    },
  };
}

const NOME_CFC: Record<number, string> = { 1: "Fixas", 2: "Variáveis", 3: "Não operacionais", 4: "Investimentos" };

export function evolucaoDFC(b: BaseAno): Evolucao {
  const ms = MESES12.map((m) => calcularDFCMes(b, m));
  const tipos = ms[0].porTipoRecebimento;
  const grupos = ms[0].grupos;
  const codigos = ms[0].porCodigo;
  return {
    ano: b.ano,
    base: ms.map((d) => d.entradas),
    baseTotal: soma(ms.map((d) => d.entradas)),
    mesesComMovimento: ms.filter((d) => d.entradas !== 0 || d.saidas !== 0).length,
    secoes: [
      {
        titulo: "Entradas por tipo de recebimento",
        linhas: tipos.map((t, i) =>
          linha(`rec-${t.codigo}`, t.nome, ms.map((d) => d.porTipoRecebimento[i].valor), {
            link: `/evolucao-tipo/recebimento/${t.codigo}`,
          })
        ),
      },
      {
        titulo: "Saídas por grupo",
        linhas: grupos.map((g, i) =>
          linha(`grupo-${g.chave}`, g.rotulo, ms.map((d) => d.grupos[i].total), { link: `/evolucao-grupo/${g.chave}` })
        ),
      },
      {
        titulo: "Saídas por CFC",
        linhas: [1, 2, 3, 4].map((c, i) => linha(`cfc-${c}`, NOME_CFC[c], ms.map((d) => d.porCFC[i].total))),
      },
      {
        titulo: "Resultado",
        linhas: [
          linha("entradas", "Entradas", ms.map((d) => d.entradas), { destaque: true }),
          linha("saidas", "Saídas", ms.map((d) => d.saidas)),
          linha("resultado", "Resultado do mês", ms.map((d) => d.resultado), { destaque: true }),
        ],
      },
      {
        titulo: "Detalhamento por código",
        codigos: true,
        linhas: codigos.map((c, i) =>
          linha(`cd-${c.codigo}`, `${String(c.codigo).padStart(2, "0")} ${c.nome}`, ms.map((d) => d.porCodigo[i].valor), {
            link: `/evolucao/${c.codigo}`,
          })
        ),
      },
    ],
    grafico: {
      a: ms.map((d) => d.entradas),
      b: ms.map((d) => d.saidas),
      resultado: ms.map((d) => d.resultado),
      rotuloA: "Entradas",
      rotuloB: "Saídas",
    },
  };
}
