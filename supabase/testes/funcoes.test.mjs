// Funcoes dentro da carteira do BPO: admin, operador e consulta.
//
// O que nao pode quebrar nunca:
//   1. operador lanca, mas nao cadastra cliente/empresa nem convida
//   2. consulta le e NAO escreve absolutamente nada
//   3. nenhum dos dois enxerga a carteira de outro BPO
//   4. ninguem muda o proprio nivel de acesso
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

const uNeto = await novoUsuario("suporte.dgficel@gmail.com");
await db.exec(`update perfis set papel='plataforma', gestor_id=null, funcao=null where user_id='${uNeto}'`);

const uAdmin    = await novoUsuario("marcelo@mambix.com.br");
const uOperador = await novoUsuario("assistente@mambix.com.br");
const uConsulta = await novoUsuario("estagiario@mambix.com.br");
const uOutroBpo = await novoUsuario("dono@outrobpo.com.br");

const gA = (await db.query(`insert into gestores (nome) values ('Mambix') returning id`)).rows[0].id;
const gB = (await db.query(`insert into gestores (nome) values ('Outro BPO') returning id`)).rows[0].id;

for (const [u, g, f] of [[uAdmin, gA, "admin"], [uOperador, gA, "operador"], [uConsulta, gA, "consulta"], [uOutroBpo, gB, "admin"]]) {
  await db.exec(`update perfis set papel='gestor', gestor_id='${g}', funcao='${f}' where user_id='${u}'`);
}

const cA = (await db.query(`insert into clientes (gestor_id,nome) values ('${gA}','Padaria do Joao') returning id`)).rows[0].id;
const cB = (await db.query(`insert into clientes (gestor_id,nome) values ('${gB}','Cliente do outro') returning id`)).rows[0].id;
const eA = (await db.query(`insert into empresas (nome,cliente_id) values ('Padaria Central','${cA}') returning id`)).rows[0].id;
const eB = (await db.query(`insert into empresas (nome,cliente_id) values ('Loja do outro','${cB}') returning id`)).rows[0].id;
ok("1 BPO com admin, operador e consulta; outro BPO ao lado");

async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('mambix.uid', $1, false)`, [uid]);
  try { return await db.query(sql, params); }
  finally {
    // Limpa o uid tambem: sem isso, um db.exec direto depois desta chamada
    // continuaria rodando "como" o ultimo usuario, e os triggers de protecao
    // reagiriam a uma operacao que era para ser administrativa.
    await db.query(`select set_config('mambix.uid', '', false)`);
    await db.exec(`reset role`);
  }
}
const tenta = async (uid, sql) => {
  try { const r = await como(uid, sql); return r.affectedRows === 0 ? "nenhuma linha afetada" : null; }
  catch (e) { return e.message; }
};
const lancar = (uid, dia) =>
  tenta(uid, `insert into pagamentos (empresa_id,vencimento,cfc,cd,comp_mes,comp_ano,valor)
              values ('${eA}','2026-08-${dia}',1,31,8,2026,100)`);

// -------------------------------------------------- operador
console.log("\n\x1b[1mFASE 1 - o operador\x1b[0m");
checa("Operador LANCA pagamento", (await lancar(uOperador, "10")) === null);
const pagId = (await db.query(`select id from pagamentos limit 1`)).rows[0].id;
const erroBaixa = await tenta(uOperador, `insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor)
                           values ('${eA}','${pagId}','2026-08-12',100)`);
checa("Operador DA BAIXA", erroBaixa === null, erroBaixa);
checa("Operador EDITA lancamento",
  (await tenta(uOperador, `update pagamentos set valor = 120 where id = '${pagId}'`)) === null);
checa("Operador ve os relatorios",
  (await como(uOperador, `select count(*)::int n from pagamentos`)).rows[0].n === 1);

checa("Operador NAO cadastra cliente",
  (await tenta(uOperador, `insert into clientes (gestor_id,nome) values ('${gA}','Novo')`)) !== null);
checa("Operador NAO cria empresa",
  (await tenta(uOperador, `insert into empresas (nome,cliente_id) values ('Nova','${cA}')`)) !== null);
checa("Operador NAO convida ninguem",
  (await tenta(uOperador, `insert into convites (token,email,papel,funcao,gestor_id)
                           values ('t1','x@x.com','gestor','operador','${gA}')`)) !== null);
checa("Operador NAO mexe na marca do BPO",
  (await tenta(uOperador, `insert into marcas (gestor_id, nome_exibido) values ('${gA}','Sequestrada')`)) !== null);
checa("Operador NAO renomeia a empresa",
  (await tenta(uOperador, `update empresas set nome='Renomeada' where id='${eA}'`)) !== null);

// -------------------------------------------------- consulta
console.log("\n\x1b[1mFASE 2 - so consulta\x1b[0m");
checa("Consulta LE os lancamentos",
  (await como(uConsulta, `select count(*)::int n from pagamentos`)).rows[0].n === 1);
checa("Consulta NAO lanca", (await lancar(uConsulta, "11")) !== null);
checa("Consulta NAO edita lancamento",
  (await tenta(uConsulta, `update pagamentos set valor = 999 where id = '${pagId}'`)) !== null);
checa("Consulta NAO apaga lancamento",
  (await tenta(uConsulta, `delete from pagamentos where id = '${pagId}'`)) !== null);
checa("Consulta NAO da baixa",
  (await tenta(uConsulta, `insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor)
                           values ('${eA}','${pagId}','2026-08-13',10)`)) !== null);
checa("Consulta NAO edita codigo da empresa",
  (await tenta(uConsulta, `update codigos_despesa set nome='X' where empresa_id='${eA}' and codigo=31`)) !== null);
checa("Consulta NAO cadastra nada",
  (await tenta(uConsulta, `insert into empresas (nome,cliente_id) values ('Nova','${cA}')`)) !== null);

// -------------------------------------------------- admin
console.log("\n\x1b[1mFASE 3 - o admin do BPO\x1b[0m");
checa("Admin cadastra cliente",
  (await tenta(uAdmin, `insert into clientes (gestor_id,nome) values ('${gA}','Cliente 2')`)) === null);
checa("Admin cria empresa",
  (await tenta(uAdmin, `insert into empresas (nome,cliente_id) values ('Empresa 2','${cA}')`)) === null);
checa("Admin convida",
  (await tenta(uAdmin, `insert into convites (token,email,papel,funcao,gestor_id)
                        values ('t2','novo@mambix.com.br','gestor','operador','${gA}')`)) === null);
checa("Admin mexe na marca do proprio BPO",
  (await tenta(uAdmin, `insert into marcas (gestor_id, nome_exibido) values ('${gA}','Mambix')`)) === null);
checa("Admin lanca tambem", (await lancar(uAdmin, "14")) === null);

// -------------------------------------------------- isolamento
console.log("\n\x1b[1mFASE 4 - a carteira do outro BPO\x1b[0m");
checa("Operador nao ve empresa de outro BPO",
  !(await como(uOperador, `select id from empresas`)).rows.some((r) => r.id === eB));
checa("Consulta nao ve empresa de outro BPO",
  !(await como(uConsulta, `select id from empresas`)).rows.some((r) => r.id === eB));
checa("Operador nao lanca na empresa de outro BPO",
  (await tenta(uOperador, `insert into pagamentos (empresa_id,vencimento,cfc,cd,comp_mes,comp_ano,valor)
                           values ('${eB}','2026-08-10',1,31,8,2026,100)`)) !== null);
checa("Admin de um BPO nao ve o outro BPO",
  (await como(uAdmin, `select id from gestores`)).rows.length === 1);

// -------------------------------------------------- promocao
console.log("\n\x1b[1mFASE 5 - quem promove quem\x1b[0m");
checa("Operador NAO se promove a admin",
  (await tenta(uOperador, `update perfis set funcao='admin' where user_id='${uOperador}'`)) !== null);
let r = await db.query(`select funcao from perfis where user_id='${uOperador}'`);
checa("E continua operador", r.rows[0].funcao === "operador", `virou ${r.rows[0].funcao}`);

checa("Operador NAO rebaixa o proprio admin",
  (await tenta(uOperador, `update perfis set funcao='consulta' where user_id='${uAdmin}'`)) !== null ||
  (await db.query(`select funcao from perfis where user_id='${uAdmin}'`)).rows[0].funcao === "admin");

await como(uAdmin, `update perfis set funcao='consulta' where user_id='${uOperador}'`);
r = await db.query(`select funcao from perfis where user_id='${uOperador}'`);
checa("Mas o ADMIN rebaixa o operador", r.rows[0].funcao === "consulta", `ficou ${r.rows[0].funcao}`);
await db.exec(`update perfis set funcao='operador' where user_id='${uOperador}'`);

checa("Admin NAO move funcionario para outra carteira",
  (await tenta(uAdmin, `update perfis set gestor_id='${gB}' where user_id='${uOperador}'`)) !== null);
checa("Admin de um BPO nao mexe em quem e do outro",
  (await tenta(uOutroBpo, `update perfis set funcao='consulta' where user_id='${uOperador}'`)) !== null ||
  (await db.query(`select funcao from perfis where user_id='${uOperador}'`)).rows[0].funcao === "operador");

console.log("");
if (falhas === 0) console.log("\x1b[32m\x1b[1mTODOS OS TESTES DE FUNCAO PASSARAM\x1b[0m");
else { console.log(`\x1b[31m\x1b[1m${falhas} TESTE(S) FALHARAM\x1b[0m`); process.exit(1); }
