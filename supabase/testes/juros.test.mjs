// TESTE DA BAIXA COM JURO AUTOMATICO (migration 0014)
//
// O que nao pode quebrar nunca:
//   1. baixa normal (valor <= saldo) continua funcionando sem gerar nada extra
//   2. valor MAIOR que o saldo, sem informar cd_juros, e recusado
//   3. valor MAIOR que o saldo, com cd_juros, quita a conta original e cria um
//      segundo lancamento so do juro, ja pago, na competencia do PAGAMENTO
//      (nao da conta original) -- e o juro tem que ir tanto pra DRE (comp_mes)
//      quanto pro DFC (baixa)
//   4. quem nao tem acesso a empresa nao consegue chamar a funcao
//
// Rodar:  npm run testar:banco
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.MIGRATIONS_DIR || join(AQUI, "..", "migrations");
const db = await PGlite.create();

let falhas = 0;
const ok = (t) => console.log(`  \x1b[32mOK\x1b[0m  ${t}`);
const erro = (t, d) => { falhas++; console.log(`  \x1b[31mFALHOU\x1b[0m  ${t}${d ? `\n        ${d}` : ""}`); };
const checa = (t, cond, d) => (cond ? ok(t) : erro(t, d));

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
  try { await db.exec(readFileSync(join(DIR, f), "utf8")); ok(f); }
  catch (e) { erro(f, e.message); console.log("\n\x1b[31mMigration quebrou. Interrompendo.\x1b[0m"); process.exit(1); }
}
await db.exec(`
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
`);

console.log("\n\x1b[1mCENARIO\x1b[0m");
const novoUsuario = async (email) =>
  (await db.query(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id;

const uAdmin = await novoUsuario("marcelo@mambix.com.br");
const uOutroBpo = await novoUsuario("dono@outrobpo.com.br");

const gA = (await db.query(`insert into gestores (nome) values ('Mambix') returning id`)).rows[0].id;
const gB = (await db.query(`insert into gestores (nome) values ('Outro BPO') returning id`)).rows[0].id;
await db.exec(`update perfis set papel='gestor', gestor_id='${gA}', funcao='admin' where user_id='${uAdmin}'`);
await db.exec(`update perfis set papel='gestor', gestor_id='${gB}', funcao='admin' where user_id='${uOutroBpo}'`);

const cA = (await db.query(`insert into clientes (gestor_id,nome) values ('${gA}','Padaria do Joao') returning id`)).rows[0].id;
const eA = (await db.query(`insert into empresas (nome,cliente_id) values ('Padaria Central','${cA}') returning id`)).rows[0].id;
ok("1 BPO com admin, empresa Padaria Central; outro BPO ao lado");

async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('mambix.uid', $1, false)`, [uid]);
  try { return await db.query(sql, params); }
  finally {
    await db.query(`select set_config('mambix.uid', '', false)`);
    await db.exec(`reset role`);
  }
}
const tenta = async (uid, sql, params = []) => {
  try { await como(uid, sql, params); return null; }
  catch (e) { return e.message; }
};

// -------------------------------------------------- conta base
console.log("\n\x1b[1mFASE 1 - conta de 1.000, vencida em julho, competencia julho\x1b[0m");
const pagId = (await db.query(
  `insert into pagamentos (empresa_id,vencimento,cfc,cd,descricao,comp_mes,comp_ano,valor)
   values ('${eA}','2026-07-10',1,31,'Aluguel',7,2026,1000) returning id`
)).rows[0].id;
ok("Conta lançada: R$ 1.000, competência 07/2026");

// -------------------------------------------------- baixa normal, sem juro
console.log("\n\x1b[1mFASE 2 - baixa normal (paga exatamente o saldo)\x1b[0m");
const erroNormal = await tenta(uAdmin,
  `select registrar_baixa_com_juros($1,'2026-07-10'::date,1000::numeric,null::uuid,null::smallint,null::smallint)`, [pagId]);
checa("Baixa de R$ 1.000 aceita sem código de juro", erroNormal === null, erroNormal);

const saldoDepois = (await db.query(`select saldo, pago from pagamentos_saldo where id = $1`, [pagId])).rows[0];
checa("Conta quitada (saldo zero)", Number(saldoDepois.saldo) === 0 && saldoDepois.pago === true);

const totalPagamentos1 = (await db.query(`select count(*)::int n from pagamentos where empresa_id = $1`, [eA])).rows[0].n;
checa("Nenhum lançamento extra criado (não houve juro)", totalPagamentos1 === 1, `havia ${totalPagamentos1}`);

// -------------------------------------------------- segunda conta, com atraso e juro
console.log("\n\x1b[1mFASE 3 - conta de 500 vencida em julho, paga em agosto com juro\x1b[0m");
const pagId2 = (await db.query(
  `insert into pagamentos (empresa_id,vencimento,cfc,cd,descricao,comp_mes,comp_ano,valor)
   values ('${eA}','2026-07-15',1,38,'Advogado',7,2026,500) returning id`
)).rows[0].id;

const erroSemCodigo = await tenta(uAdmin,
  `select registrar_baixa_com_juros($1,'2026-08-05'::date,520::numeric,null::uuid,null::smallint,null::smallint)`, [pagId2]);
checa("Pagar 520 numa conta de 500 SEM código de juro é recusado", erroSemCodigo !== null, erroSemCodigo);

const semJurosAindaAberta = (await db.query(`select pago from pagamentos_saldo where id = $1`, [pagId2])).rows[0].pago;
checa("Conta continua em aberto depois da tentativa recusada", semJurosAindaAberta === false);

const erroComCodigo = await tenta(uAdmin,
  `select registrar_baixa_com_juros($1,'2026-08-05'::date,520::numeric,null::uuid,null::smallint,72::smallint)`, [pagId2]);
checa("Pagar 520 numa conta de 500 COM código de juro (72) é aceito", erroComCodigo === null, erroComCodigo);

const contaOriginal = (await db.query(`select saldo, pago, valor, comp_mes, comp_ano from pagamentos_saldo where id = $1`, [pagId2])).rows[0];
checa("Conta original quitada pelo valor NOMINAL (500), sem mudar", Number(contaOriginal.valor) === 500 && Number(contaOriginal.saldo) === 0);
checa("Competência da conta original continua julho (não muda por causa do juro)",
  Number(contaOriginal.comp_mes) === 7 && Number(contaOriginal.comp_ano) === 2026);

const jurosLancamento = (await db.query(
  `select cd, valor, comp_mes, comp_ano, vencimento, gerado_por_juros_de, cfc
   from pagamentos where gerado_por_juros_de = $1`, [pagId2]
)).rows[0];
checa("Lançamento de juro foi criado", !!jurosLancamento);
checa("Juro = 20,00 (520 pago - 500 nominal)", Number(jurosLancamento.valor) === 20);
checa("Juro usa o código escolhido (72)", Number(jurosLancamento.cd) === 72);
checa("Juro herda o CFC da conta original (1 = fixa)", Number(jurosLancamento.cfc) === 1);
checa("Competência do juro é AGOSTO (mês do pagamento, não da conta original)",
  Number(jurosLancamento.comp_mes) === 8 && Number(jurosLancamento.comp_ano) === 2026);
checa("Vencimento do juro é a data do pagamento", new Date(jurosLancamento.vencimento).toISOString().slice(0,10) === "2026-08-05");

const jurosPago = (await db.query(`select pago, saldo from pagamentos_saldo where gerado_por_juros_de = $1`, [pagId2])).rows[0];
checa("Lançamento de juro já nasce PAGO (a baixa dele foi criada junto)", jurosPago.pago === true && Number(jurosPago.saldo) === 0);

const baixasDoJuro = (await db.query(
  `select b.data_pagamento, b.valor from pagamento_baixas b join pagamentos p on p.id = b.pagamento_id
   where p.gerado_por_juros_de = $1`, [pagId2]
)).rows[0];
checa("A baixa do juro caiu em 05/08 (alimenta o DFC de agosto)", new Date(baixasDoJuro.data_pagamento).toISOString().slice(0,10) === "2026-08-05");
checa("Valor da baixa do juro bate com os 20,00", Number(baixasDoJuro.valor) === 20);

// -------------------------------------------------- RLS
console.log("\n\x1b[1mFASE 4 - acesso\x1b[0m");
const pagId3 = (await db.query(
  `insert into pagamentos (empresa_id,vencimento,cfc,cd,comp_mes,comp_ano,valor)
   values ('${eA}','2026-07-20',1,31,7,2026,300) returning id`
)).rows[0].id;
const erroOutroBpo = await tenta(uOutroBpo,
  `select registrar_baixa_com_juros($1,'2026-08-05'::date,350::numeric,null::uuid,null::smallint,72::smallint)`, [pagId3]);
checa("BPO de fora não consegue dar baixa (nem com juro) numa empresa que não é dele", erroOutroBpo !== null, erroOutroBpo);

console.log(falhas === 0 ? "\n\x1b[32m\x1b[1mTODOS OS TESTES DE JURO PASSARAM\x1b[0m\n" : `\n\x1b[31m\x1b[1m${falhas} TESTE(S) FALHOU(ARAM)\x1b[0m\n`);
process.exit(falhas === 0 ? 0 : 1);
