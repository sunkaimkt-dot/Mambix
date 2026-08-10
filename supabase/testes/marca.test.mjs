// Marca por nivel da hierarquia (white-label).
//
// O que nao pode quebrar nunca:
//   1. a heranca desce CAMPO A CAMPO -- empresa troca so a logo e mantem a cor
//   2. a marca de uma carteira nao vaza para outra
//   3. ninguem escreve num nivel que nao e dele -- inclusive o da plataforma
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

// -------------------------------------------------- stubs do Supabase
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

// -------------------------------------------------- cenario
console.log("\n\x1b[1mCENARIO\x1b[0m");
const novoUsuario = async (email) =>
  (await db.query(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id;

const uNeto = await novoUsuario("suporte.dgficel@gmail.com");
await db.exec(`update perfis set papel='plataforma', gestor_id=null where user_id='${uNeto}'`);

const uGestorA = await novoUsuario("marcelo@mambix.com.br");
const uGestorB = await novoUsuario("gestor.b@teste.com");
const uClienteA = await novoUsuario("dono@padaria.com");

const gA = (await db.query(`insert into gestores (nome) values ('Mambix Assessoria') returning id`)).rows[0].id;
const gB = (await db.query(`insert into gestores (nome) values ('Concorrente') returning id`)).rows[0].id;
await db.exec(`update perfis set papel='gestor', gestor_id='${gA}' where user_id='${uGestorA}'`);
await db.exec(`update perfis set papel='gestor', gestor_id='${gB}' where user_id='${uGestorB}'`);

const cA = (await db.query(`insert into clientes (gestor_id,nome) values ('${gA}','Joao Silva') returning id`)).rows[0].id;
const cB = (await db.query(`insert into clientes (gestor_id,nome) values ('${gB}','Cliente do B') returning id`)).rows[0].id;

const eA = (await db.query(`insert into empresas (nome,cliente_id) values ('Padaria Central','${cA}') returning id`)).rows[0].id;
const eA2 = (await db.query(`insert into empresas (nome,cliente_id) values ('Cafe do Joao','${cA}') returning id`)).rows[0].id;
const eB = (await db.query(`insert into empresas (nome,cliente_id) values ('Loja do B','${cB}') returning id`)).rows[0].id;

await db.exec(`insert into cliente_usuarios (cliente_id,user_id) values ('${cA}','${uClienteA}')`);
await db.exec(`update perfis set papel='empresario' where user_id='${uClienteA}'`);
ok("2 gestores, 2 clientes, 3 empresas");

async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('mambix.uid', $1, false)`, [uid]);
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role`); }
}
const tenta = async (uid, sql) => {
  try { await como(uid, sql); return null; } catch (e) { return e.message; }
};
const marca = async (uid, empresa) =>
  (await como(uid, `select * from marca_efetiva(${empresa ? `'${empresa}'` : "null"})`)).rows[0];

// -------------------------------------------------- 1. so a plataforma
console.log("\n\x1b[1mFASE 1 - sem customizacao nenhuma\x1b[0m");
let m = await marca(uGestorA, eA);
checa("Cai na marca da plataforma", m.nome_exibido === "MAMBIX", `veio "${m.nome_exibido}"`);
checa("E na cor da plataforma", m.cor_primaria === "#047857", `veio ${m.cor_primaria}`);

m = await marca(uClienteA, null);
checa("Sem empresa aberta tambem funciona", m.nome_exibido === "MAMBIX");

// -------------------------------------------------- 2. heranca campo a campo
console.log("\n\x1b[1mFASE 2 - heranca campo a campo\x1b[0m");
await como(uGestorA, `insert into marcas (gestor_id, nome_exibido, tagline, cor_primaria, logo_url)
  values ('${gA}','Mambix','BPO & Gestão Financeira','#1F205A','gestor/${gA}/logo.png')`);

m = await marca(uGestorA, eA);
checa("Nome vem do gestor", m.nome_exibido === "Mambix", `veio "${m.nome_exibido}"`);
checa("Cor primaria vem do gestor", m.cor_primaria === "#1F205A", `veio ${m.cor_primaria}`);
checa("Cor que o gestor NAO definiu continua da plataforma",
  m.cor_negativo === "#DC2626", `veio ${m.cor_negativo}`);

await como(uGestorA, `insert into marcas (cliente_id, nome_exibido) values ('${cA}','Grupo Silva')`);
m = await marca(uGestorA, eA);
checa("Cliente sobrescreve o nome do gestor", m.nome_exibido === "Grupo Silva", `veio "${m.nome_exibido}"`);
checa("Mas a cor continua descendo do gestor", m.cor_primaria === "#1F205A", `veio ${m.cor_primaria}`);
checa("E a logo tambem", m.logo_url === `gestor/${gA}/logo.png`, `veio ${m.logo_url}`);

await como(uGestorA, `insert into marcas (empresa_id, logo_url, cor_primaria)
  values ('${eA}','empresa/${eA}/logo.png','#B91C1C')`);
m = await marca(uGestorA, eA);
checa("Empresa sobrescreve logo e cor", m.logo_url === `empresa/${eA}/logo.png` && m.cor_primaria === "#B91C1C",
  `veio ${m.logo_url} / ${m.cor_primaria}`);
checa("E o nome continua vindo do cliente", m.nome_exibido === "Grupo Silva", `veio "${m.nome_exibido}"`);

m = await marca(uGestorA, eA2);
checa("A empresa irma nao foi afetada", m.cor_primaria === "#1F205A" && m.logo_url === `gestor/${gA}/logo.png`,
  `veio ${m.cor_primaria} / ${m.logo_url}`);

m = await marca(uClienteA, eA);
checa("O empresario ve a mesma marca que o gestor ve",
  m.nome_exibido === "Grupo Silva" && m.cor_primaria === "#B91C1C");

// -------------------------------------------------- 3. isolamento
console.log("\n\x1b[1mFASE 3 - isolamento entre carteiras\x1b[0m");
let r = await como(uGestorB, `select id from marcas where gestor_id='${gA}'`);
checa("Gestor B nao le a linha de marca do Gestor A", r.rows.length === 0, `viu ${r.rows.length}`);

r = await como(uGestorB, `select id from marcas where cliente_id='${cA}' or empresa_id='${eA}'`);
checa("Nem a do cliente ou da empresa do A", r.rows.length === 0, `viu ${r.rows.length}`);

m = await marca(uGestorB, eA);
checa("Chamar marca_efetiva com empresa alheia NAO devolve a marca do A",
  m.nome_exibido === "MAMBIX" && m.cor_primaria === "#047857",
  `vazou "${m.nome_exibido}" / ${m.cor_primaria}`);

r = await como(uGestorB, `select id from marcas`);
checa("Gestor B so enxerga a linha da plataforma", r.rows.length === 1, `viu ${r.rows.length}`);

// -------------------------------------------------- 4. escrita
console.log("\n\x1b[1mFASE 4 - quem pode escrever\x1b[0m");
checa("Gestor A NAO cria marca para o gestor B",
  (await tenta(uGestorA, `insert into marcas (gestor_id, nome_exibido) values ('${gB}','invadido')`)) !== null,
  "insercao passou");

await tenta(uGestorA, `update marcas set nome_exibido='invadido'
  where gestor_id is null and cliente_id is null and empresa_id is null`);
r = await db.query(`select nome_exibido from marcas where escopo='plataforma'`);
checa("Gestor A NAO reescreve a marca da plataforma", r.rows[0].nome_exibido === "MAMBIX",
  `virou "${r.rows[0].nome_exibido}"`);

checa("Gestor A NAO move a propria marca para a carteira do B",
  (await tenta(uGestorA, `update marcas set gestor_id='${gB}' where gestor_id='${gA}'`)) !== null,
  "update passou");

checa("Empresario NAO edita a marca do gestor dele",
  (await tenta(uClienteA, `update marcas set nome_exibido='hackeado' where gestor_id='${gA}'`)) === null &&
  (await db.query(`select nome_exibido from marcas where gestor_id='${gA}'`)).rows[0].nome_exibido === "Mambix",
  "empresario alterou a marca do gestor");

await como(uClienteA, `update marcas set tagline='Padaria desde 1990' where cliente_id='${cA}'`);
r = await db.query(`select tagline from marcas where cliente_id='${cA}'`);
checa("Mas o empresario EDITA a marca do proprio cliente",
  r.rows[0].tagline === "Padaria desde 1990", `veio "${r.rows[0].tagline}"`);

checa("Plataforma escreve em qualquer nivel",
  (await tenta(uNeto, `update marcas set tagline='ok' where gestor_id='${gA}'`)) === null);

// -------------------------------------------------- 5. validacao e limpeza
console.log("\n\x1b[1mFASE 5 - integridade\x1b[0m");
checa("Banco recusa cor fora do formato #RRGGBB",
  (await tenta(uNeto, `insert into marcas (empresa_id, cor_primaria) values ('${eA2}','vermelho')`)) !== null,
  "cor invalida entrou");

checa("Banco recusa marca com dois donos",
  (await tenta(uNeto, `insert into marcas (gestor_id, cliente_id) values ('${gB}','${cB}')`)) !== null,
  "linha com dois donos entrou");

checa("Banco recusa duas marcas para a mesma empresa",
  (await tenta(uNeto, `insert into marcas (empresa_id) values ('${eA}')`)) !== null,
  "duplicata entrou");

await db.exec(`delete from empresas where id='${eA}'`);
r = await db.query(`select count(*)::int n from marcas where empresa_id='${eA}'`);
checa("Apagar a empresa leva a marca dela junto", r.rows[0].n === 0, `sobraram ${r.rows[0].n}`);

// -------------------------------------------------- 6. upload de logo
console.log("\n\x1b[1mFASE 6 - permissao de upload\x1b[0m");
const podeGravar = async (uid, caminho) =>
  (await como(uid, `select pode_gravar_logo($1) as pode`, [caminho])).rows[0].pode;

checa("Gestor A grava na pasta dele", await podeGravar(uGestorA, `gestor/${gA}/logo.png`) === true);
checa("Gestor A NAO grava na pasta do gestor B", await podeGravar(uGestorA, `gestor/${gB}/logo.png`) === false);
checa("Gestor A NAO grava na pasta da plataforma", await podeGravar(uGestorA, `plataforma/geral/logo.png`) === false);
checa("Plataforma grava na pasta dela", await podeGravar(uNeto, `plataforma/geral/logo.png`) === true);
checa("Gestor A grava na pasta do cliente dele", await podeGravar(uGestorA, `cliente/${cA}/logo.png`) === true);
checa("Gestor A NAO grava na pasta do cliente do B", await podeGravar(uGestorA, `cliente/${cB}/logo.png`) === false);
checa("Empresario grava na pasta do cliente dele", await podeGravar(uClienteA, `cliente/${cA}/logo.png`) === true);
checa("Empresario NAO grava na pasta do gestor", await podeGravar(uClienteA, `gestor/${gA}/logo.png`) === false);
checa("Caminho fora da convencao e recusado", await podeGravar(uGestorA, `logo.png`) === false);
checa("Caminho com uuid invalido e recusado", await podeGravar(uGestorA, `gestor/nao-e-uuid/logo.png`) === false);
checa("Nivel inventado e recusado", await podeGravar(uNeto, `raiz/${gA}/logo.png`) === false);

// -------------------------------------------------- fim
console.log("");
if (falhas === 0) console.log("\x1b[32m\x1b[1mTODOS OS TESTES DE MARCA PASSARAM\x1b[0m");
else { console.log(`\x1b[31m\x1b[1m${falhas} TESTE(S) FALHARAM\x1b[0m`); process.exit(1); }
