// Parte do combo3.test.mjs: SIMULADOR DE CENARIOS.
// Usa o mesmo banco do teste principal (os lotes de importacao ja foram
// desfeitos, so sobrou o movimento previo):
//   jun/26: sem margem; salario 2.900; vendas 7.000
//   jul/26: margem 40%; salario 3.000 (pago); vendas 9.000
//   ago/26: margem 38%; luz 450 + salario 3.100 (pago); vendas 8.000; receita 4.000
//   set/26: margem 42%; aluguel 2.000 (pago, CFC 1), taxa cartao 180 (cod 87,
//           pago, CFC 2, filial), Simples 900 (cod 70, aberto); vendas 2.500;
//           receita 5.000 (tipo 3)
const { E, matriz, checa, igual, cent } = globalThis.__combo3;
const { dadosDRE, dadosDFC } = await import("@/lib/relatorios");
const sim = await import("@/lib/simulador-calculo");
const { carregarBaseSimulador } = await import("@/lib/simulador-dados");

const Z = sim.ALAVANCAS_ZERO;
const todasIguais = (r) => r.linhas.every((l) => cent(l.base) === cent(l.simulado));

console.log("\n\x1b[1m8. SIMULADOR — ALAVANCAS EM 0% = BASE\x1b[0m");
for (const [n, loja] of [[1, null], [1, matriz], [3, null], [6, null], [12, null], [12, matriz]]) {
  const b = await carregarBaseSimulador(E, 2026, 9, n, loja);
  const rd = sim.simularDRE(b.dre, Z, {});
  const rf = sim.simularDFC(b.dfc, Z);
  checa(`${n} mês(es)${loja ? " / matriz" : ""}: DRE simulada = base em todas as ${rd.linhas.length} linhas`, todasIguais(rd), rd.linhas.filter((l) => cent(l.base) !== cent(l.simulado)));
  checa(`${n} mês(es)${loja ? " / matriz" : ""}: DFC simulado = base em todas as ${rf.linhas.length} linhas`, todasIguais(rf));
  const zerosGrupo = sim.simularDRE(b.dre, Z, { FIXAS: 0, VARIAVEIS: 0 });
  checa(`${n} mês(es): ajuste de grupo em 0% também = base`, todasIguais(zerosGrupo));
}

console.log("\n\x1b[1m9. SIMULADOR — BASE DE 1 MÊS = DRE GERENCIAL / DFC\x1b[0m");
for (const loja of [null, matriz]) {
  const b = await carregarBaseSimulador(E, 2026, 9, 1, loja);
  const d = await dadosDRE(E, 2026, 9, loja);
  const f = await dadosDFC(E, 2026, 9, loja);
  const rd = sim.simularDRE(b.dre, Z);
  const rf = sim.simularDFC(b.dfc, Z);
  const tag = loja ? "matriz" : "consolidado";
  igual(`${tag}: faturamento = DRE Gerencial`, rd.faturamento.base, d.faturamento);
  igual(`${tag}: CMV = DRE Gerencial`, rd.cmv.base, d.cmv);
  igual(`${tag}: lucro bruto = DRE Gerencial`, rd.lucroBruto.base, d.lucroBruto);
  igual(`${tag}: despesas = DRE Gerencial`, rd.despesas.base, d.despesas);
  igual(`${tag}: resultado = DRE Gerencial`, rd.resultado.base, d.resultado);
  for (const g of d.grupos) igual(`${tag}: grupo ${g.rotulo} = DRE Gerencial`, rd.linhas.find((l) => l.chave === `grupo-${g.chave}`).base, g.total);
  igual(`${tag}: entradas = DFC`, rf.entradas.base, f.entradas);
  igual(`${tag}: saídas = DFC`, rf.saidas.base, f.saidas);
  igual(`${tag}: resultado do caixa = DFC`, rf.resultado.base, f.resultado);
}

console.log("\n\x1b[1m10. SIMULADOR — MÉDIA DE N MESES\x1b[0m");
const b6 = await carregarBaseSimulador(E, 2026, 9, 6, null);
checa("6 meses: abr e mai saem (sem movimento), jun sai (sem margem)",
  JSON.stringify(b6.dre.excluidos.map((x) => [x.mes, x.motivo])) === JSON.stringify([[4, "sem movimento"], [5, "sem movimento"], [6, "sem margem bruta em Parâmetros"]]), b6.dre.excluidos);
checa("6 meses: base DRE = jul, ago, set", b6.dre.meses.map((m) => m.mes).join(",") === "7,8,9");
const dres = await Promise.all([7, 8, 9].map((m) => dadosDRE(E, 2026, m, null)));
const media = (k) => dres.reduce((s, d) => s + d[k], 0) / 3;
igual("média do faturamento = (9.000 + 8.000 + 2.500) / 3", sim.simularDRE(b6.dre, Z).faturamento.base, 6500);
igual("média do resultado = média dos resultados mensais da DRE", sim.simularDRE(b6.dre, Z).resultado.base, media("resultado"));
igual("média do CMV = média dos CMV mensais", b6.dre.cmv, media("cmv"));
checa("6 meses: DFC usa os meses com movimento de caixa (jun não teve: salário em aberto, sem receita)", b6.dfc.meses.map((m) => m.mes).join(",") === "7,8,9", b6.dfc.meses);
const b6m = sim.montarBaseDFC([{ ano: 2026, mes: 6, entradas: 0, porTipoRecebimento: [], porCFC: [{ cfc: 1, total: 100 }], saidas: 100 }]);
checa("DFC: mês sem margem mas com saída entra na média do caixa", b6m.meses.length === 1 && b6m.excluidos.length === 0);

const bJun = await carregarBaseSimulador(E, 2026, 6, 1, null);
checa("base de 1 mês sem margem (jun): mês entra como na DRE Gerencial, com aviso", bJun.dre.semMargem && bJun.dre.meses.length === 1 && cent(sim.simularDRE(bJun.dre, Z).resultado.base) === cent((await dadosDRE(E, 2026, 6, null)).resultado));

console.log("\n\x1b[1m11. SIMULADOR — CADA ALAVANCA (setembro, consolidado)\x1b[0m");
// set: fat 2.500; CMV 2.500 x 58% = 1.450; Simples 900 (sobre vendas); taxa 180 (variavel); aluguel 2.000 (fixa)
const b1 = await carregarBaseSimulador(E, 2026, 9, 1, null);
const res0 = sim.simularDRE(b1.dre, Z).resultado.base;
const delta = (a, aj) => sim.simularDRE(b1.dre, { ...Z, ...a }, aj).resultado.simulado - res0;
igual("preço +10%: +250 de faturamento − 90 de Simples (CMV não muda) = +160", delta({ preco: 0.1 }), 160);
igual("quantidade +10%: +250 − 145 CMV − 90 Simples − 18 variáveis = −3", delta({ quantidade: 0.1 }), -3);
igual("custo variável +10%: −145 CMV − 18 variáveis = −163", delta({ custoVariavel: 0.1 }), -163);
igual("despesa fixa +10%: −200 do aluguel (Simples e variáveis não mexem)", delta({ despesaFixa: 0.1 }), -200);
igual("preço e quantidade +10% juntos: faturamento × 1,21", sim.simularDRE(b1.dre, { ...Z, preco: 0.1, quantidade: 0.1 }).faturamento.simulado, 3025);
igual("ajuste por grupo substitui a alavanca: quantidade +10% e Variáveis −50% → taxa 180 vira 90", sim.simularDRE(b1.dre, { ...Z, quantidade: 0.1 }, { VARIAVEIS: -0.5 }).linhas.find((l) => l.chave === "grupo-VARIAVEIS").simulado, 90);
const f1 = sim.simularDFC(b1.dfc, { ...Z, preco: 0.1 });
igual("DFC preço +10%: entradas operacionais 5.000 → 5.500", f1.entradas.simulado, 5500);
igual("DFC preço +10%: saídas não mudam", f1.saidas.simulado, f1.saidas.base);
const f2 = sim.simularDFC(b1.dfc, { ...Z, despesaFixa: 0.1, custoVariavel: 0.1 });
igual("DFC fixa e variável +10%: CFC 1 2.000 → 2.200 e CFC 2 180 → 198", f2.saidas.simulado - f2.saidas.base, 218);
