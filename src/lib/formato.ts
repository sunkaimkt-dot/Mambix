export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MESES_CURTO = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

export function brl(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(v: number | null | undefined) {
  return `${((v ?? 0) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function num(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const GRUPOS_DRE = [
  { chave: "PRO_LABORE", rotulo: "Pró-labore", de: 1, ate: 5 },
  { chave: "RH_PESSOAL", rotulo: "RH - Pessoal", de: 6, ate: 25 },
  { chave: "FIXAS", rotulo: "Fixas / Operacionais", de: 26, ate: 60 },
  { chave: "IMPOSTOS", rotulo: "Impostos", de: 61, ate: 70 },
  { chave: "FINANCEIRAS", rotulo: "Financeiras", de: 71, ate: 80 },
  { chave: "VARIAVEIS", rotulo: "Variáveis", de: 81, ate: 90 },
] as const;

export const GRUPOS_DFC_EXTRA = [
  { chave: "INVESTIMENTOS", rotulo: "Investimentos", de: 91, ate: 98 },
  { chave: "RETIRADA_SOCIO", rotulo: "Retirada de sócio", de: 99, ate: 99 },
  { chave: "ESTOQUE", rotulo: "Estoque / Matéria-prima", de: 100, ate: 100 },
] as const;

export const CFC = [
  { codigo: 1, nome: "Fixa" },
  { codigo: 2, nome: "Variável" },
  { codigo: 3, nome: "Não operacional" },
  { codigo: 4, nome: "Investimento" },
];
