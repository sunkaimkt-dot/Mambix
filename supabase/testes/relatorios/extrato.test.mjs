// TESTE DO LEITOR DE EXTRATO (PDF e OFX) -- especificacao 5.13
//
// O que nao pode quebrar:
//   1. Data, descricao e valor saem certos nos layouts comuns de extrato.
//   2. Sinal: "-", D/C, parenteses e a variacao do saldo decidem debito x credito.
//   3. Linhas de saldo/total nao viram lancamento.
//   4. Linha sem data herda a data da anterior (bancos que so datam o 1o do dia).
//   5. OFX: sinal e data vem do arquivo.
//   6. A classificacao sugerida acerta os casos tipicos e a revisao vira abas
//      que o mapeamento automatico da importacao reconhece.
//
// Rodar:  npm run testar:extrato
import { lerLinhasExtrato, lerOFX, sugerirDespesa, sugerirRecebimento, prepararRevisao, revisaoParaAbas, anoDoExtrato } from "../../../src/lib/extrato.ts";
import { mapearAutomatico, separarCabecalho, validarLinhas } from "../../../src/lib/importacao.ts";

let falhas = 0;
const ok = (t) => console.log(`  \x1b[32mOK\x1b[0m  ${t}`);
const erro = (t, d) => { falhas++; console.log(`  \x1b[31mFALHOU\x1b[0m  ${t}${d ? `\n        ${d}` : ""}`); };
const checa = (t, cond, d) => (cond ? ok(t) : erro(t, d));
const j = (x) => JSON.stringify(x);

console.log("\n\x1b[1mLAYOUT 1 - data, historico, documento, valor com sinal, saldo\x1b[0m");
const l1 = [
  "EXTRATO DE CONTA CORRENTE - período 01/09/2026 a 30/09/2026",
  "Data Lançamento Documento Valor (R$) Saldo (R$)",
  "31/08/2026 SALDO ANTERIOR 10.000,00",
  "01/09/2026 PIX RECEBIDO JOAO SILVA 123456 1.500,00 11.500,00",
  "01/09/2026 PAGTO BOLETO ENEL SP 778899 -320,45 11.179,55",
  "02/09/2026 TARIFA PACOTE SERVICOS -89,90 11.089,65",
  "02/09/2026 CIELO VDA DEBITO MASTER 2.300,10 13.389,75",
  "SALDO DO DIA 13.389,75",
];
const m1 = lerLinhasExtrato(l1);
checa("4 movimentos (saldos ignorados)", m1.length === 4, j(m1));
checa("PIX recebido = crédito 1.500,00 em 01/09", m1[0]?.natureza === "credito" && m1[0].valor === 1500 && m1[0].data === "2026-09-01", j(m1[0]));
checa("Boleto ENEL = débito 320,45", m1[1]?.natureza === "debito" && m1[1].valor === 320.45, j(m1[1]));
checa("Descrição sem o nº do documento", m1[1]?.descricao === "PAGTO BOLETO ENEL SP", m1[1]?.descricao);
checa("Venda Cielo débito = crédito (pelo saldo)", m1[3]?.natureza === "credito" && m1[3].valor === 2300.1, j(m1[3]));

console.log("\n\x1b[1mLAYOUT 2 - dd/mm sem ano, sem sinal, saldo decide\x1b[0m");
const l2 = [
  "Extrato emitido em 05/10/2026",
  "SALDO ANTERIOR 5.000,00",
  "03/09 DEPOSITO EM ESPECIE 700,00 5.700,00",
  "ALUGUEL LOJA CENTRO 2.000,00 3.700,00",
  "04/09 SIMPLES NACIONAL 450,00 3.250,00",
];
const m2 = lerLinhasExtrato(l2);
checa("Ano vem do texto do extrato (2026)", anoDoExtrato(l2) === 2026);
checa("3 movimentos", m2.length === 3, j(m2));
checa("Linha sem data herda 03/09", m2[1]?.data === "2026-09-03", j(m2[1]));
checa("Aluguel = débito (saldo caiu 2.000)", m2[1]?.natureza === "debito");
checa("Depósito = crédito (saldo subiu)", m2[0]?.natureza === "credito");

console.log("\n\x1b[1mLAYOUT 3 - D/C e parenteses\x1b[0m");
const m3 = lerLinhasExtrato(["10/09/2026 COMPRA CARTAO POSTO SHELL 250,00 D", "11/09/2026 TED RECEBIDA CLIENTE X 3.000,00 C", "12/09/2026 IOF (12,34)"]);
checa("D = débito", m3[0]?.natureza === "debito" && m3[0].valor === 250, j(m3[0]));
checa("C = crédito", m3[1]?.natureza === "credito", j(m3[1]));
checa("(12,34) = débito", m3[2]?.natureza === "debito" && m3[2].valor === 12.34, j(m3[2]));

console.log("\n\x1b[1mSEM PISTA NENHUMA\x1b[0m");
const m4 = lerLinhasExtrato(["15/09/2026 XPTO LTDA 99,00"]);
checa("Vira débito marcado como incerto", m4[0]?.natureza === "debito" && m4[0].naturezaIncerta === true, j(m4[0]));

console.log("\n\x1b[1mOFX\x1b[0m");
const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260905120000[-3:BRT]<TRNAMT>-150.75<FITID>1<MEMO>PAGAMENTO SABESP
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260906<TRNAMT>980,00<FITID>2<NAME>STONE PAGAMENTOS<MEMO>CREDITO VENDAS
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const mo = lerOFX(ofx);
checa("2 movimentos do OFX", mo.length === 2, j(mo));
checa("Sabesp: débito 150,75 em 05/09", mo[0]?.natureza === "debito" && mo[0].valor === 150.75 && mo[0].data === "2026-09-05", j(mo[0]));
checa("Stone: crédito 980,00 (vírgula aceita)", mo[1]?.natureza === "credito" && mo[1].valor === 980, j(mo[1]));

console.log("\n\x1b[1mCLASSIFICACAO SUGERIDA\x1b[0m");
const casos = [
  ["PAGTO BOLETO ENEL SP", 34, 3], ["TARIFA PACOTE SERVICOS", 77, 5], ["SIMPLES NACIONAL DAS", 70, 4],
  ["PIX ENVIADO - ALUGUEL SALA", 31, 7], ["COMPRA CARTAO POSTO SHELL", 50, 8], ["SABESP CONTA AGUA", 33, null],
  ["IOF", 76, 5], ["DARF IRPJ", 68, 4], ["FOLHA DE PAGAMENTO", 6, null], ["XPTO LTDA", null, null],
];
for (const [d, cod, cp] of casos) {
  const s = sugerirDespesa(d);
  checa(`"${d}" -> código ${cod ?? "—"}${cp !== null ? `, CP ${cp}` : ""}`, s.codigo === cod && (cp === null || s.forma === cp), j(s));
}
const recs = [["CIELO VDA DEBITO MASTER", 2], ["STONE PAGAMENTOS CREDITO VENDAS", 3], ["PIX RECEBIDO JOAO", 7], ["DEPOSITO EM ESPECIE", 1], ["RENDIMENTO POUPANCA", 9], ["ALELO VALE REFEICAO", 4], ["XPTO", 12]];
for (const [d, t] of recs) checa(`"${d}" -> tipo ${t}`, sugerirRecebimento(d) === t, String(sugerirRecebimento(d)));

console.log("\n\x1b[1mREVISAO -> IMPORTACAO\x1b[0m");
const rev = prepararRevisao(m1);
rev[3].incluir = false;
const abas = revisaoParaAbas(rev);
const pg = separarCabecalho(abas[0].dados);
const mapaPg = mapearAutomatico("pagamentos", pg.cabecalho);
checa("Aba de pagamentos tem os 2 débitos", pg.linhas.length === 2, j(pg.linhas));
checa("Mapeamento automático acha vencimento, código, valor e data de pagamento",
  mapaPg.vencimento >= 0 && mapaPg.codigo >= 0 && mapaPg.valor >= 0 && mapaPg.data_pagamento >= 0, j(mapaPg));
const rc = separarCabecalho(abas[1].dados);
const mapaRc = mapearAutomatico("receitas", rc.cabecalho);
checa("Linha desmarcada fica de fora (1 crédito)", rc.linhas.length === 1);
checa("Mapeamento de receitas acha data, tipo e valor", mapaRc.data >= 0 && mapaRc.tipo >= 0 && mapaRc.valor >= 0, j(mapaRc));

const refs = {
  codigos: Array.from({ length: 100 }, (_, i) => ({ codigo: i + 1, nome: `C${i + 1}`, grupo: "FIXAS" })),
  formas: Array.from({ length: 12 }, (_, i) => ({ codigo: i + 1, nome: `F${i + 1}` })),
  tiposRecebimento: Array.from({ length: 12 }, (_, i) => ({ codigo: i + 1, nome: `T${i + 1}` })),
  tiposVenda: [],
  bancos: [{ id: "b1", nome: "ITAU" }],
  lojas: [{ id: "l1", nome: "MATRIZ" }],
};
try {
  const v = validarLinhas("pagamentos", pg, mapaPg, refs, { empresaId: "e1", lojaId: "l1", bancoPadraoId: "b1" });
  checa("Débitos classificados passam na validação da importação", v.every((l) => l.situacao === "ok"), j(v.map((l) => [l.situacao, l.erros ?? l.motivo])));
} catch (e) {
  erro("validarLinhas rodou", e.message);
}

if (falhas) { console.log(`\n\x1b[31m${falhas} FALHA(S)\x1b[0m`); process.exit(1); }
console.log("\n\x1b[32m\x1b[1mTODOS OS TESTES DE EXTRATO PASSARAM\x1b[0m");
