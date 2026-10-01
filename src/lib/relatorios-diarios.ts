import { supabaseServer } from "@/lib/supabase-server";
import { primeiroDia, ultimoDia } from "@/lib/contexto";
import { GRUPOS_DRE } from "@/lib/formato";

/*
 * Relatorios do Combo 1: graficos do Painel, Fluxo Diario e Faturamento Diario.
 *
 * Fica num arquivo separado do relatorios.ts de proposito (dois outros combos
 * mexem em relatorios em paralelo). As regras de regime sao as mesmas de la:
 *   - CAIXA (DFC):        entradas = receitas.data, saidas = pagamento_baixas.data_pagamento
 *   - COMPETENCIA (DRE):  pagamentos.comp_mes/comp_ano, faturamento = caixa_diario
 *
 * Diferenca importante em relacao ao relatorios.ts: aqui toda consulta que pode
 * passar de 1.000 linhas e PAGINADA. O PostgREST do Supabase corta em 1.000 por
 * padrao, sem erro -- num grafico de 12 meses isso viraria um numero errado e
 * silencioso.
 */

const PAGINA = 1000;

/**
 * Busca todas as paginas de uma consulta. Recebe uma funcao que monta a
 * consulta do zero a cada pagina (o builder do supabase-js nao e reutilizavel
 * depois de executado). A consulta precisa ter um .order() estavel, senao a
 * paginacao pode pular ou repetir linha.
 */
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

export type MesRef = { ano: number; mes: number };

/** Os 12 meses que terminam no mes informado (inclusive), do mais antigo ao mais novo. */
export function janela12Meses(ano: number, mes: number): MesRef[] {
  const meses: MesRef[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    meses.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
  }
  return meses;
}

const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

/** 0 = domingo ... 6 = sabado. Usa UTC para nao depender do fuso do servidor. */
export function diaDaSemana(ano: number, mes: number, dia: number) {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function diasNoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/* ------------------------------------------------------------------ */
/* Leituras de base (paginadas, com filtro de loja)                    */
/* ------------------------------------------------------------------ */

type Receita = { data: string; valor: number; tipo_recebimento: number };
type Baixa = { data_pagamento: string; valor: number; pagamentos: { cfc: number; loja_id: string | null } | null };
type Venda = { data: string; valor: number; tipo_venda: number };

/** Receitas (entradas de caixa) num intervalo. Com loja escolhida, so as daquela loja. */
async function lerReceitas(empresaId: string, ini: string, fim: string, lojaId: string | null) {
  const supabase = await supabaseServer();
  return buscarTudo<Receita>(() => {
    let q = supabase
      .from("receitas")
      .select("id, data, valor, tipo_recebimento")
      .eq("empresa_id", empresaId)
      .gte("data", ini)
      .lte("data", fim)
      .order("id");
    if (lojaId) q = q.eq("loja_id", lojaId);
    return q;
  });
}

/**
 * Baixas (saidas de caixa) num intervalo. A loja esta no pagamento, nao na
 * baixa -- por isso o filtro e feito depois do join, igual ao dadosDFC.
 */
async function lerBaixas(empresaId: string, ini: string, fim: string, lojaId: string | null) {
  const supabase = await supabaseServer();
  const linhas = await buscarTudo<Baixa>(() =>
    supabase
      .from("pagamento_baixas")
      .select("id, data_pagamento, valor, pagamentos!inner(cfc, loja_id)")
      .eq("empresa_id", empresaId)
      .gte("data_pagamento", ini)
      .lte("data_pagamento", fim)
      .order("id")
  );
  return linhas.filter((b) => b.pagamentos && (!lojaId || b.pagamentos.loja_id === lojaId));
}

/** Vendas do Caixa Diario (faturamento) num intervalo. */
async function lerVendas(empresaId: string, ini: string, fim: string, lojaId: string | null) {
  const supabase = await supabaseServer();
  return buscarTudo<Venda>(() => {
    let q = supabase
      .from("caixa_diario")
      .select("id, data, valor, tipo_venda")
      .eq("empresa_id", empresaId)
      .gte("data", ini)
      .lte("data", fim)
      .order("id");
    if (lojaId) q = q.eq("loja_id", lojaId);
    return q;
  });
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export type ResumoMes = {
  faturamento: number;
  entradas: number;
  saidas: number;
  emAbertoNoMes: number;
  atrasadoAntes: number;
};

/**
 * Os mesmos 6 numeros que o Painel ja mostrava, agora respeitando a loja
 * escolhida (antes o Painel ignorava o filtro de loja).
 */
export async function resumoMes(empresaId: string, ano: number, mes: number, lojaId: string | null): Promise<ResumoMes> {
  const supabase = await supabaseServer();
  const ini = primeiroDia(ano, mes);
  const fim = ultimoDia(ano, mes);

  const [vendas, receitas, baixas, abertoMes, atrasado] = await Promise.all([
    lerVendas(empresaId, ini, fim, lojaId),
    lerReceitas(empresaId, ini, fim, lojaId),
    lerBaixas(empresaId, ini, fim, lojaId),
    buscarTudo<{ saldo: number }>(() => {
      let q = supabase
        .from("pagamentos_saldo")
        .select("id, saldo")
        .eq("empresa_id", empresaId)
        .eq("comp_ano", ano)
        .eq("comp_mes", mes)
        .order("id");
      if (lojaId) q = q.eq("loja_id", lojaId);
      return q;
    }),
    // Contas vencidas antes do mes e ainda nao quitadas.
    buscarTudo<{ saldo: number }>(() => {
      let q = supabase
        .from("pagamentos_saldo")
        .select("id, saldo")
        .eq("empresa_id", empresaId)
        .eq("pago", false)
        .lt("vencimento", ini)
        .order("id");
      if (lojaId) q = q.eq("loja_id", lojaId);
      return q;
    }),
  ]);

  const soma = (xs: { valor: number }[]) => xs.reduce((s, x) => s + Number(x.valor), 0);
  const somaSaldo = (xs: { saldo: number }[]) => xs.reduce((s, x) => s + Number(x.saldo), 0);

  return {
    faturamento: soma(vendas),
    entradas: soma(receitas),
    saidas: soma(baixas),
    emAbertoNoMes: somaSaldo(abertoMes),
    atrasadoAntes: somaSaldo(atrasado),
  };
}

export type PontoCaixa = MesRef & { entradas: number; saidas: number };

/** Entradas x saidas de caixa nos 12 meses que terminam no mes escolhido (mesma base do DFC). */
export async function serieCaixa12Meses(
  empresaId: string,
  ano: number,
  mes: number,
  lojaId: string | null
): Promise<PontoCaixa[]> {
  const janela = janela12Meses(ano, mes);
  const ini = primeiroDia(janela[0].ano, janela[0].mes);
  const fim = ultimoDia(ano, mes);

  const [receitas, baixas] = await Promise.all([
    lerReceitas(empresaId, ini, fim, lojaId),
    lerBaixas(empresaId, ini, fim, lojaId),
  ]);

  const pontos = new Map(janela.map((m) => [chaveMes(m.ano, m.mes), { ...m, entradas: 0, saidas: 0 }]));
  for (const r of receitas) {
    const p = pontos.get(r.data.slice(0, 7));
    if (p) p.entradas += Number(r.valor);
  }
  for (const b of baixas) {
    const p = pontos.get(b.data_pagamento.slice(0, 7));
    if (p) p.saidas += Number(b.valor);
  }
  return [...pontos.values()];
}

export type PontoResultado = MesRef & {
  faturamento: number;
  despesas: number;
  margem: number | null; // null = mes sem margem bruta informada em Parametros do mes
  resultado: number | null; // null quando nao da para calcular (sem margem)
};

/**
 * Resultado mensal por COMPETENCIA, com a mesma conta da DRE:
 *   resultado = faturamento x margem - despesas dos grupos DRE (codigos 1 a 90)
 *
 * Mes sem margem informada devolve resultado = null. Calcular com margem 0
 * daria um "prejuizo" igual a toda a despesa do mes, o que e falso -- o
 * grafico mostra esse mes como "sem margem" em vez de uma barra enganosa.
 */
export async function serieResultado12Meses(
  empresaId: string,
  ano: number,
  mes: number,
  lojaId: string | null
): Promise<PontoResultado[]> {
  const supabase = await supabaseServer();
  const janela = janela12Meses(ano, mes);
  const anoIni = janela[0].ano;
  const ini = primeiroDia(janela[0].ano, janela[0].mes);
  const fim = ultimoDia(ano, mes);
  const cdMin = GRUPOS_DRE[0].de;
  const cdMax = GRUPOS_DRE[GRUPOS_DRE.length - 1].ate;

  const [pagamentos, vendas, paramRes] = await Promise.all([
    buscarTudo<{ comp_ano: number; comp_mes: number; valor: number }>(() => {
      let q = supabase
        .from("pagamentos")
        .select("id, comp_ano, comp_mes, valor")
        .eq("empresa_id", empresaId)
        .gte("comp_ano", anoIni)
        .lte("comp_ano", ano)
        .gte("cd", cdMin)
        .lte("cd", cdMax)
        .order("id");
      if (lojaId) q = q.eq("loja_id", lojaId);
      return q;
    }),
    lerVendas(empresaId, ini, fim, lojaId),
    supabase
      .from("parametros_mes")
      .select("ano, mes, margem_bruta_pct")
      .eq("empresa_id", empresaId)
      .gte("ano", anoIni)
      .lte("ano", ano),
  ]);

  const pontos = new Map(
    janela.map((m) => [chaveMes(m.ano, m.mes), { ...m, faturamento: 0, despesas: 0, margem: null as number | null }])
  );
  for (const p of pagamentos) {
    const alvo = pontos.get(chaveMes(p.comp_ano, p.comp_mes));
    if (alvo) alvo.despesas += Number(p.valor);
  }
  for (const v of vendas) {
    const alvo = pontos.get(v.data.slice(0, 7));
    if (alvo) alvo.faturamento += Number(v.valor);
  }
  for (const pm of paramRes.data ?? []) {
    const alvo = pontos.get(chaveMes(pm.ano, pm.mes));
    if (alvo && pm.margem_bruta_pct !== null) alvo.margem = Number(pm.margem_bruta_pct);
  }

  return [...pontos.values()].map((p) => ({
    ...p,
    resultado: p.margem === null ? null : p.faturamento * p.margem - p.despesas,
  }));
}

export type FaixaAPagar = { rotulo: string; valor: number; quantidade: number; atrasado: boolean };

/**
 * Contas a pagar em aberto, medidas a partir de HOJE (nao do mes selecionado):
 * e um alerta operacional -- "o que esta vencido e o que vence logo".
 * Usa o saldo (valor - baixas), entao pagamento parcial conta so o que falta.
 */
export async function contasAPagar(empresaId: string, lojaId: string | null, hoje: string): Promise<FaixaAPagar[]> {
  const supabase = await supabaseServer();
  const soma = (dias: number) => {
    const d = new Date(`${hoje}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  const ate30 = soma(30);

  const contas = await buscarTudo<{ vencimento: string; saldo: number }>(() => {
    let q = supabase
      .from("pagamentos_saldo")
      .select("id, vencimento, saldo")
      .eq("empresa_id", empresaId)
      .eq("pago", false)
      .lte("vencimento", ate30)
      .order("id");
    if (lojaId) q = q.eq("loja_id", lojaId);
    return q;
  });

  const faixas: (FaixaAPagar & { de: string; ate: string })[] = [
    { rotulo: "Atrasado", de: "0000-01-01", ate: soma(-1), valor: 0, quantidade: 0, atrasado: true },
    { rotulo: "Hoje a 7 dias", de: hoje, ate: soma(7), valor: 0, quantidade: 0, atrasado: false },
    { rotulo: "8 a 15 dias", de: soma(8), ate: soma(15), valor: 0, quantidade: 0, atrasado: false },
    { rotulo: "16 a 30 dias", de: soma(16), ate: ate30, valor: 0, quantidade: 0, atrasado: false },
  ];
  for (const c of contas) {
    const f = faixas.find((x) => c.vencimento >= x.de && c.vencimento <= x.ate);
    if (f) {
      f.valor += Number(c.saldo);
      f.quantidade += 1;
    }
  }
  return faixas.map(({ rotulo, valor, quantidade, atrasado }) => ({ rotulo, valor, quantidade, atrasado }));
}

/* ------------------------------------------------------------------ */
/* Fluxo Diario                                                        */
/* ------------------------------------------------------------------ */

export type LinhaFluxoDiario = {
  dia: number;
  diaSemana: number;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoDia: number; // entradas - saidas do dia
  acumulado: number; // saldo ao fim do dia
};

export type FluxoDiario = {
  linhas: LinhaFluxoDiario[];
  saldoInicialMes: number;
  /** De onde veio o saldo inicial do mes -- a tela explica isso ao usuario. */
  origemSaldoInicial: "parametros" | "sem-saldo" | "loja";
  entradas: number;
  saidas: number;
  saldoFinal: number;
  porCFC: { cfc: number; total: number }[];
};

/**
 * Soma o jsonb parametros_mes.saldo_inicial ({banco_id: valor}).
 * A coluna existe desde a migration 0001, mas hoje nenhuma tela grava nela --
 * entao na pratica volta null e a tela avisa que o saldo inicial e zero.
 */
function somarSaldoInicial(json: unknown): number | null {
  if (!json || typeof json !== "object") return null;
  const valores = Object.values(json as Record<string, unknown>)
    .map((v) => Number(v))
    .filter((v) => !Number.isNaN(v));
  return valores.length ? valores.reduce((s, v) => s + v, 0) : null;
}

/**
 * Fluxo de caixa dia a dia, regime de caixa (mesma base do DFC).
 * Saldo inicial do mes: soma de parametros_mes.saldo_inicial, quando houver.
 * Com uma loja escolhida o saldo inicial NAO e usado, porque ele e por banco
 * (da empresa inteira) e nao por loja -- o fluxo comeca do zero e a tela avisa.
 */
export async function dadosFluxoDiario(
  empresaId: string,
  ano: number,
  mes: number,
  lojaId: string | null
): Promise<FluxoDiario> {
  const supabase = await supabaseServer();
  const ini = primeiroDia(ano, mes);
  const fim = ultimoDia(ano, mes);

  const [receitas, baixas, paramRes] = await Promise.all([
    lerReceitas(empresaId, ini, fim, lojaId),
    lerBaixas(empresaId, ini, fim, lojaId),
    supabase
      .from("parametros_mes")
      .select("saldo_inicial")
      .eq("empresa_id", empresaId)
      .eq("ano", ano)
      .eq("mes", mes)
      .maybeSingle(),
  ]);

  const informado = somarSaldoInicial(paramRes.data?.saldo_inicial);
  const origemSaldoInicial: FluxoDiario["origemSaldoInicial"] = lojaId
    ? "loja"
    : informado === null
      ? "sem-saldo"
      : "parametros";
  const saldoInicialMes = origemSaldoInicial === "parametros" ? (informado as number) : 0;

  const n = diasNoMes(ano, mes);
  const entradasDia = Array(n + 1).fill(0) as number[];
  const saidasDia = Array(n + 1).fill(0) as number[];
  for (const r of receitas) entradasDia[Number(r.data.slice(8, 10))] += Number(r.valor);
  for (const b of baixas) saidasDia[Number(b.data_pagamento.slice(8, 10))] += Number(b.valor);

  const linhas: LinhaFluxoDiario[] = [];
  let saldo = saldoInicialMes;
  for (let dia = 1; dia <= n; dia++) {
    const saldoDia = entradasDia[dia] - saidasDia[dia];
    linhas.push({
      dia,
      diaSemana: diaDaSemana(ano, mes, dia),
      saldoInicial: saldo,
      entradas: entradasDia[dia],
      saidas: saidasDia[dia],
      saldoDia,
      acumulado: saldo + saldoDia,
    });
    saldo += saldoDia;
  }

  const entradas = entradasDia.reduce((s, v) => s + v, 0);
  const saidas = saidasDia.reduce((s, v) => s + v, 0);
  const porCFC = [1, 2, 3, 4].map((cfc) => ({
    cfc,
    total: baixas.filter((b) => b.pagamentos?.cfc === cfc).reduce((s, b) => s + Number(b.valor), 0),
  }));

  return { linhas, saldoInicialMes, origemSaldoInicial, entradas, saidas, saldoFinal: saldo, porCFC };
}

/* ------------------------------------------------------------------ */
/* Faturamento Diario                                                  */
/* ------------------------------------------------------------------ */

export type LinhaFaturamentoDiario = {
  dia: number;
  diaSemana: number;
  porTipo: Record<number, number>;
  total: number;
  acumulado: number;
  totalMesAnterior: number | null; // null quando o mes anterior nao tem esse dia (ex.: 31)
  acumuladoMesAnterior: number | null;
};

export type FaturamentoDiario = {
  tipos: { codigo: number; nome: string; total: number }[];
  linhas: LinhaFaturamentoDiario[];
  total: number;
  diasComVenda: number;
  mediaDiaria: number; // total / dias com venda
  mediaPorDiaSemana: { diaSemana: number; media: number; dias: number }[]; // domingo..sabado
  /** Comparacao com o mes anterior no MESMO intervalo de dias (1 ate `ateDia`). */
  comparacao: { ateDia: number; atual: number; anterior: number; mesAnterior: MesRef };
};

/**
 * Faturamento (vendas do Caixa Diario) dia a dia, por tipo de venda.
 *
 * Comparacao com o mes anterior: soma do dia 1 ate o ultimo dia com venda
 * lancada no mes atual (ou o mes inteiro, se ja tem venda no ultimo dia),
 * contra o mesmo intervalo do mes anterior. Assim um mes pela metade nao e
 * comparado com um mes inteiro.
 */
export async function dadosFaturamentoDiario(
  empresaId: string,
  ano: number,
  mes: number,
  lojaId: string | null
): Promise<FaturamentoDiario> {
  const supabase = await supabaseServer();
  const ant = janela12Meses(ano, mes)[10]; // mes imediatamente anterior

  const [vendas, vendasAnt, tiposRes] = await Promise.all([
    lerVendas(empresaId, primeiroDia(ano, mes), ultimoDia(ano, mes), lojaId),
    lerVendas(empresaId, primeiroDia(ant.ano, ant.mes), ultimoDia(ant.ano, ant.mes), lojaId),
    supabase.from("tipos_venda").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
  ]);

  const n = diasNoMes(ano, mes);
  const nAnt = diasNoMes(ant.ano, ant.mes);
  const porDia: Record<number, number>[] = Array.from({ length: n + 1 }, () => ({}));
  const totalDia = Array(n + 1).fill(0) as number[];
  const totalDiaAnt = Array(nAnt + 1).fill(0) as number[];
  const totalTipo = new Map<number, number>();

  for (const v of vendas) {
    const d = Number(v.data.slice(8, 10));
    const valor = Number(v.valor);
    porDia[d][v.tipo_venda] = (porDia[d][v.tipo_venda] ?? 0) + valor;
    totalDia[d] += valor;
    totalTipo.set(v.tipo_venda, (totalTipo.get(v.tipo_venda) ?? 0) + valor);
  }
  for (const v of vendasAnt) totalDiaAnt[Number(v.data.slice(8, 10))] += Number(v.valor);

  // Tipos com nome cadastrado, mais qualquer codigo que tenha venda sem nome
  // (para a soma das colunas sempre bater com o total).
  const nomes = new Map((tiposRes.data ?? []).map((t) => [t.codigo, t.nome]));
  const codigos = new Set<number>([
    ...(tiposRes.data ?? []).filter((t) => t.nome !== "").map((t) => t.codigo),
    ...totalTipo.keys(),
  ]);
  const tipos = [...codigos]
    .sort((a, b) => a - b)
    .map((codigo) => ({ codigo, nome: nomes.get(codigo) || `Tipo ${codigo}`, total: totalTipo.get(codigo) ?? 0 }));

  const linhas: LinhaFaturamentoDiario[] = [];
  let acc = 0;
  let accAnt = 0;
  for (let dia = 1; dia <= n; dia++) {
    acc += totalDia[dia];
    const temAnt = dia <= nAnt;
    if (temAnt) accAnt += totalDiaAnt[dia];
    linhas.push({
      dia,
      diaSemana: diaDaSemana(ano, mes, dia),
      porTipo: porDia[dia],
      total: totalDia[dia],
      acumulado: acc,
      totalMesAnterior: temAnt ? totalDiaAnt[dia] : null,
      acumuladoMesAnterior: temAnt ? accAnt : null,
    });
  }

  const total = acc;
  const diasComVenda = totalDia.filter((v, i) => i > 0 && v !== 0).length;

  const somaSemana = Array(7).fill(0) as number[];
  const qtdSemana = Array(7).fill(0) as number[];
  for (const l of linhas) {
    if (l.total === 0) continue;
    somaSemana[l.diaSemana] += l.total;
    qtdSemana[l.diaSemana] += 1;
  }

  let ultimoComVenda = 0;
  for (let dia = n; dia >= 1; dia--) {
    if (totalDia[dia] !== 0) {
      ultimoComVenda = dia;
      break;
    }
  }
  const ateDia = ultimoComVenda || n;
  const anteriorAte = totalDiaAnt.slice(1, Math.min(ateDia, nAnt) + 1).reduce((s, v) => s + v, 0);
  const atualAte = totalDia.slice(1, ateDia + 1).reduce((s, v) => s + v, 0);

  return {
    tipos,
    linhas,
    total,
    diasComVenda,
    mediaDiaria: diasComVenda ? total / diasComVenda : 0,
    mediaPorDiaSemana: somaSemana.map((s, i) => ({ diaSemana: i, media: qtdSemana[i] ? s / qtdSemana[i] : 0, dias: qtdSemana[i] })),
    comparacao: { ateDia, atual: atualAte, anterior: anteriorAte, mesAnterior: ant },
  };
}
