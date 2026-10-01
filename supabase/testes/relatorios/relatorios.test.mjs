// TESTE DOS RELATORIOS DO COMBO 2 (Evolucao DRE/DFC, DRE Contabil, Fluxo Contabil)
//
// O que nao pode quebrar nunca:
//   1. Cada mes da Evolucao DRE bate, centavo por centavo, com a DRE Gerencial
//      (dadosDRE do relatorios.ts) daquele mes -- consolidado e por loja.
//   2. Cada mes da Evolucao DFC bate com o DFC (dadosDFC) daquele mes.
//   3. A DRE Contabil so rearruma: Resultado Liquido = Resultado da DRE Gerencial,
//      e o mapa de codigos cobre 1-90 sem sobra e sem repeticao.
//   4. O Fluxo Contabil fecha com o DFC: Resultado Liquido = Entradas - Saidas.
//   5. A leitura paginada pega mais de 1.000 linhas (o Supabase corta em 1.000).
//
// Roda as funcoes de VERDADE (relatorios.ts sem nenhuma alteracao) contra um
// Supabase falso em memoria, com os mesmos dados para os dois lados.
//
// Rodar:  npm run testar:relatorios
import { banco } from "./fake-supabase.mjs";
import { dadosDRE, dadosDFC } from "../../../src/lib/relatorios.ts";
import { lerBase } from "../../../src/lib/relatorios-contabeis.ts";
import {
  calcularDREMes,
  calcularDFCMes,
  calcularDREContabil,
  calcularFluxoContabil,
  evolucaoDRE,
  evolucaoDFC,
  MAPA_DRE_CONTABIL,
  pontoEquilibrio,
} from "../../../src/lib/contabil-calculo.ts";

let falhas = 0;
const ok = (t) => console.log(`  \x1b[32mOK\x1b[0m  ${t}`);
const erro = (t, d) => { falhas++; console.log(`  \x1b[31mFALHOU\x1b[0m  ${t}${d ? `\n        ${d}` : ""}`); };
const checa = (t, cond, d) => (cond ? ok(t) : erro(t, d));
const cent = (v) => Math.round(v * 100);
const igual = (a, b) => cent(a) === cent(b);

/* ---------------- dados de exemplo (gerador deterministico) ---------------- */
let semente = 42;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const dinheiro = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;
let seq = 0;
const id = () => `00000000-0000-0000-0000-${String(++seq).padStart(12, "0")}`;

const EMP = "emp-1";
const OUTRA = "emp-2";
const LOJA_A = "loja-a";
const LOJA_B = "loja-b";
const ANO = 2026;
const data = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

banco.codigos_despesa = Array.from({ length: 100 }, (_, i) => ({ empresa_id: EMP, codigo: i + 1, nome: `COD ${i + 1}` }));
banco.tipos_venda = Array.from({ length: 12 }, (_, i) => ({ empresa_id: EMP, codigo: i + 1, nome: i < 9 ? `VENDA ${i + 1}` : "" }));
banco.tipos_recebimento = Array.from({ length: 12 }, (_, i) => ({ empresa_id: EMP, codigo: i + 1, nome: i === 3 ? "" : `REC ${i + 1}` }));
banco.parametros_mes = [];
banco.pagamentos = [];
banco.pagamento_baixas = [];
banco.caixa_diario = [];
banco.receitas = [];

const lojas = [LOJA_A, LOJA_B, null];
for (let mes = 1; mes <= 12; mes++) {
  // margem: alguns meses sem margem (testa o "s/ margem")
  if (mes % 4 !== 0) banco.parametros_mes.push({ empresa_id: EMP, ano: ANO, mes, margem_bruta_pct: dinheiro(0.3, 0.7), saldo_inicial: { b1: 1000, b2: 250.5 } });

  for (let i = 0; i < 320; i++) {
    const pid = id();
    const cd = entre(1, 100);
    const valor = dinheiro(5, 3000);
    const loja = lojas[entre(0, 2)];
    banco.pagamentos.push({ id: pid, empresa_id: EMP, cd, cfc: entre(1, 4), valor, comp_mes: mes, comp_ano: ANO, loja_id: loja, descricao: `conta ${i}`, cp: entre(1, 10), pago: false });
    // parte paga no mesmo mes, parte no seguinte, parte em 2 parcelas, parte nunca
    const sorte = rnd();
    if (sorte < 0.5) banco.pagamento_baixas.push({ id: id(), empresa_id: EMP, pagamento_id: pid, data_pagamento: data(ANO, mes, entre(1, 28)), valor, cp: 1 });
    else if (sorte < 0.75) {
      const [a, m] = mes === 12 ? [ANO + 1, 1] : [ANO, mes + 1];
      banco.pagamento_baixas.push({ id: id(), empresa_id: EMP, pagamento_id: pid, data_pagamento: data(a, m, entre(1, 28)), valor, cp: 1 });
    } else if (sorte < 0.9) {
      const metade = Math.round(valor * 50) / 100;
      banco.pagamento_baixas.push({ id: id(), empresa_id: EMP, pagamento_id: pid, data_pagamento: data(ANO, mes, entre(1, 28)), valor: metade, cp: 1 });
      banco.pagamento_baixas.push({ id: id(), empresa_id: EMP, pagamento_id: pid, data_pagamento: data(ANO, mes, entre(1, 28)), valor: Math.round((valor - metade) * 100) / 100, cp: 1 });
    }
  }
  for (let i = 0; i < 150; i++) {
    banco.caixa_diario.push({ id: id(), empresa_id: EMP, data: data(ANO, mes, entre(1, 28)), tipo_venda: entre(1, 12), valor: dinheiro(50, 4000), loja_id: lojas[entre(0, 1)] });
    banco.receitas.push({ id: id(), empresa_id: EMP, data: data(ANO, mes, entre(1, 28)), tipo_recebimento: entre(1, 12), valor: dinheiro(50, 4000), loja_id: lojas[entre(0, 2)], descricao: "rec" });
  }
}
// ruido: outra empresa e outro ano nao podem entrar
banco.pagamentos.push({ id: id(), empresa_id: OUTRA, cd: 6, cfc: 1, valor: 99999, comp_mes: 3, comp_ano: ANO, loja_id: null, descricao: "x" });
banco.pagamentos.push({ id: id(), empresa_id: EMP, cd: 6, cfc: 1, valor: 77777, comp_mes: 3, comp_ano: ANO - 1, loja_id: null, descricao: "x" });
banco.caixa_diario.push({ id: id(), empresa_id: EMP, data: data(ANO - 1, 12, 31), tipo_venda: 1, valor: 55555, loja_id: null });
banco.receitas.push({ id: id(), empresa_id: OUTRA, data: data(ANO, 5, 5), tipo_recebimento: 1, valor: 44444, loja_id: null });

/* ---------------- comparacoes ---------------- */
function compararDRE(ref, ev, mes, rotulo) {
  const i = mes - 1;
  const s = Object.fromEntries(ev.secoes.map((x) => [x.titulo, x.linhas]));
  const res = Object.fromEntries(s["Resultado"].map((l) => [l.id, l.meses[i]]));
  const difs = [];
  for (const [k, v] of [["faturamento", ref.faturamento], ["cmv", ref.cmv], ["lucro-bruto", ref.lucroBruto], ["despesas", ref.despesas], ["resultado", ref.resultado]])
    if (!igual(res[k], v)) difs.push(`${k}: ${res[k]} x ${v}`);
  ref.grupos.forEach((g, j) => { if (!igual(s["Despesas por grupo"][j].meses[i], g.total)) difs.push(`grupo ${g.chave}`); });
  ref.porTipoVenda.forEach((t, j) => { if (!igual(s["Faturamento por forma de venda"][j].meses[i], t.valor)) difs.push(`venda ${t.codigo}`); });
  ref.porCodigo.forEach((c, j) => { if (!igual(s["Detalhamento por código"][j].meses[i], c.valor)) difs.push(`cd ${c.codigo}`); });
  checa(`Evolução DRE ${rotulo} mês ${String(mes).padStart(2, "0")} = DRE Gerencial`, difs.length === 0, difs.slice(0, 5).join("; "));
}

function compararDFC(ref, ev, mes, rotulo) {
  const i = mes - 1;
  const s = Object.fromEntries(ev.secoes.map((x) => [x.titulo, x.linhas]));
  const res = Object.fromEntries(s["Resultado"].map((l) => [l.id, l.meses[i]]));
  const difs = [];
  for (const [k, v] of [["entradas", ref.entradas], ["saidas", ref.saidas], ["resultado", ref.resultado]])
    if (!igual(res[k], v)) difs.push(`${k}: ${res[k]} x ${v}`);
  ref.grupos.forEach((g, j) => { if (!igual(s["Saídas por grupo"][j].meses[i], g.total)) difs.push(`grupo ${g.chave}`); });
  ref.porTipoRecebimento.forEach((t, j) => { if (!igual(s["Entradas por tipo de recebimento"][j].meses[i], t.valor)) difs.push(`rec ${t.codigo}`); });
  ref.porCFC.forEach((c, j) => { if (!igual(s["Saídas por CFC"][j].meses[i], c.total)) difs.push(`cfc ${c.cfc}`); });
  ref.porCodigo.forEach((c, j) => { if (!igual(s["Detalhamento por código"][j].meses[i], c.valor)) difs.push(`cd ${c.codigo}`); });
  checa(`Evolução DFC ${rotulo} mês ${String(mes).padStart(2, "0")} = DFC`, difs.length === 0, difs.slice(0, 5).join("; "));
}

console.log("\n\x1b[1mFASE 1 - leitura paginada\x1b[0m");
const baseAno = await lerBase(EMP, ANO, null);
const pagAno = banco.pagamentos.filter((p) => p.empresa_id === EMP && p.comp_ano === ANO).length;
checa(`Leu os ${pagAno} pagamentos do ano (mais de 1.000)`, baseAno.pagamentos.length === pagAno && pagAno > 1000, `${baseAno.pagamentos.length}`);
checa("Outra empresa e outro ano ficaram de fora", !baseAno.pagamentos.some((p) => p.valor === 99999 || p.valor === 77777) && !baseAno.vendas.some((v) => v.valor === 55555) && !baseAno.receitas.some((r) => r.valor === 44444));

for (const [loja, rotulo] of [[null, "consolidado"], [LOJA_A, "loja A"], [LOJA_B, "loja B"]]) {
  console.log(`\n\x1b[1mFASE 2 - Evolução x relatório do mês (${rotulo})\x1b[0m`);
  const base = loja ? await lerBase(EMP, ANO, loja) : baseAno;
  const evD = evolucaoDRE(base);
  const evF = evolucaoDFC(base);
  for (let mes = 1; mes <= 12; mes++) {
    compararDRE(await dadosDRE(EMP, ANO, mes, loja), evD, mes, rotulo);
    compararDFC(await dadosDFC(EMP, ANO, mes, loja), evF, mes, rotulo);
  }
  const tot = evD.secoes.find((s) => s.titulo === "Resultado").linhas.find((l) => l.id === "resultado");
  checa(`Total do ano (DRE ${rotulo}) = soma dos 12 meses`, igual(tot.total, tot.meses.reduce((a, b) => a + b, 0)));
}

console.log("\n\x1b[1mFASE 3 - DRE Contábil\x1b[0m");
const todos = [
  ...MAPA_DRE_CONTABIL.impostosSobreVendas, ...MAPA_DRE_CONTABIL.descontos, ...MAPA_DRE_CONTABIL.devolucoes,
  ...MAPA_DRE_CONTABIL.custosVariaveis, ...MAPA_DRE_CONTABIL.irCsll, ...MAPA_DRE_CONTABIL.despesas.flatMap((g) => g.codigos),
].sort((a, b) => a - b);
checa("Mapa cobre os códigos 1 a 90, cada um uma vez só", todos.length === 90 && todos.every((c, i) => c === i + 1), todos.join(","));
for (let mes = 1; mes <= 12; mes++) {
  const ref = await dadosDRE(EMP, ANO, mes, null);
  const c = calcularDREContabil(calcularDREMes(baseAno, mes), 0.1);
  checa(`Mês ${String(mes).padStart(2, "0")}: Resultado Líquido contábil = Resultado da DRE Gerencial`, igual(c.resultadoLiquido, ref.resultado), `${c.resultadoLiquido} x ${ref.resultado}`);
}

console.log("\n\x1b[1mFASE 4 - Fluxo Contábil\x1b[0m");
for (const loja of [null, LOJA_A]) {
  const base = loja ? await lerBase(EMP, ANO, loja) : baseAno;
  for (const mes of [1, 6, 12]) {
    const ref = await dadosDFC(EMP, ANO, mes, loja);
    const f = calcularFluxoContabil(calcularDFCMes(base, mes), base.receitas, mes, 0, 0.1);
    checa(`${loja ? "Loja A" : "Consolidado"} mês ${String(mes).padStart(2, "0")}: Resultado Líquido = Entradas − Saídas do DFC`, igual(f.resultadoLiquido, ref.resultado), `${f.resultadoLiquido} x ${ref.resultado}`);
  }
}

console.log("\n\x1b[1mFASE 5 - ponto de equilíbrio\x1b[0m");
{
  const p = pontoEquilibrio(100000, 40000, 20000, 0.1); // MC 40%
  checa("PEF = fixos / MC% (20.000 / 40% = 50.000)", igual(p.pef, 50000), `${p.pef}`);
  checa("PEE = fixos / (MC% − lucro%) (20.000 / 30% = 66.666,67)", igual(p.pee, 20000 / 0.3), `${p.pee}`);
  const q = pontoEquilibrio(100000, 5000, 20000, 0.1); // MC 5% < lucro 10%
  checa("Lucro desejável maior que a margem: PEE não atingível (null)", q.pee === null);
  checa("Sem receita: PEF não atingível (null)", pontoEquilibrio(0, 0, 100, 0.1).pef === null);
}

console.log(falhas ? `\n\x1b[31m\x1b[1m${falhas} TESTE(S) FALHARAM\x1b[0m` : "\n\x1b[32m\x1b[1mTODOS OS TESTES DE RELATORIOS PASSARAM\x1b[0m");
process.exit(falhas ? 1 : 0);
