// Validacao do MAMBIX contra um Postgres real (PGlite/WASM).
// Aplica todas as migrations do zero e testa o que nao pode quebrar nunca:
// isolamento entre gestores e a separacao competencia x caixa.
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

// -------------------------------------------------- migrations
console.log("\n\x1b[1mMIGRATIONS\x1b[0m");
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(join(DIR, f), "utf8"));
    ok(f);
  } catch (e) {
    erro(f, e.message);
    console.log("\n\x1b[31mMigration quebrou. Interrompendo.\x1b[0m");
    process.exit(1);
  }
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

const uGestorA = await novoUsuario("gestor.a@teste.com");
const uGestorB = await novoUsuario("gestor.b@teste.com");
const uClienteA = await novoUsuario("cliente.a@teste.com");
const uAvulso = await novoUsuario("ninguem@teste.com");

const gA = (await db.query(`insert into gestores (nome) values ('Gestor A') returning id`)).rows[0].id;
const gB = (await db.query(`insert into gestores (nome) values ('Gestor B') returning id`)).rows[0].id;
await db.exec(`update perfis set papel='gestor', gestor_id='${gA}' where user_id='${uGestorA}'`);
await db.exec(`update perfis set papel='gestor', gestor_id='${gB}' where user_id='${uGestorB}'`);

const cA = (await db.query(`insert into clientes (gestor_id,nome) values ('${gA}','Cliente A1') returning id`)).rows[0].id;
const cB = (await db.query(`insert into clientes (gestor_id,nome) values ('${gB}','Cliente B1') returning id`)).rows[0].id;

const eA = (await db.query(`insert into empresas (nome,cliente_id) values ('Padaria do A','${cA}') returning id`)).rows[0].id;
const eA2 = (await db.query(`insert into empresas (nome,cliente_id) values ('Padaria do A - CNPJ 2','${cA}') returning id`)).rows[0].id;
const eB = (await db.query(`insert into empresas (nome,cliente_id) values ('Loja do B','${cB}') returning id`)).rows[0].id;

await db.exec(`insert into cliente_usuarios (cliente_id,user_id) values ('${cA}','${uClienteA}')`);
await db.exec(`update perfis set papel='empresario' where user_id='${uClienteA}'`);
ok("2 gestores, 2 clientes, 3 empresas, 1 usuario avulso");

// -------------------------------------------------- helpers
async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('mambix.uid', $1, false)`, [uid]);
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role`); }
}
const tenta = async (uid, sql) => {
  try { await como(uid, sql); return null; } catch (e) { return e.message; }
};

// -------------------------------------------------- isolamento
console.log("\n\x1b[1mISOLAMENTO ENTRE GESTORES\x1b[0m");
let r = await como(uGestorA, `select id,nome from empresas order by nome`);
checa("Gestor A ve as 2 empresas da carteira dele", r.rows.length === 2, `viu ${r.rows.length}`);
checa("Gestor A NAO ve a empresa do Gestor B", !r.rows.some((x) => x.id === eB));

r = await como(uGestorA, `select id from gestores`);
checa("Gestor A ve apenas 1 gestor (ele mesmo)", r.rows.length === 1 && r.rows[0].id === gA, `viu ${r.rows.length}`);

r = await como(uGestorA, `select id from clientes`);
checa("Gestor A NAO ve clientes do Gestor B", r.rows.length === 1 && r.rows[0].id === cA, `viu ${r.rows.length}`);

r = await como(uGestorA, `select user_id from perfis`);
checa("Gestor A NAO ve o perfil do Gestor B", !r.rows.some((x) => x.user_id === uGestorB));

r = await como(uGestorB, `select id from empresas`);
checa("Gestor B ve apenas a propria empresa", r.rows.length === 1 && r.rows[0].id === eB, `viu ${r.rows.length}`);

checa("Gestor A NAO consegue lancar na empresa do Gestor B",
  (await tenta(uGestorA, `insert into pagamentos (empresa_id,vencimento,cfc,cd,comp_mes,comp_ano,valor)
    values ('${eB}','2026-07-10',1,31,7,2026,100)`)) !== null, "insercao passou");

await tenta(uGestorA, `update empresas set nome='invadido' where id='${eB}'`);
r = await db.query(`select nome from empresas where id='${eB}'`);
checa("Gestor A NAO consegue renomear a empresa do B", r.rows[0].nome === "Loja do B", `virou "${r.rows[0].nome}"`);

checa("Gestor A NAO consegue criar cliente na carteira do B",
  (await tenta(uGestorA, `insert into clientes (gestor_id,nome) values ('${gB}','sequestro')`)) !== null, "insercao passou");

// -------------------------------------------------- cliente final
console.log("\n\x1b[1mCLIENTE FINAL\x1b[0m");
r = await como(uClienteA, `select id from empresas`);
checa("Cliente final ve as 2 empresas dele (dois CNPJs)", r.rows.length === 2, `viu ${r.rows.length}`);
r = await como(uClienteA, `select id from gestores`);
checa("Cliente final NAO ve nenhum gestor", r.rows.length === 0, `viu ${r.rows.length}`);
r = await como(uClienteA, `select id from clientes`);
checa("Cliente final ve apenas o proprio cadastro", r.rows.length === 1 && r.rows[0].id === cA, `viu ${r.rows.length}`);

// -------------------------------------------------- avulso
console.log("\n\x1b[1mCADASTRO SEM CONVITE\x1b[0m");
for (const [tabela, rotulo] of [["empresas","empresa"],["gestores","gestor"],["clientes","cliente"],["pagamentos","lancamento"]]) {
  r = await como(uAvulso, `select 1 from ${tabela}`);
  checa(`Usuario avulso nao ve nenhum ${rotulo}`, r.rows.length === 0, `viu ${r.rows.length}`);
}

// -------------------------------------------------- plataforma
console.log("\n\x1b[1mPLATAFORMA\x1b[0m");
r = await como(uNeto, `select id from empresas`);
checa("Leads de Sucesso ve todas as empresas", r.rows.length >= 3, `viu ${r.rows.length}`);
r = await como(uNeto, `select id from gestores`);
checa("Leads de Sucesso ve todos os gestores", r.rows.length >= 2, `viu ${r.rows.length}`);

// -------------------------------------------------- convite
console.log("\n\x1b[1mCONVITE\x1b[0m");
const uNovo = await novoUsuario("novo.cliente@teste.com");
await como(uGestorA, `insert into convites (token,email,papel,cliente_id,criado_por)
  values ('tok-123','novo.cliente@teste.com','empresario','${cA}','${uGestorA}')`);

let res = await como(uNovo, `select aceitar_convite('tok-123') as r`);
checa("Convite valido e aceito", res.rows[0].r.ok === true, JSON.stringify(res.rows[0].r));

r = await como(uNovo, `select id from empresas`);
checa("Apos aceitar, o convidado ve as empresas do cliente", r.rows.length === 2, `viu ${r.rows.length}`);

res = await como(uNovo, `select aceitar_convite('tok-123') as r`);
checa("Convite nao pode ser reutilizado", res.rows[0].r.ok === false);

const uIntruso = await novoUsuario("intruso@teste.com");
await como(uGestorA, `insert into convites (token,email,papel,cliente_id,criado_por)
  values ('tok-456','outro@teste.com','empresario','${cA}','${uGestorA}')`);
res = await como(uIntruso, `select aceitar_convite('tok-456') as r`);
checa("Convite recusa e-mail diferente do destinatario", res.rows[0].r.ok === false);

r = await como(uGestorB, `select id from convites`);
checa("Gestor B NAO ve convites do Gestor A", r.rows.length === 0, `viu ${r.rows.length}`);

// -------------------------------------------------- competencia x caixa
console.log("\n\x1b[1mCOMPETENCIA x CAIXA (o caso do aluguel)\x1b[0m");
const pag = (await como(uGestorA,
  `insert into pagamentos (empresa_id,vencimento,cfc,cd,descricao,comp_mes,comp_ano,valor)
   values ('${eA}','2026-06-05',1,31,'Aluguel junho',6,2026,5000) returning id`)).rows[0].id;

r = await como(uGestorA, `select pago,saldo from pagamentos_saldo where id='${pag}'`);
checa("Aluguel de junho nasce em aberto, saldo cheio",
  r.rows[0].pago === false && Number(r.rows[0].saldo) === 5000, JSON.stringify(r.rows[0]));

r = await como(uGestorA, `select coalesce(sum(valor),0) t from pagamentos
  where empresa_id='${eA}' and comp_ano=2026 and comp_mes=6`);
checa("DRE de junho inclui o aluguel nao pago", Number(r.rows[0].t) === 5000, `deu ${r.rows[0].t}`);

r = await como(uGestorA, `select coalesce(sum(valor),0) t from pagamento_baixas
  where empresa_id='${eA}' and data_pagamento between '2026-06-01' and '2026-06-30'`);
checa("DFC de junho nao registra saida", Number(r.rows[0].t) === 0, `deu ${r.rows[0].t}`);

await como(uGestorA, `insert into pagamento_baixas (empresa_id,pagamento_id,data_pagamento,valor)
  values ('${eA}','${pag}','2026-07-10',5000)`);
const pagJul = (await como(uGestorA,
  `insert into pagamentos (empresa_id,vencimento,cfc,cd,descricao,comp_mes,comp_ano,valor)
   values ('${eA}','2026-07-05',1,31,'Aluguel julho',7,2026,5000) returning id`)).rows[0].id;
await como(uGestorA, `insert into pagamento_baixas (empresa_id,pagamento_id,data_pagamento,valor)
  values ('${eA}','${pagJul}','2026-07-05',5000)`);

r = await como(uGestorA, `select pago from pagamentos where id='${pag}'`);
checa("Baixa integral marca a conta como paga", r.rows[0].pago === true);

r = await como(uGestorA, `select coalesce(sum(valor),0) t from pagamentos
  where empresa_id='${eA}' and comp_ano=2026 and comp_mes=6`);
checa("DRE de junho continua 5000 (nao duplicou)", Number(r.rows[0].t) === 5000, `deu ${r.rows[0].t}`);

r = await como(uGestorA, `select coalesce(sum(valor),0) t from pagamentos
  where empresa_id='${eA}' and comp_ano=2026 and comp_mes=7`);
checa("DRE de julho tem so o aluguel de julho", Number(r.rows[0].t) === 5000, `deu ${r.rows[0].t}`);

r = await como(uGestorA, `select coalesce(sum(valor),0) t from pagamento_baixas
  where empresa_id='${eA}' and data_pagamento between '2026-07-01' and '2026-07-31'`);
checa("DFC de julho soma os DOIS alugueis (10000)", Number(r.rows[0].t) === 10000, `deu ${r.rows[0].t}`);

// -------------------------------------------------- parcial
console.log("\n\x1b[1mPAGAMENTO PARCIAL\x1b[0m");
const pFornec = (await como(uGestorA,
  `insert into pagamentos (empresa_id,vencimento,cfc,cd,descricao,comp_mes,comp_ano,valor)
   values ('${eA}','2026-07-20',1,39,'Contador',7,2026,1000) returning id`)).rows[0].id;

await como(uGestorA, `insert into pagamento_baixas (empresa_id,pagamento_id,data_pagamento,valor)
  values ('${eA}','${pFornec}','2026-07-20',400)`);
r = await como(uGestorA, `select pago,saldo from pagamentos_saldo where id='${pFornec}'`);
checa("Pagamento parcial nao marca como pago",
  r.rows[0].pago === false && Number(r.rows[0].saldo) === 600, JSON.stringify(r.rows[0]));

await como(uGestorA, `insert into pagamento_baixas (empresa_id,pagamento_id,data_pagamento,valor)
  values ('${eA}','${pFornec}','2026-08-03',600)`);
r = await como(uGestorA, `select pago,saldo from pagamentos_saldo where id='${pFornec}'`);
checa("Quitado com a segunda parcela",
  r.rows[0].pago === true && Number(r.rows[0].saldo) === 0, JSON.stringify(r.rows[0]));

r = await como(uGestorA, `select coalesce(sum(valor),0) t from pagamento_baixas
  where pagamento_id='${pFornec}' and data_pagamento between '2026-08-01' and '2026-08-31'`);
checa("Parcela de agosto cai no DFC de agosto", Number(r.rows[0].t) === 600, `deu ${r.rows[0].t}`);

const bx = (await como(uGestorA, `select id from pagamento_baixas
  where pagamento_id='${pFornec}' and data_pagamento='2026-08-03'`)).rows[0].id;
await como(uGestorA, `delete from pagamento_baixas where id='${bx}'`);
r = await como(uGestorA, `select pago,saldo from pagamentos_saldo where id='${pFornec}'`);
checa("Estornar a baixa volta a conta para em aberto",
  r.rows[0].pago === false && Number(r.rows[0].saldo) === 600, JSON.stringify(r.rows[0]));

// -------------------------------------------------- codigos
console.log("\n\x1b[1mCODIGOS PERSONALIZAVEIS POR EMPRESA\x1b[0m");
r = await como(uGestorA, `select count(*)::int n from codigos_despesa where empresa_id='${eA}'`);
checa("Empresa nova nasce com os 100 codigos", r.rows[0].n === 100, `tem ${r.rows[0].n}`);

await como(uGestorA, `update codigos_despesa set nome='ALUGUEL DA PADARIA'
  where empresa_id='${eA}' and codigo=31`);
r = await como(uGestorA, `select nome from codigos_despesa where empresa_id='${eA2}' and codigo=31`);
checa("Editar codigo de uma empresa nao afeta a outra",
  r.rows[0].nome === "ALUGUEL + CONDOMÍNIO", `virou "${r.rows[0].nome}"`);

// -------------------------------------------------- fim
console.log("");
if (falhas === 0) console.log("\x1b[32m\x1b[1mTODOS OS TESTES PASSARAM\x1b[0m");
else { console.log(`\x1b[31m\x1b[1m${falhas} TESTE(S) FALHARAM\x1b[0m`); process.exit(1); }
