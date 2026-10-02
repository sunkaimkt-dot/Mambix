// MAMBIX COMO BPO UNICO (migration 0121)
//
// O que nao pode quebrar:
//   1. Existe uma carteira principal (Mambix) e cliente novo cai nela sozinho.
//   2. Empresa nova nasce com bancos padrao e tipo de recebimento 4 nomeado.
//   3. Cliente final LANCA nas proprias empresas (e so nelas).
//   4. Marca unica: admins da Mambix editam; operador e cliente nao.
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
const novoUsuario = async (email) =>
  (await db.query(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id;

async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('mambix.uid', $1, false)`, [uid]);
  try { return await db.query(sql, params); }
  finally {
    await db.query(`select set_config('mambix.uid', '', false)`);
    await db.exec(`reset role`);
  }
}
const tenta = async (uid, sql) => {
  try { const r = await como(uid, sql); return r.affectedRows === 0 ? "nenhuma linha afetada" : null; }
  catch (e) { return e.message; }
};

console.log("\n\x1b[1mCARTEIRA DA MAMBIX\x1b[0m");
const principais = (await db.query(`select id, nome from gestores where principal`)).rows;
checa("Existe exatamente uma carteira principal", principais.length === 1);
checa("Ela se chama Mambix", principais[0]?.nome === "Mambix", principais[0]?.nome);
const gM = principais[0].id;
checa("gestor_principal() devolve ela", (await db.query(`select gestor_principal() g`)).rows[0].g === gM);

const uDono = await novoUsuario("dono@mambix.com.br");
await db.exec(`update perfis set papel='plataforma', gestor_id=null, funcao=null where user_id='${uDono}'`);
const uAdmin = await novoUsuario("admin@mambix.com.br");
const uOper = await novoUsuario("operador@mambix.com.br");
for (const [u, f] of [[uAdmin, "admin"], [uOper, "operador"]]) {
  await db.exec(`update perfis set papel='gestor', gestor_id='${gM}', funcao='${f}' where user_id='${u}'`);
}

console.log("\n\x1b[1mCLIENTE NOVO\x1b[0m");
const cDono = (await como(uDono, `insert into clientes (nome) values ('Padaria do Dono') returning gestor_id`)).rows[0];
checa("Dono cria cliente sem dizer a carteira -> cai na Mambix", cDono.gestor_id === gM);
const cAdm = (await como(uAdmin, `insert into clientes (nome) values ('Mercadinho') returning id, gestor_id`)).rows[0];
checa("Admin da equipe cria cliente na Mambix", cAdm.gestor_id === gM);
checa("Operador NAO cria cliente", (await tenta(uOper, `insert into clientes (nome) values ('X')`)) !== null);

// Sem "returning": a policy de leitura de empresas consulta a propria tabela e
// nao enxerga a linha que esta nascendo no mesmo comando (o app faz igual).
await como(uAdmin, `insert into empresas (nome, cliente_id) values ('Mercadinho LTDA','${cAdm.id}')`);
const eNova = (await db.query(`select id from empresas where nome='Mercadinho LTDA'`)).rows[0].id;
const bancos = (await db.query(`select nome from bancos where empresa_id='${eNova}' and ativo order by nome`)).rows.map((r) => r.nome);
checa("Empresa nova nasce com 11 bancos padrão", bancos.length === 11, bancos.join(", "));
checa("Inclui CAIXA DA EMPRESA e NUBANK", bancos.includes("CAIXA DA EMPRESA") && bancos.includes("NUBANK"));
const t4 = (await db.query(`select nome from tipos_recebimento where empresa_id='${eNova}' and codigo=4`)).rows[0].nome;
checa("Tipo de recebimento 4 vem nomeado", t4 === "VALE ALIMENTAÇÃO / REFEIÇÃO", t4);
const codigos = (await db.query(`select count(*)::int n from codigos_despesa where empresa_id='${eNova}'`)).rows[0].n;
checa("Seed dos 100 códigos continua funcionando", codigos === 100);
const demo = (await db.query(`select count(*)::int n from bancos b join empresas e on e.id=b.empresa_id where e.nome='Empresa Demonstração'`)).rows[0].n;
checa("Empresa que já tinha bancos não ganhou duplicados", demo === 6, String(demo));

console.log("\n\x1b[1mCLIENTE FINAL LANCA\x1b[0m");
const uCli = await novoUsuario("dono@mercadinho.com.br");
await db.exec(`update perfis set papel='empresario' where user_id='${uCli}';
               insert into cliente_usuarios (cliente_id, user_id) values ('${cAdm.id}','${uCli}')`);
const banco = (await db.query(`select id from bancos where empresa_id='${eNova}' limit 1`)).rows[0].id;
const loja = (await db.query(`select id from lojas where empresa_id='${eNova}' limit 1`)).rows[0].id;
checa("Cliente lança pagamento",
  (await tenta(uCli, `insert into pagamentos (empresa_id,loja_id,vencimento,cfc,cd,comp_mes,comp_ano,valor,banco_id)
                      values ('${eNova}','${loja}','2026-09-10',1,31,9,2026,1500,'${banco}')`)) === null);
const pag = (await db.query(`select id from pagamentos where empresa_id='${eNova}' limit 1`)).rows[0].id;
checa("Cliente dá baixa",
  (await tenta(uCli, `insert into pagamento_baixas (empresa_id,pagamento_id,data_pagamento,valor,banco_id)
                      values ('${eNova}','${pag}','2026-09-10',1500,'${banco}')`)) === null);
checa("Cliente lança receita",
  (await tenta(uCli, `insert into receitas (empresa_id,loja_id,data,valor,banco_id,tipo_recebimento)
                      values ('${eNova}','${loja}','2026-09-11',800,'${banco}',7)`)) === null);
checa("Cliente lança caixa diário",
  (await tenta(uCli, `insert into caixa_diario (empresa_id,loja_id,data,tipo_venda,valor)
                      values ('${eNova}','${loja}','2026-09-11',2,500)`)) === null);
checa("Cliente informa saldo inicial",
  (await tenta(uCli, `insert into parametros_mes (empresa_id,ano,mes,saldo_inicial)
                      values ('${eNova}',2026,9,'{"${banco}": 1000}')`)) === null);
checa("Cliente cadastra banco",
  (await tenta(uCli, `insert into bancos (empresa_id,nome) values ('${eNova}','BANCO NOVO')`)) === null);
checa("Cliente NÃO lança em empresa de outro cliente",
  (await tenta(uCli, `insert into receitas (empresa_id,data,valor,tipo_recebimento)
                      select e.id,'2026-09-11',1,7 from empresas e where e.nome='Empresa Demonstração'`)) !== null);
checa("Cliente NÃO cria cliente", (await tenta(uCli, `insert into clientes (nome) values ('Y')`)) !== null);
checa("Cliente NÃO convida", (await tenta(uCli, `insert into convites (token,email,papel,cliente_id)
                      values ('tt','a@a.com','empresario','${cAdm.id}')`)) !== null);

console.log("\n\x1b[1mMARCA UNICA\x1b[0m");
const m = (await db.query(`select * from marca_mambix()`)).rows[0];
checa("marca_mambix() devolve MAMBIX", m?.nome_exibido === "MAMBIX", m?.nome_exibido);
checa("Cor principal verde da Mambix", m?.cor_primaria === "#047857", m?.cor_primaria);
const sobeMarca = (uid, nome) => tenta(uid, `update marcas set nome_exibido='${nome}'
  where gestor_id is null and cliente_id is null and empresa_id is null`);
checa("Admin da equipe edita a marca", (await sobeMarca(uAdmin, "MAMBIX")) === null);
checa("Operador NÃO edita a marca", (await sobeMarca(uOper, "HACK")) !== null);
checa("Cliente NÃO edita a marca", (await sobeMarca(uCli, "HACK")) !== null);
checa("Logo da Mambix: admin pode, operador não",
  (await como(uAdmin, `select pode_gravar_logo('plataforma/x/logo.png') p`)).rows[0].p === true &&
  (await como(uOper, `select pode_gravar_logo('plataforma/x/logo.png') p`)).rows[0].p === false);

console.log("\n\x1b[1mTOUR GUIADO\x1b[0m");
checa("Marca o próprio tour como visto",
  (await tenta(uCli, `insert into tours_vistos (user_id, tela) values ('${uCli}','dashboard')`)) === null);
checa("NÃO marca tour no lugar de outra pessoa",
  (await tenta(uCli, `insert into tours_vistos (user_id, tela) values ('${uAdmin}','dashboard')`)) !== null);
await como(uAdmin, `insert into tours_vistos (user_id, tela) values ('${uAdmin}','pagamentos')`);
const vistosCli = (await como(uCli, `select tela from tours_vistos`)).rows.map((r) => r.tela);
checa("Cada um só enxerga os próprios tours", vistosCli.length === 1 && vistosCli[0] === "dashboard", vistosCli.join(","));
checa("Tela com nome inválido é recusada",
  (await tenta(uCli, `insert into tours_vistos (user_id, tela) values ('${uCli}','<script>')`)) !== null);

if (falhas) { console.log(`\n\x1b[31m${falhas} FALHA(S)\x1b[0m`); process.exit(1); }
console.log("\n\x1b[32m\x1b[1mTODOS OS TESTES DA MAMBIX PASSARAM\x1b[0m");
