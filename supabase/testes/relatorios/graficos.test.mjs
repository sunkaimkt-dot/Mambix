// TESTE DA TELA GRAFICOS (especificacao 5.9)
//
// O que nao pode quebrar:
//   1. Faturamento e lucro de cada mes batem com a DRE Gerencial (calcularDREMes).
//   2. Mes sem margem bruta fica SEM lucro (null), nao com prejuizo falso.
//   3. Ticket medio = faturamento / clientes; sem clientes, null.
//   4. Comparativos: janeiro compara com dezembro do ano anterior; acumulado
//      soma so ate o mes escolhido; base zero nao gera variacao.
//   5. Meses depois do mes escolhido (ano corrente) ficam null.
//
// Rodar:  npm run testar:graficos
import { montarSerieAno, comparativo, variacao, totalEMedia } from "../../../src/lib/graficos-calculo.ts";
import { calcularDREMes } from "../../../src/lib/contabil-calculo.ts";

let falhas = 0;
const ok = (t) => console.log(`  \x1b[32mOK\x1b[0m  ${t}`);
const erro = (t, d) => { falhas++; console.log(`  \x1b[31mFALHOU\x1b[0m  ${t}${d ? `\n        ${d}` : ""}`); };
const checa = (t, cond, d) => (cond ? ok(t) : erro(t, d));

const codigos = Array.from({ length: 100 }, (_, i) => ({ codigo: i + 1, nome: `COD ${i + 1}` }));
const tiposVenda = [{ codigo: 1, nome: "DINHEIRO" }, { codigo: 2, nome: "CARTÃO" }];

function base(ano, vendasPorMes, despesasPorMes, margens) {
  const vendas = [];
  const pagamentos = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    if (vendasPorMes[m]) {
      vendas.push({ data: `${ano}-${mm}-05`, tipo_venda: 1, valor: vendasPorMes[m] * 0.4 });
      vendas.push({ data: `${ano}-${mm}-20`, tipo_venda: 2, valor: vendasPorMes[m] * 0.6 });
    }
    if (despesasPorMes[m]) {
      pagamentos.push({ cd: 31, valor: despesasPorMes[m] * 0.5, comp_mes: m });
      pagamentos.push({ cd: 6, valor: despesasPorMes[m] * 0.5, comp_mes: m });
      pagamentos.push({ cd: 95, valor: 9999, comp_mes: m }); // investimento: fora da DRE
    }
  }
  const parametros = Object.entries(margens).map(([m, v]) => ({ mes: Number(m), margem_bruta_pct: v, saldo_inicial: null }));
  return { ano, codigos, tiposVenda, tiposRecebimento: [], pagamentos, vendas, baixas: [], receitas: [], parametros };
}

console.log("\n\x1b[1mSERIE DO ANO\x1b[0m");
const fat24 = { 1: 10000, 2: 12000, 3: 0, 12: 20000 };
const desp24 = { 1: 3000, 2: 3000, 12: 5000 };
const b24 = base(2024, fat24, desp24, { 1: 0.5, 2: 0.5, 12: 0.4 });
const s24 = montarSerieAno(b24, { 1: 100, 2: 0, 12: 250 });

let bate = true;
for (let m = 1; m <= 12; m++) {
  const d = calcularDREMes(b24, m);
  if (Math.round(d.faturamento * 100) !== Math.round(s24.faturamento[m - 1] * 100)) bate = false;
}
checa("Faturamento de cada mês = DRE Gerencial", bate);
checa("Lucro de jan = 10.000 x 50% - 3.000 = 2.000 (investimento fora)", s24.lucro[0] === 2000, String(s24.lucro[0]));
checa("Mês sem margem (mar) fica sem lucro, não com prejuízo", s24.lucro[2] === null);
checa("Ticket de jan = 10.000 / 100 = 100", s24.ticket[0] === 100);
checa("Clientes = 0 não gera ticket (sem divisão por zero)", s24.ticket[1] === null);
checa("Sem clientes informados, ticket null", s24.ticket[3] === null);

console.log("\n\x1b[1mANO CORRENTE ATE O MES ESCOLHIDO\x1b[0m");
const b25 = base(2025, { 1: 15000, 2: 9000, 3: 11000, 4: 50000 }, { 1: 4000, 2: 4000, 3: 4000 }, { 1: 0.5, 2: 0.5, 3: 0.5 });
const s25 = montarSerieAno(b25, { 1: 120 }, 3);
checa("Abril (depois do mês escolhido) fica null", s25.faturamento[3] === null && s25.lucro[3] === null);
checa("Março tem valor", s25.faturamento[2] === 11000);

console.log("\n\x1b[1mCOMPARATIVOS\x1b[0m");
const cJan = comparativo([s24, s25], 2025, 1, "faturamento");
checa("Janeiro compara com dezembro do ano anterior (20.000)", cJan.mesAnterior === 20000);
checa("Mesmo mês do ano anterior = jan/24 (10.000)", cJan.mesmoMesAnoAnterior === 10000);
checa("Variação x ano anterior = +50%", Math.abs(cJan.varAnoAnterior - 0.5) < 1e-9);

const cMar = comparativo([s24, s25], 2025, 3, "faturamento");
checa("Acumulado jan–mar/25 = 35.000", cMar.acumulado === 35000, String(cMar.acumulado));
checa("Acumulado jan–mar/24 = 22.000", cMar.acumuladoAnoAnterior === 22000, String(cMar.acumuladoAnoAnterior));
checa("Mar/24 = 0: sem variação (base zero)", cMar.varAnoAnterior === null);

const cTicket = comparativo([s24, s25], 2025, 1, "ticket");
checa("Ticket não tem acumulado", cTicket.acumulado === null);
checa("Sem ano anterior, comparativo anual é null", comparativo([s25], 2025, 2, "faturamento").mesmoMesAnoAnterior === null);

console.log("\n\x1b[1mAUXILIARES\x1b[0m");
checa("variacao(-500, -1000) = +50% (prejuízo diminuiu)", variacao(-500, -1000) === 0.5);
const tm = totalEMedia([100, null, 300]);
checa("Total e média ignoram meses vazios", tm.total === 400 && tm.media === 200);

if (falhas) { console.log(`\n\x1b[31m${falhas} FALHA(S)\x1b[0m`); process.exit(1); }
console.log("\n\x1b[32m\x1b[1mTODOS OS TESTES DE GRAFICOS PASSARAM\x1b[0m");
