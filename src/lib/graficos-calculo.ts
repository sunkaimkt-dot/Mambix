import { calcularDREMes, type BaseAno } from "@/lib/contabil-calculo";

/*
 * Tela Graficos (especificacao 5.9): faturamento e lucro liquido em 12 meses,
 * comparados com o mes anterior, com o mesmo mes do ano anterior e no
 * acumulado do ano; ticket medio e numero de clientes; anos anteriores.
 *
 * Calculo puro (sem banco) para poder ser testado. As regras sao as mesmas da
 * DRE Gerencial:
 *   faturamento = soma do Caixa Diario do mes
 *   lucro       = faturamento x margem bruta - despesas da DRE
 * Mes SEM margem bruta informada fica sem lucro (null) em vez de mostrar o
 * prejuizo falso de "lucro bruto zero" -- mesmo criterio do Painel.
 */

export type Indicador = "faturamento" | "lucro";

export type SerieAno = {
  ano: number;
  faturamento: (number | null)[]; // 12 posicoes, jan..dez
  lucro: (number | null)[];
  clientes: (number | null)[];
  ticket: (number | null)[];
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * @param ateMes meses depois deste ficam null (ano corrente ainda nao chegou la).
 */
export function montarSerieAno(
  base: BaseAno,
  clientesPorMes: Record<number, number | null>,
  ateMes = 12
): SerieAno {
  const faturamento: (number | null)[] = [];
  const lucro: (number | null)[] = [];
  const clientes: (number | null)[] = [];
  const ticket: (number | null)[] = [];

  for (let m = 1; m <= 12; m++) {
    if (m > ateMes) {
      faturamento.push(null);
      lucro.push(null);
      clientes.push(null);
      ticket.push(null);
      continue;
    }
    const d = calcularDREMes(base, m);
    const temMargem = base.parametros.some((p) => p.mes === m && p.margem_bruta_pct !== null);
    faturamento.push(r2(d.faturamento));
    lucro.push(temMargem ? r2(d.resultado) : null);
    const c = clientesPorMes[m] ?? null;
    clientes.push(c);
    ticket.push(c && c > 0 ? r2(d.faturamento / c) : null);
  }
  return { ano: base.ano, faturamento, lucro, clientes, ticket };
}

/** Variacao percentual; null quando a base e zero ou falta um dos lados. */
export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null || anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}

const somaAte = (xs: (number | null)[], mes: number) => {
  const usados = xs.slice(0, mes);
  if (usados.every((v) => v === null)) return null;
  return r2(usados.reduce<number>((s, v) => s + (v ?? 0), 0));
};

export type Comparativo = {
  atual: number | null;
  mesAnterior: number | null;
  mesmoMesAnoAnterior: number | null;
  acumulado: number | null;
  acumuladoAnoAnterior: number | null;
  varMesAnterior: number | null;
  varAnoAnterior: number | null;
  varAcumulado: number | null;
};

/**
 * @param series ao menos o ano escolhido; o ano anterior entra se existir
 *   (sem ele, os comparativos anuais ficam null).
 */
export function comparativo(
  series: SerieAno[],
  ano: number,
  mes: number,
  campo: "faturamento" | "lucro" | "ticket" | "clientes"
): Comparativo {
  const atualAno = series.find((s) => s.ano === ano);
  const anoAnt = series.find((s) => s.ano === ano - 1);
  const v = (s: SerieAno | undefined, m: number) => (s ? s[campo][m - 1] : null);

  const atual = v(atualAno, mes);
  const mesAnterior = mes === 1 ? v(anoAnt, 12) : v(atualAno, mes - 1);
  const mesmoMesAnoAnterior = v(anoAnt, mes);

  // Ticket e clientes nao se somam: o "acumulado" deles nao faz sentido.
  const somavel = campo === "faturamento" || campo === "lucro";
  const acumulado = somavel && atualAno ? somaAte(atualAno[campo], mes) : null;
  const acumuladoAnoAnterior = somavel && anoAnt ? somaAte(anoAnt[campo], mes) : null;

  return {
    atual,
    mesAnterior,
    mesmoMesAnoAnterior,
    acumulado,
    acumuladoAnoAnterior,
    varMesAnterior: variacao(atual, mesAnterior),
    varAnoAnterior: variacao(atual, mesmoMesAnoAnterior),
    varAcumulado: variacao(acumulado, acumuladoAnoAnterior),
  };
}

/** Total e media mensal do ano (so dos meses com valor). */
export function totalEMedia(xs: (number | null)[]): { total: number | null; media: number | null } {
  const com = xs.filter((v): v is number => v !== null);
  if (com.length === 0) return { total: null, media: null };
  const total = r2(com.reduce((s, v) => s + v, 0));
  return { total, media: r2(total / com.length) };
}
