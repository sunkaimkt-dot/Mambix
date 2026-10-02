/**
 * Simulador de cenarios (Combo 3) -- calculo PURO, sem banco.
 *
 * A base vem de dadosDRE / dadosDFC (relatorios.ts), os mesmos numeros da DRE
 * Gerencial e do DFC. Aqui so se tira a media de N meses e se aplicam as
 * alavancas da especificacao 5.10 (padrao de analise de sensibilidade):
 *
 *   preco (p)          -> mexe no faturamento
 *   quantidade (q)     -> mexe no faturamento E nos custos variaveis
 *   custo variavel (c) -> mexe no CMV e nas despesas variaveis
 *   despesa fixa (f)   -> mexe nas despesas fixas
 *
 * DRE (competencia):
 *   Faturamento'            = Faturamento x (1+p)(1+q)
 *   CMV'                    = CMV x (1+q)(1+c)        (custo unitario nao muda com o preco)
 *   Impostos s/ vendas'     = valor x (1+p)(1+q)      (61 PIS, 62 COFINS, 63 ISS, 64 ICMS,
 *                                                      70 Simples: incidem sobre a receita)
 *   Variaveis (81-90)'      = valor x (1+q)(1+c)
 *   Demais despesas (1-80)' = valor x (1+f)           (pro-labore, RH, fixas, IR/CSLL e
 *                                                      outros impostos, financeiras)
 *   Ajuste por grupo: se informado, SUBSTITUI a alavanca naquele grupo inteiro.
 *
 * DFC (caixa), pela classificacao CFC de cada saida:
 *   Entradas operacionais (tipos 1-8)' = valor x (1+p)(1+q)
 *   Entradas nao operacionais (9-12)   = sem mudanca
 *   CFC 2 variavel'                     = valor x (1+q)(1+c)
 *   CFC 1 fixa'                         = valor x (1+f)
 *   CFC 3 nao operacional e CFC 4 investimento = sem mudanca
 *
 * Com todas as alavancas em 0% todo fator e exatamente 1, entao a simulada
 * repete a base centavo por centavo (testado).
 */
import { GRUPOS_DRE } from "@/lib/formato";

export const IMPOSTOS_SOBRE_VENDAS = [61, 62, 63, 64, 70];
export const TIPOS_RECEBIMENTO_NAO_OPERACIONAIS = [9, 10, 11, 12];

type Linha = { codigo: number; nome: string; valor: number };

/** O que interessa de um dadosDRE() para o simulador. */
export type MesDRE = {
  ano: number;
  mes: number;
  faturamento: number;
  porTipoVenda: Linha[];
  porCodigo: Linha[];
  cmv: number;
  margem: number;
};

/** O que interessa de um dadosDFC(). */
export type MesDFC = {
  ano: number;
  mes: number;
  entradas: number;
  porTipoRecebimento: Linha[];
  porCFC: { cfc: number; total: number }[];
  saidas: number;
};

export type BaseDRE = {
  meses: { ano: number; mes: number }[];
  excluidos: { ano: number; mes: number; motivo: string }[];
  faturamento: number;
  porTipoVenda: Linha[];
  porCodigo: Linha[];
  cmv: number;
};

export type BaseDFC = {
  meses: { ano: number; mes: number }[];
  excluidos: { ano: number; mes: number; motivo: string }[];
  entradas: number;
  porTipoRecebimento: Linha[];
  porCFC: { cfc: number; total: number }[];
};

export type Alavancas = { preco: number; quantidade: number; custoVariavel: number; despesaFixa: number };
export const ALAVANCAS_ZERO: Alavancas = { preco: 0, quantidade: 0, custoVariavel: 0, despesaFixa: 0 };

/** Ajuste por grupo da DRE (chave de GRUPOS_DRE), em fracao: 0,05 = +5%. */
export type AjustesGrupo = Partial<Record<string, number>>;

function mediaLinhas(listas: Linha[][], n: number): Linha[] {
  const mapa = new Map<number, Linha>();
  for (const lista of listas) {
    for (const l of lista) {
      const atual = mapa.get(l.codigo) ?? { codigo: l.codigo, nome: l.nome, valor: 0 };
      atual.valor += l.valor;
      mapa.set(l.codigo, atual);
    }
  }
  return [...mapa.values()].sort((a, b) => a.codigo - b.codigo).map((l) => ({ ...l, valor: n > 1 ? l.valor / n : l.valor }));
}

const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/**
 * Base da DRE: 1 mes, ou media dos meses validos.
 * Fica fora da media (com aviso) o mes SEM MARGEM em Parametros -- nele o CMV
 * sai igual ao faturamento e o lucro bruto zera, o que puxaria a media para
 * baixo sem ser real -- e o mes sem movimento nenhum.
 */
export function montarBaseDRE(meses: MesDRE[]): BaseDRE {
  const excluidos: BaseDRE["excluidos"] = [];
  const validos = meses.filter((m) => {
    const despesas = soma(m.porCodigo.filter((c) => c.codigo <= 90).map((c) => c.valor));
    if (m.faturamento === 0 && despesas === 0) {
      excluidos.push({ ano: m.ano, mes: m.mes, motivo: "sem movimento" });
      return false;
    }
    if (m.margem === 0) {
      excluidos.push({ ano: m.ano, mes: m.mes, motivo: "sem margem bruta em Parâmetros" });
      return false;
    }
    return true;
  });
  const n = validos.length;
  const media = (f: (m: MesDRE) => number) => (n > 1 ? soma(validos.map(f)) / n : n === 1 ? f(validos[0]) : 0);
  return {
    meses: validos.map((m) => ({ ano: m.ano, mes: m.mes })),
    excluidos,
    faturamento: media((m) => m.faturamento),
    porTipoVenda: mediaLinhas(validos.map((m) => m.porTipoVenda), n),
    porCodigo: mediaLinhas(validos.map((m) => m.porCodigo), n),
    cmv: media((m) => m.cmv),
  };
}

/** Base do DFC: 1 mes, ou media dos meses com movimento. */
export function montarBaseDFC(meses: MesDFC[]): BaseDFC {
  const excluidos: BaseDFC["excluidos"] = [];
  const validos = meses.filter((m) => {
    if (m.entradas === 0 && m.saidas === 0) {
      excluidos.push({ ano: m.ano, mes: m.mes, motivo: "sem movimento" });
      return false;
    }
    return true;
  });
  const n = validos.length;
  const cfcs = [1, 2, 3, 4].map((cfc) => {
    const t = soma(validos.map((m) => m.porCFC.find((c) => c.cfc === cfc)?.total ?? 0));
    return { cfc, total: n > 1 ? t / n : t };
  });
  const e = soma(validos.map((m) => m.entradas));
  return {
    meses: validos.map((m) => ({ ano: m.ano, mes: m.mes })),
    excluidos,
    entradas: n > 1 ? e / n : e,
    porTipoRecebimento: mediaLinhas(validos.map((m) => m.porTipoRecebimento), n),
    porCFC: cfcs,
  };
}

// ============================================================
// DRE simulada
// ============================================================

export type LinhaResultado = { chave: string; rotulo: string; base: number; simulado: number; nivel: 0 | 1 | 2; sinal?: "+" | "-" };

export type ResultadoDRE = {
  linhas: LinhaResultado[];
  faturamento: { base: number; simulado: number };
  cmv: { base: number; simulado: number };
  lucroBruto: { base: number; simulado: number };
  despesas: { base: number; simulado: number };
  resultado: { base: number; simulado: number };
  margem: { base: number; simulado: number };
};

function fatores(a: Alavancas) {
  return {
    receita: (1 + a.preco) * (1 + a.quantidade),
    variavel: (1 + a.quantidade) * (1 + a.custoVariavel),
    fixa: 1 + a.despesaFixa,
  };
}

/** Fator de cada codigo de despesa da DRE (1-90). */
export function fatorCodigo(codigo: number, a: Alavancas, ajustes: AjustesGrupo = {}): number {
  const grupo = GRUPOS_DRE.find((g) => codigo >= g.de && codigo <= g.ate);
  const aj = grupo ? ajustes[grupo.chave] : undefined;
  if (aj !== undefined && aj !== null && Number.isFinite(aj)) return 1 + aj;
  const f = fatores(a);
  if (IMPOSTOS_SOBRE_VENDAS.includes(codigo)) return f.receita;
  if (codigo >= 81 && codigo <= 90) return f.variavel;
  return f.fixa;
}

export function simularDRE(base: BaseDRE, a: Alavancas, ajustes: AjustesGrupo = {}): ResultadoDRE {
  const f = fatores(a);
  const linhas: LinhaResultado[] = [];

  const fatB = base.faturamento;
  const fatS = fatB * f.receita;
  linhas.push({ chave: "faturamento", rotulo: "Faturamento", base: fatB, simulado: fatS, nivel: 0 });
  const tiposComValor = base.porTipoVenda.filter((t) => t.valor !== 0);
  for (const t of tiposComValor) {
    linhas.push({ chave: `venda-${t.codigo}`, rotulo: t.nome, base: t.valor, simulado: t.valor * f.receita, nivel: 2 });
  }
  // Venda lancada num tipo que depois ficou sem nome: conta no faturamento
  // (como na DRE Gerencial) mas nao aparece na lista de tipos.
  const resto = fatB - soma(tiposComValor.map((t) => t.valor));
  if (Math.abs(resto) >= 0.005) {
    linhas.push({ chave: "venda-outros", rotulo: "Outros tipos", base: resto, simulado: resto * f.receita, nivel: 2 });
  }

  const cmvB = base.cmv;
  const cmvS = cmvB * f.variavel;
  linhas.push({ chave: "cmv", rotulo: "CMV / CPV", base: cmvB, simulado: cmvS, nivel: 0, sinal: "-" });
  const lbB = fatB - cmvB;
  const lbS = fatS - cmvS;
  linhas.push({ chave: "lucro-bruto", rotulo: "Lucro bruto", base: lbB, simulado: lbS, nivel: 1 });

  let despB = 0;
  let despS = 0;
  for (const g of GRUPOS_DRE) {
    const codigos = base.porCodigo.filter((c) => c.codigo >= g.de && c.codigo <= g.ate);
    const gb = soma(codigos.map((c) => c.valor));
    const gs = soma(codigos.map((c) => c.valor * fatorCodigo(c.codigo, a, ajustes)));
    despB += gb;
    despS += gs;
    linhas.push({ chave: `grupo-${g.chave}`, rotulo: g.rotulo, base: gb, simulado: gs, nivel: 2, sinal: "-" });
  }
  // Total de despesas antes dos grupos, como na DRE.
  const idx = linhas.findIndex((l) => l.chave.startsWith("grupo-"));
  linhas.splice(idx, 0, { chave: "despesas", rotulo: "Despesas", base: despB, simulado: despS, nivel: 0, sinal: "-" });

  const resB = lbB - despB;
  const resS = lbS - despS;
  linhas.push({ chave: "resultado", rotulo: "Resultado", base: resB, simulado: resS, nivel: 1 });

  return {
    linhas,
    faturamento: { base: fatB, simulado: fatS },
    cmv: { base: cmvB, simulado: cmvS },
    lucroBruto: { base: lbB, simulado: lbS },
    despesas: { base: despB, simulado: despS },
    resultado: { base: resB, simulado: resS },
    margem: { base: fatB ? lbB / fatB : 0, simulado: fatS ? lbS / fatS : 0 },
  };
}

// ============================================================
// DFC simulado
// ============================================================

export const ROTULO_CFC: Record<number, string> = {
  1: "Fixas (CFC 1)",
  2: "Variáveis (CFC 2)",
  3: "Não operacionais (CFC 3)",
  4: "Investimentos (CFC 4)",
};

export type ResultadoDFC = {
  linhas: LinhaResultado[];
  entradas: { base: number; simulado: number };
  saidas: { base: number; simulado: number };
  resultado: { base: number; simulado: number };
};

export function simularDFC(base: BaseDFC, a: Alavancas): ResultadoDFC {
  const f = fatores(a);
  const naoOperB = soma(base.porTipoRecebimento.filter((t) => TIPOS_RECEBIMENTO_NAO_OPERACIONAIS.includes(t.codigo)).map((t) => t.valor));
  // Tudo que nao e tipo 9-12 conta como operacional (inclusive tipo sem nome).
  const operB = base.entradas - naoOperB;
  const operS = operB * f.receita;
  const entB = base.entradas;
  const entS = operS + naoOperB;

  const linhas: LinhaResultado[] = [
    { chave: "entradas", rotulo: "Entradas", base: entB, simulado: entS, nivel: 0 },
    { chave: "entradas-oper", rotulo: "Operacionais (tipos 1 a 8)", base: operB, simulado: operS, nivel: 2 },
    { chave: "entradas-nao-oper", rotulo: "Não operacionais (tipos 9 a 12)", base: naoOperB, simulado: naoOperB, nivel: 2 },
  ];

  const fatorCFC: Record<number, number> = { 1: f.fixa, 2: f.variavel, 3: 1, 4: 1 };
  const cfcs = base.porCFC.map((c) => ({ ...c, simulado: c.total * fatorCFC[c.cfc] }));
  const saiB = soma(cfcs.map((c) => c.total));
  const saiS = soma(cfcs.map((c) => c.simulado));
  linhas.push({ chave: "saidas", rotulo: "Saídas", base: saiB, simulado: saiS, nivel: 0, sinal: "-" });
  for (const c of cfcs) {
    linhas.push({ chave: `cfc-${c.cfc}`, rotulo: ROTULO_CFC[c.cfc], base: c.total, simulado: c.simulado, nivel: 2, sinal: "-" });
  }
  linhas.push({ chave: "resultado", rotulo: "Resultado do caixa", base: entB - saiB, simulado: entS - saiS, nivel: 1 });

  return {
    linhas,
    entradas: { base: entB, simulado: entS },
    saidas: { base: saiB, simulado: saiS },
    resultado: { base: entB - saiB, simulado: entS - saiS },
  };
}

/** Meses que compoem a base, terminando no mes escolhido (inclusive). */
export function mesesAte(ano: number, mes: number, n: number): { ano: number; mes: number }[] {
  const out: { ano: number; mes: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    out.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
  }
  return out;
}
