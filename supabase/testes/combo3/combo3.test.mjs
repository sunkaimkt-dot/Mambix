// TESTE DO COMBO 3 -- Importacao Excel/CSV e Simulador de cenarios
//
// Roda contra um Postgres DE VERDADE em memoria (PGlite) com todas as
// migrations, RLS e triggers, usando as actions e os relatorios reais do
// sistema (acoes.ts, relatorios.ts, importacao-acoes.ts, simulador-*.ts).
//
// O que nao pode quebrar nunca:
//   1. Importar muda a DRE e o DFC do mes EXATAMENTE pelo valor importado --
//      nem um centavo a mais, nem a menos (competencia na DRE, baixa no DFC).
//   2. Linha com erro, duplicada ou em conflito nao entra sem o usuario mandar.
//   3. Desfazer o lote volta a DRE e o DFC ao que eram, centavo por centavo.
//   4. Quem e "consulta" nao importa; BPO de fora nao enxerga o lote.
//   5. Simulador com todas as alavancas em 0% = base, centavo por centavo; e a
//      base de 1 mes = DRE Gerencial / DFC do mes.
//
// Rodar:  npm run testar:combo3
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { usarBanco, entrarComo } from "./pglite-supabase.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR = join(AQUI, "..", "..", "migrations");

let falhas = 0;
const ok = (t) => console.log(`  \x1b[32mOK\x1b[0m  ${t}`);
const erro = (t, d) => { falhas++; console.log(`  \x1b[31mFALHOU\x1b[0m  ${t}${d !== undefined ? `\n        ${typeof d === "string" ? d : JSON.stringify(d)}` : ""}`); };
const checa = (t, cond, d) => (cond ? ok(t) : erro(t, d));
const cent = (v) => Math.round(Number(v) * 100);
const igual = (t, a, b) => checa(t, cent(a) === cent(b), `esperado ${Number(b).toFixed(2)}, veio ${Number(a).toFixed(2)}`);

// ------------------------------------------------------------ banco
const db = await PGlite.create();
await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('mambix.uid', true), '')::uuid $$;
  create role authenticated nologin;
  grant usage on schema public, auth to authenticated;
`);
console.log("\n\x1b[1mMIGRATIONS\x1b[0m");
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
  try { await db.exec(readFileSync(join(DIR, f), "utf8")); if (f >= "0120") ok(f); }
  catch (e) { erro(f, e.message); process.exit(1); }
}
ok("todas as migrations anteriores aplicadas");
await db.exec(`
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
`);
usarBanco(db);

// ------------------------------------------------------------ modulos reais
const imp = await import("@/lib/importacao");
const acoesImp = await import("@/lib/importacao-acoes");
const { dadosDRE, dadosDFC } = await import("@/lib/relatorios");
const { salvarPagamento, salvarReceita, salvarCaixa } = await import("@/lib/acoes");

// ------------------------------------------------------------ cenario
console.log("\n\x1b[1mCENARIO\x1b[0m");
const um = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const novoUsuario = async (email) => (await um(`insert into auth.users (email) values ($1) returning id`, [email])).id;
const uAdmin = await novoUsuario("operador@bpo.com.br");
const uConsulta = await novoUsuario("consulta@bpo.com.br");
const uFora = await novoUsuario("dono@outrobpo.com.br");
const gA = (await um(`insert into gestores (nome) values ('BPO A') returning id`)).id;
const gB = (await um(`insert into gestores (nome) values ('BPO B') returning id`)).id;
await db.query(`update perfis set papel='gestor', gestor_id=$1, funcao='operador' where user_id=$2`, [gA, uAdmin]);
await db.query(`update perfis set papel='gestor', gestor_id=$1, funcao='consulta' where user_id=$2`, [gA, uConsulta]);
await db.query(`update perfis set papel='gestor', gestor_id=$1, funcao='admin' where user_id=$2`, [gB, uFora]);
const cA = (await um(`insert into clientes (gestor_id,nome) values ($1,'Padaria') returning id`, [gA])).id;
const E = (await um(`insert into empresas (nome,cliente_id) values ('Padaria Central',$1) returning id`, [cA])).id;
const matriz = (await um(`select id from lojas where empresa_id=$1 and is_matriz`, [E])).id;
const loja2 = (await um(`insert into lojas (empresa_id,nome) values ($1,'Filial') returning id`, [E])).id;
const itau = (await um(`insert into bancos (empresa_id,nome) values ($1,'Itaú') returning id`, [E])).id;
await db.query(`insert into bancos (empresa_id,nome) values ($1,'Caixa interno')`, [E]);
for (const [ano, mes, m] of [[2026, 6, null], [2026, 7, 0.4], [2026, 8, 0.38], [2026, 9, 0.42]]) {
  await db.query(`insert into parametros_mes (empresa_id,ano,mes,margem_bruta_pct) values ($1,$2,$3,$4)`, [E, ano, mes, m]);
}
ok("empresa com matriz + filial, 2 bancos, margem jul–set (junho sem margem)");

// Movimento que ja existia (lancado pelas telas, como operador)
entrarComo(uAdmin);
const fd = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) f.set(k, String(v)); return f; };
const base = { empresa_id: E, loja_id: matriz };
const pre = [
  await salvarPagamento(fd({ ...base, vencimento: "2026-09-10", cfc: 1, cd: 31, descricao: "Aluguel antigo", comp_mes: 9, comp_ano: 2026, valor: "2000,00", ja_pago: "on", data_pagamento: "2026-09-10" })),
  await salvarPagamento(fd({ ...base, vencimento: "2026-08-10", cfc: 1, cd: 34, descricao: "Luz", comp_mes: 8, comp_ano: 2026, valor: "450,00" })),
  await salvarPagamento(fd({ ...base, loja_id: loja2, vencimento: "2026-09-12", cfc: 2, cd: 87, descricao: "Taxa cartão", comp_mes: 9, comp_ano: 2026, valor: "180,00", ja_pago: "on", data_pagamento: "2026-09-12" })),
  await salvarPagamento(fd({ ...base, vencimento: "2026-09-20", cfc: 1, cd: 70, descricao: "Simples", comp_mes: 9, comp_ano: 2026, valor: "900,00" })),
  await salvarPagamento(fd({ ...base, vencimento: "2026-07-05", cfc: 1, cd: 6, descricao: "Salário", comp_mes: 7, comp_ano: 2026, valor: "3000,00", ja_pago: "on", data_pagamento: "2026-07-05" })),
  await salvarPagamento(fd({ ...base, vencimento: "2026-08-05", cfc: 1, cd: 6, descricao: "Salário", comp_mes: 8, comp_ano: 2026, valor: "3100,00", ja_pago: "on", data_pagamento: "2026-08-05" })),
  await salvarPagamento(fd({ ...base, vencimento: "2026-06-05", cfc: 1, cd: 6, descricao: "Salário", comp_mes: 6, comp_ano: 2026, valor: "2900,00" })),
  await salvarReceita(fd({ ...base, data: "2026-09-05", descricao: "Cielo", valor: "5000,00", tipo_recebimento: 3 })),
  await salvarReceita(fd({ ...base, data: "2026-08-05", descricao: "Cielo", valor: "4000,00", tipo_recebimento: 3 })),
  await salvarCaixa(fd({ ...base, data: "2026-09-01", tipo_venda: 1, valor: "300,00" })),
  await salvarCaixa(fd({ ...base, data: "2026-09-03", tipo_venda: 5, valor: "1500,00" })),
  await salvarCaixa(fd({ ...base, loja_id: loja2, data: "2026-09-03", tipo_venda: 9, valor: "700,00" })),
  await salvarCaixa(fd({ ...base, data: "2026-08-03", tipo_venda: 5, valor: "8000,00" })),
  await salvarCaixa(fd({ ...base, data: "2026-07-03", tipo_venda: 5, valor: "9000,00" })),
  await salvarCaixa(fd({ ...base, data: "2026-06-03", tipo_venda: 5, valor: "7000,00" })),
];
checa("movimento prévio lançado pelas actions das telas", pre.every((r) => r.ok), pre.filter((r) => !r.ok));
checa("salvarPagamento / salvarReceita agora devolvem o id criado", !!pre[0].id && !!pre[7].id);

// ------------------------------------------------------------ fluxo da tela
async function importar(tipo, csv, { lojaId = matriz, bancoPadraoId = null, substituirConflitos = false, marcadas, arquivo = "teste.csv" } = {}) {
  const ref = await acoesImp.carregarReferencias(E);
  const planilha = imp.separarCabecalho(imp.lerCSV(csv));
  const mapa = imp.mapearAutomatico(tipo, planilha.cabecalho);
  let linhas = imp.validarLinhas(tipo, planilha, mapa, ref, { empresaId: E, lojaId, bancoPadraoId });
  const periodo = imp.periodoDasLinhas(linhas);
  const existentes = periodo ? await acoesImp.buscarExistentes(E, tipo, periodo.ini, periodo.fim) : {};
  linhas = imp.marcarDuplicados(tipo, linhas, existentes, lojaId);
  const escolhidas = imp.escolherParaGravar(linhas, { substituirConflitos, marcadas });
  const lote = await acoesImp.criarLote({ empresaId: E, tipo, arquivo, lojaId, linhasArquivo: planilha.linhas.length });
  if (!lote.ok) return { lote, linhas, mapa, resultados: [] };
  const resultados = [];
  for (let i = 0; i < escolhidas.length; i += 25) {
    const pedaco = escolhidas.slice(i, i + 25).map((l) => ({ numero: l.numero, pagamento: l.pagamento, receita: l.receita, caixa: l.caixa }));
    resultados.push(...(await acoesImp.gravarLinhas(lote.id, E, lojaId, tipo, pedaco)));
  }
  const entrou = resultados.filter((r) => r.ok);
  await acoesImp.finalizarLote(lote.id, {
    importadas: entrou.length,
    rejeitadas: linhas.length - entrou.length,
    valor: entrou.reduce((s, r) => s + r.valor, 0),
  });
  return { lote, linhas, mapa, resultados };
}

async function foto() {
  const r = {};
  for (const [a, m] of [[2026, 8], [2026, 9], [2026, 10]]) {
    r[`dre${m}`] = await dadosDRE(E, a, m, null);
    r[`dfc${m}`] = await dadosDFC(E, a, m, null);
  }
  r.dre9m = await dadosDRE(E, 2026, 9, matriz);
  return r;
}

// ------------------------------------------------------------ 1. leitura
console.log("\n\x1b[1m1. LEITURA DE NUMERO, DATA E CSV\x1b[0m");
const casosNum = [["1.234,56", 1234.56], ["R$ 1.234,56", 1234.56], ["1234.56", 1234.56], ["1.234", 1234], ["1,5", 1.5], ["(10,00)", -10], ["-7,25", -7.25], [99.999, 100], ["abc", null], ["1,2,3", null], ["", null]];
for (const [e, s] of casosNum) checa(`lerNumero(${JSON.stringify(e)}) = ${s}`, imp.lerNumero(e) === s, imp.lerNumero(e));
const casosData = [["05/09/2026", "2026-09-05"], ["5/9/26", "2026-09-05"], ["2026-09-05", "2026-09-05"], ["05-09-2026", "2026-09-05"], [new Date(Date.UTC(2026, 8, 5)), "2026-09-05"], ["31/02/2026", null], ["13/13/2026", null], ["ontem", null]];
for (const [e, s] of casosData) checa(`lerData(${e instanceof Date ? "Date" : JSON.stringify(e)}) = ${s}`, imp.lerData(e) === s, imp.lerData(e));
checa("lerCompetencia('10/2026') e ('out/26')", JSON.stringify(imp.lerCompetencia("10/2026")) === '{"mes":10,"ano":2026}' && JSON.stringify(imp.lerCompetencia("out/26")) === '{"mes":10,"ano":2026}');
const csvVirg = imp.lerCSV('Data,Descrição,Valor\r\n01/09/2026,"Loja ""A"", centro","1.000,00"\r\n');
checa("CSV com vírgula, aspas e vírgula dentro do campo", csvVirg[1][1] === 'Loja "A", centro' && csvVirg[1][2] === "1.000,00", csvVirg);
const ansi = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0xe7, 0xe3, 0x6f]); // "Descrição" em Windows-1252
checa("CSV salvo em ANSI (Windows-1252) pelo Excel é lido certo", imp.decodificarTexto(ansi) === "Descrição", imp.decodificarTexto(ansi));
const mapaP = imp.mapearAutomatico("pagamentos", ["Vencimento", "Código", "Descrição", "Valor", "Data de pagamento"]);
checa("mapeamento automático: 'Data de pagamento' não é confundida com vencimento", mapaP.vencimento === 0 && mapaP.data_pagamento === 4 && mapaP.codigo === 1, mapaP);

const { default: lerExcel } = await import("read-excel-file/node");
const abasModelo = await lerExcel(join(AQUI, "..", "..", "..", "public", "modelos", "modelo-importacao-mambix.xlsx"));
checa("planilha modelo: abas Instruções, Pagamentos, Receitas, Caixa Diário", abasModelo.map((a) => a.sheet).join("|") === "Instruções|Pagamentos|Receitas|Caixa Diário", abasModelo.map((a) => a.sheet));
for (const [t, aba] of [["pagamentos", "Pagamentos"], ["receitas", "Receitas"], ["caixa_diario", "Caixa Diário"]]) {
  const m = imp.mapearAutomatico(t, imp.separarCabecalho(abasModelo.find((a) => a.sheet === aba).data).cabecalho);
  checa(`planilha modelo: todas as colunas de ${aba} reconhecidas sozinhas`, imp.CAMPOS[t].every((c) => m[c.chave] >= 0), m);
}

// ------------------------------------------------------------ 2. pagamentos
console.log("\n\x1b[1m2. IMPORTAR PAGAMENTOS\x1b[0m");
const antes = await foto();
const csvPag = [
  "Vencimento;Código;Descrição;Valor;CFC;Competência;Data de pagamento;Banco",
  "05/09/2026;31;Aluguel setembro;2.500,00;;;10/09/2026;Itaú",          // L2 DRE set +2500 / DFC set +2500
  "15/09/2026;85;Embalagens;R$ 1.234,56;;;;",                            // L3 DRE set +1234,56 (aberto, CFC sugerido 2)
  "20/08/2026;40;Cartório de agosto;300,10;1;;02/09/2026;",             // L4 DRE ago +300,10 / DFC set +300,10
  "25/09/2026;95;Forno novo;10000;;;25/09/2026;",                        // L5 investimento: fora da DRE / DFC set +10000
  "05/09/2026;31;Aluguel setembro;2.500,00;;;10/09/2026;Itaú",          // L6 duplicada da L2 -> nao entra
  "31/02/2026;31;Data ruim;10;;;;",                                      // L7 erro
  "10/09/2026;999;Código ruim;10;;;;",                                   // L8 erro
  "10/09/2026;81;Código sem nome;10;;;;",                                // L9 erro (81 esta vazio no padrao)
  "10/09/2026;31;Zerado;0;;;;",                                          // L10 erro
  "10/09/2026;31;Negativo;-5;;;;",                                       // L11 erro
  "10/09/2026;31;Aluguel antigo;2000;;;10/09/2026;",                    // L12 duplicada do banco -> nao entra
  "10/09/2026;31;Competência outubro;100;;10/2026;;",                    // L13 DRE out +100
  "10/09/2026;31;CFC ruim;10;7;;;",                                      // L14 erro
  "10/09/2026;31;Banco ruim;10;;;;Bradesco",                             // L15 erro
  "",
  "11/09/2026;38;Advogado;  1.000  ;;;;",                                // L17 DRE set +1000 (linha vazia antes)
].join("\n");
const rp = await importar("pagamentos", csvPag, { arquivo: "pagamentos-setembro.csv" });
checa("lote criado", rp.lote.ok, rp.lote);
const sit = Object.fromEntries(rp.linhas.map((l) => [l.numero, l.situacao]));
checa("situação linha a linha", JSON.stringify(sit) === JSON.stringify({ 2: "ok", 3: "ok", 4: "ok", 5: "ok", 6: "duplicado", 7: "erro", 8: "erro", 9: "erro", 10: "erro", 11: "erro", 12: "duplicado", 13: "ok", 14: "erro", 15: "erro", 17: "ok" }), sit);
const motivo = (n) => rp.linhas.find((l) => l.numero === n)?.motivos.join(" | ");
checa("motivos legíveis", motivo(7) === "vencimento inválido" && motivo(8).includes("inexistente") && motivo(10) === "valor zerado" && motivo(11) === "valor negativo" && motivo(12).includes("já existe") && motivo(6).includes("linha 2"), [7, 8, 10, 11, 12, 6].map(motivo));
checa("6 linhas gravadas, todas ok", rp.resultados.length === 6 && rp.resultados.every((r) => r.ok), rp.resultados);
const l3 = rp.linhas.find((l) => l.numero === 3).pagamento;
checa("CFC sugerido pelo grupo (85 variável -> 2) quando a coluna vem vazia", l3.cfc === 2 && l3.cfcSugerido);

const depois = await foto();
igual("DRE set: despesas sobem exatamente 2.500 + 1.234,56 + 1.000", depois.dre9.despesas - antes.dre9.despesas, 4734.56);
igual("DRE set: resultado cai exatamente o mesmo valor", antes.dre9.resultado - depois.dre9.resultado, 4734.56);
igual("DRE set: faturamento não muda", depois.dre9.faturamento, antes.dre9.faturamento);
igual("DRE ago: + 300,10 (competência do vencimento, pago em setembro)", depois.dre8.despesas - antes.dre8.despesas, 300.1);
igual("DRE out: + 100 (competência informada na planilha)", depois.dre10.despesas - antes.dre10.despesas, 100);
igual("DFC set: saídas sobem exatamente 2.500 + 300,10 + 10.000 (só o que tem data de pagamento)", depois.dfc9.saidas - antes.dfc9.saidas, 12800.1);
igual("DFC set: investimento 95 aparece no grupo Investimentos", depois.dfc9.grupos.find((g) => g.chave === "INVESTIMENTOS").total - antes.dfc9.grupos.find((g) => g.chave === "INVESTIMENTOS").total, 10000);
igual("DFC ago: não muda (o pagamento foi em setembro)", depois.dfc8.saidas, antes.dfc8.saidas);
igual("DFC set: entradas não mudam", depois.dfc9.entradas, antes.dfc9.entradas);
const pago = await um(`select p.pago, p.banco_id, s.saldo from pagamentos p join pagamentos_saldo s on s.id=p.id where p.descricao='Aluguel setembro'`);
checa("linha com data de pagamento entra PAGA (baixa + trigger sincroniza_pago) e com o banco da planilha", pago.pago === true && Number(pago.saldo) === 0 && pago.banco_id === itau, pago);
const aberto = await um(`select pago from pagamentos where descricao='Embalagens'`);
checa("linha sem data de pagamento entra EM ABERTO", aberto.pago === false);
const lote = await um(`select linhas_arquivo, linhas_importadas, linhas_rejeitadas, valor_importado, (select count(*)::int from importacao_itens where importacao_id=i.id) itens from importacoes i where id=$1`, [rp.lote.id]);
checa("recibo do lote: 15 linhas, 6 importadas, 9 de fora, R$ 15.134,66, 6 itens", lote.linhas_arquivo === 15 && lote.linhas_importadas === 6 && lote.linhas_rejeitadas === 9 && cent(lote.valor_importado) === 1513466 && lote.itens === 6, lote);

console.log("\n\x1b[1m3. DUPLICADA MARCADA À MÃO ENTRA\x1b[0m");
const antesDup = await foto();
const rd = await importar("pagamentos", csvPag.split("\n").slice(0, 2).join("\n"), { marcadas: new Set([2]) });
checa("re-importar a mesma linha: vem como duplicada do banco", rd.linhas[0].situacao === "duplicado");
igual("marcada pelo usuário, entra (DRE set + 2.500)", (await dadosDRE(E, 2026, 9, null)).despesas - antesDup.dre9.despesas, 2500);
const desfDup = await acoesImp.desfazerLote(rd.lote.id);
checa("desfaz esse lote", desfDup.ok && desfDup.desfeitos === 1, desfDup);

// ------------------------------------------------------------ 4. receitas
console.log("\n\x1b[1m4. IMPORTAR RECEITAS\x1b[0m");
const antesR = await foto();
const csvRec = [
  "Data;Tipo de recebimento;Descrição;Valor",
  "02/09/2026;dinheiro;Caixa;1.000,50",
  "03/09/2026;7;Pix cliente;250",
  "04/09/2026;7 - PIX - TED - DEPÓSITO;Pix 2;49,50",
  "05/09/2026;3;Cielo;5000",          // igual a receita do banco -> duplicada
  "06/09/2026;4;Tipo vazio;10",       // tipo 4 sem nome -> erro
].join("\n");
const rr = await importar("receitas", csvRec, { bancoPadraoId: itau });
checa("3 entram, 1 duplicada, 1 erro", rr.resultados.filter((r) => r.ok).length === 3 && rr.linhas[3].situacao === "duplicado" && rr.linhas[4].situacao === "erro", rr.linhas.map((l) => [l.situacao, l.motivos]));
const depoisR = await foto();
igual("DFC set: entradas sobem exatamente 1.000,50 + 250 + 49,50", depoisR.dfc9.entradas - antesR.dfc9.entradas, 1300);
igual("DFC set: saídas não mudam", depoisR.dfc9.saidas, antesR.dfc9.saidas);
igual("DRE set: não muda (receita é caixa, não faturamento)", depoisR.dre9.resultado, antesR.dre9.resultado);
const bancoRec = await um(`select count(*)::int n from receitas where banco_id=$1`, [itau]);
checa("banco padrão da tela aplicado às receitas", bancoRec.n === 3);

// ------------------------------------------------------------ 5. caixa
console.log("\n\x1b[1m5. IMPORTAR CAIXA DIÁRIO\x1b[0m");
const csvCx = [
  "Data;Tipo de venda;Valor",
  "01/09/2026;1;100",      // dia ja tem 300 -> conflito
  "02/09/2026;1;200",
  "02/09/2026;DINHEIRO;50", // mesma chave -> somada (250)
  "02/09/2026;PIX;80",
  "03/09/2026;11;5",        // tipo 11 sem nome -> erro
].join("\n");
const antesC = await foto();
const rc1 = await importar("caixa_diario", csvCx); // padrao: pula conflito
const l2 = rc1.linhas.find((l) => l.numero === 3);
checa("linhas do mesmo dia/tipo somadas numa só (200 + 50)", l2.caixa.valor === 250 && rc1.linhas.length === 4, rc1.linhas.map((l) => [l.numero, l.situacao, l.caixa?.valor]));
checa("dia que já tinha valor vira conflito (mostra o valor atual)", rc1.linhas[0].situacao === "conflito" && rc1.linhas[0].caixa.valorExistente === 300);
const depoisC1 = await foto();
igual("pulando o conflito: faturamento set sobe 250 + 80", depoisC1.dre9.faturamento - antesC.dre9.faturamento, 330);
igual("faturamento por tipo: PIX + 80", depoisC1.dre9.porTipoVenda.find((t) => t.codigo === 9).valor - antesC.dre9.porTipoVenda.find((t) => t.codigo === 9).valor, 80);
igual("DFC set não muda (venda é competência)", depoisC1.dfc9.entradas, antesC.dfc9.entradas);
const des1 = await acoesImp.desfazerLote(rc1.lote.id);
igual("desfazer: faturamento volta exatamente", (await dadosDRE(E, 2026, 9, null)).faturamento, antesC.dre9.faturamento);
checa("desfazer: dias que estavam vazios foram apagados", des1.ok && (await um(`select count(*)::int n from caixa_diario where empresa_id=$1 and data='2026-09-02'`, [E])).n === 0, des1);

const rc2 = await importar("caixa_diario", csvCx, { substituirConflitos: true });
const depoisC2 = await foto();
igual("substituindo: faturamento set = antes − 300 + 100 + 250 + 80", depoisC2.dre9.faturamento - antesC.dre9.faturamento, 130);
igual("DRE da loja matriz reflete a importação (feita na matriz)", depoisC2.dre9m.faturamento - antesC.dre9m.faturamento, 130);
await db.query(`update caixa_diario set valor = 999 where empresa_id=$1 and data='2026-09-02' and tipo_venda=9`, [E]);
const des2 = await acoesImp.desfazerLote(rc2.lote.id);
const v01 = await um(`select valor from caixa_diario where empresa_id=$1 and data='2026-09-01' and tipo_venda=1`, [E]);
checa("desfazer devolve o valor anterior do dia substituído (300)", Number(v01.valor) === 300, v01);
checa("dia mexido depois da importação é mantido e avisado", des2.mantidos.length === 1 && des2.mantidos[0].includes("2026-09-02"), des2);
await db.query(`delete from caixa_diario where empresa_id=$1 and data='2026-09-02' and tipo_venda=9`, [E]);

// ------------------------------------------------------------ 6. desfazer pagamentos/receitas
console.log("\n\x1b[1m6. DESFAZER LOTE\x1b[0m");
const dp = await acoesImp.desfazerLote(rp.lote.id);
const dr = await acoesImp.desfazerLote(rr.lote.id);
checa("lotes desfeitos", dp.ok && dr.ok && dp.desfeitos === 6 && dr.desfeitos === 3, [dp, dr]);
const voltou = await foto();
for (const k of ["dre8", "dre9", "dre10"]) igual(`${k}: resultado volta ao original`, voltou[k].resultado, antes[k].resultado);
for (const k of ["dfc8", "dfc9", "dfc10"]) {
  igual(`${k}: saídas voltam ao original`, voltou[k].saidas, antes[k].saidas);
  igual(`${k}: entradas voltam ao original`, voltou[k].entradas, antes[k].entradas);
}
checa("baixas dos pagamentos importados apagadas junto (cascade)", (await um(`select count(*)::int n from pagamento_baixas b where not exists (select 1 from pagamentos p where p.id=b.pagamento_id)`)).n === 0);
const de2x = await acoesImp.desfazerLote(rp.lote.id);
checa("não desfaz duas vezes", !de2x.ok && de2x.erro.includes("já foi desfeita"));
const marcado = await um(`select desfeita_em is not null d, desfeita_por from importacoes where id=$1`, [rp.lote.id]);
checa("lote fica marcado como desfeito, com quem desfez", marcado.d && marcado.desfeita_por === uAdmin);

// ------------------------------------------------------------ 7. acesso
console.log("\n\x1b[1m7. ACESSO\x1b[0m");
entrarComo(uConsulta);
const rcons = await importar("receitas", csvRec);
checa("usuário 'consulta' não consegue importar", !rcons.lote.ok && rcons.lote.erro.includes("permissão"), rcons.lote);
entrarComo(uFora);
const lotesFora = await (await (await import("@/lib/supabase-server")).supabaseServer()).from("importacoes").select("id");
checa("BPO de fora não enxerga os lotes da empresa", lotesFora.data.length === 0, lotesFora);
const desFora = await acoesImp.desfazerLote(rp.lote.id);
checa("BPO de fora não consegue desfazer", !desFora.ok);
const exFora = await acoesImp.buscarExistentes(E, "pagamentos", "2026-01-01", "2026-12-31");
checa("BPO de fora não vê lançamentos para checar duplicado", exFora.pagamentos.length === 0);
entrarComo(uAdmin);
const itemForjado = await (await (await import("@/lib/supabase-server")).supabaseServer())
  .from("importacao_itens").insert({ importacao_id: rp.lote.id, empresa_id: (await um(`insert into empresas (nome,cliente_id) values ('Outra',$1) returning id`, [cA])).id, tabela: "receitas", registro_id: pre[7].id, valor: 1 });
checa("item não pode apontar para lote de outra empresa (FK composta)", !!itemForjado.error, itemForjado);

globalThis.__combo3 = { db, E, matriz, loja2, uAdmin, checa, igual, cent, ok, erro, foto };
await import("./simulador.parte.mjs");

console.log(falhas ? `\n\x1b[31m\x1b[1m${falhas} TESTE(S) FALHARAM\x1b[0m` : "\n\x1b[32m\x1b[1mTODOS OS TESTES DO COMBO 3 PASSARAM\x1b[0m");
process.exit(falhas ? 1 : 0);
