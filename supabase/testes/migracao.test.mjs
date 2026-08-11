// TESTE DE MIGRACAO SOBRE DADOS EXISTENTES
//
// O outro teste (hierarquia.test.mjs) aplica tudo num banco vazio. Este aqui faz
// o que de fato vai acontecer em producao: monta um banco no schema ANTIGO
// (migrations 0001-0005), lanca dados como o cliente ja lancou, e so entao aplica
// 0006 e 0007 por cima -- conferindo que nenhum numero muda.
//
// Rodar: npm run testar:migracao
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
const titulo = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const aplicar = async (f) => {
  try { await db.exec(readFileSync(join(DIR, f), "utf8")); ok(f); }
  catch (e) { erro(f, e.message); console.log("\n\x1b[31mInterrompido.\x1b[0m"); process.exit(1); }
};

await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique, raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('mambix.uid', true), '')::uuid $$;
  create role authenticated nologin;
  grant usage on schema public, auth to authenticated;
`);

// =====================================================================
titulo("FASE 1 — banco no schema ANTIGO (como está em produção hoje)");
for (const f of arquivos.filter((f) => f < "0006")) await aplicar(f);

const uConsultor = (await db.query(
  `insert into auth.users (email) values ('suporte.dgficel@gmail.com') returning id`)).rows[0].id;
const uCliente = (await db.query(
  `insert into auth.users (email) values ('padaria@teste.com') returning id`)).rows[0].id;

const emp = (await db.query(`insert into empresas (nome) values ('Padaria Real') returning id`)).rows[0].id;
await db.exec(`insert into empresa_usuarios (empresa_id, user_id) values ('${emp}','${uCliente}')`);
const loja = (await db.query(`select id from lojas where empresa_id='${emp}' limit 1`)).rows[0].id;
ok("empresa criada com os 100 códigos e loja matriz");

// Lancamentos como o cliente faria no schema antigo: coluna "data" servindo de
// vencimento quando em aberto e de data de pagamento quando quitado.
await db.exec(`
  insert into pagamentos (empresa_id, loja_id, data, cfc, cd, descricao, comp_mes, comp_ano, valor, pago) values
    ('${emp}','${loja}','2026-06-05',1,31,'Aluguel junho',      6,2026,5000,false),
    ('${emp}','${loja}','2026-06-10',1,34,'Luz junho',          6,2026, 800,true),
    ('${emp}','${loja}','2026-06-15',1, 6,'Salários junho',     6,2026,12000,true),
    ('${emp}','${loja}','2026-07-05',1,31,'Aluguel julho',      7,2026,5000,false),
    ('${emp}','${loja}','2026-07-10',1,34,'Luz julho',          7,2026, 850,true);
  insert into receitas (empresa_id, loja_id, data, descricao, valor, tipo_recebimento) values
    ('${emp}','${loja}','2026-06-20','Vendas junho',30000,1),
    ('${emp}','${loja}','2026-07-20','Vendas julho',32000,1);
  insert into caixa_diario (empresa_id, loja_id, data, tipo_venda, valor) values
    ('${emp}','${loja}','2026-06-20',1,30000),
    ('${emp}','${loja}','2026-07-20',1,32000);
`);
ok("5 pagamentos, 2 receitas e 2 dias de caixa lançados no schema antigo");

// Fotografia dos numeros ANTES da migracao.
const antes = {};
antes.dreJun = Number((await db.query(
  `select coalesce(sum(valor),0) t from pagamentos where empresa_id='${emp}' and comp_ano=2026 and comp_mes=6`)).rows[0].t);
antes.dreJul = Number((await db.query(
  `select coalesce(sum(valor),0) t from pagamentos where empresa_id='${emp}' and comp_ano=2026 and comp_mes=7`)).rows[0].t);
antes.dfcJun = Number((await db.query(
  `select coalesce(sum(valor),0) t from pagamentos where empresa_id='${emp}' and pago
    and data between '2026-06-01' and '2026-06-30'`)).rows[0].t);
antes.dfcJul = Number((await db.query(
  `select coalesce(sum(valor),0) t from pagamentos where empresa_id='${emp}' and pago
    and data between '2026-07-01' and '2026-07-31'`)).rows[0].t);
antes.qtdPagos = Number((await db.query(
  `select count(*) n from pagamentos where empresa_id='${emp}' and pago`)).rows[0].n);
console.log(`      antes -> DRE jun ${antes.dreJun} | DRE jul ${antes.dreJul} | DFC jun ${antes.dfcJun} | DFC jul ${antes.dfcJul}`);

// =====================================================================
titulo("FASE 2 — aplicando a migração por cima dos dados");
for (const f of arquivos.filter((f) => f >= "0006")) await aplicar(f);
await db.exec(`
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
`);

// =====================================================================
titulo("FASE 3 — nada se perdeu");

let r = await db.query(`select count(*) n from pagamentos where empresa_id='${emp}'`);
checa("Os 5 pagamentos continuam lá", Number(r.rows[0].n) === 5, `achou ${r.rows[0].n}`);

r = await db.query(`select count(*) n from pagamento_baixas where empresa_id='${emp}'`);
checa(`Os ${antes.qtdPagos} pagamentos quitados viraram baixas`,
  Number(r.rows[0].n) === antes.qtdPagos, `criou ${r.rows[0].n}`);

r = await db.query(`select count(*) n from pagamentos where empresa_id='${emp}' and pago`);
checa("A trigger recalculou 'pago' e chegou no mesmo número",
  Number(r.rows[0].n) === antes.qtdPagos, `agora ${r.rows[0].n}`);

r = await db.query(`select count(*) n from pagamentos where empresa_id='${emp}' and vencimento is null`);
checa("Nenhum vencimento ficou nulo", Number(r.rows[0].n) === 0);

r = await db.query(`select coalesce(sum(valor),0) t from pagamentos where empresa_id='${emp}' and comp_ano=2026 and comp_mes=6`);
checa(`DRE de junho continua ${antes.dreJun}`, Number(r.rows[0].t) === antes.dreJun, `deu ${r.rows[0].t}`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamentos where empresa_id='${emp}' and comp_ano=2026 and comp_mes=7`);
checa(`DRE de julho continua ${antes.dreJul}`, Number(r.rows[0].t) === antes.dreJul, `deu ${r.rows[0].t}`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamento_baixas
  where empresa_id='${emp}' and data_pagamento between '2026-06-01' and '2026-06-30'`);
checa(`DFC de junho continua ${antes.dfcJun}`, Number(r.rows[0].t) === antes.dfcJun, `deu ${r.rows[0].t}`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamento_baixas
  where empresa_id='${emp}' and data_pagamento between '2026-07-01' and '2026-07-31'`);
checa(`DFC de julho continua ${antes.dfcJul}`, Number(r.rows[0].t) === antes.dfcJul, `deu ${r.rows[0].t}`);

r = await db.query(`select count(*) n from empresas where cliente_id is null`);
checa("Toda empresa ficou pendurada num cliente", Number(r.rows[0].n) === 0, `${r.rows[0].n} órfã(s)`);

r = await db.query(`select papel from perfis where user_id='${uConsultor}'`);
checa("Dono da plataforma foi promovido", r.rows[0].papel === "plataforma", `ficou "${r.rows[0].papel}"`);

r = await db.query(`select papel from perfis where user_id='${uCliente}'`);
checa("Usuário comum continua como empresário", r.rows[0].papel === "empresario", `ficou "${r.rows[0].papel}"`);

// =====================================================================
titulo("FASE 4 — acesso preservado para quem já usava");

async function como(uid, sql) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('mambix.uid', $1, false)`, [uid]);
  try { return await db.query(sql); }
  finally {
    // Limpa o uid tambem: sem isso, um db.exec direto depois desta chamada
    // continuaria rodando "como" o ultimo usuario, e os triggers de protecao
    // reagiriam a uma operacao que era para ser administrativa.
    await db.query(`select set_config('mambix.uid', '', false)`);
    await db.exec(`reset role`);
  }
}
const tenta = async (uid, sql) => {
  try { await como(uid, sql); return null; } catch (e) { return e.message; }
};

r = await como(uCliente, `select id, nome from empresas`);
checa("Cliente que já tinha vínculo continua enxergando a empresa dele",
  r.rows.some((x) => x.id === emp), "perdeu o acesso!");
checa("E deixou de enxergar a Empresa Demonstração (vínculo automático limpo)",
  r.rows.length === 1, `ainda vê ${r.rows.length}: ${r.rows.map((x) => x.nome).join(", ")}`);

r = await como(uCliente, `select count(*) n from pagamentos`);
checa("E continua vendo os lançamentos dela", Number(r.rows[0].n) === 5, `viu ${r.rows[0].n}`);

r = await como(uConsultor, `select count(*) n from pagamentos`);
checa("Plataforma vê tudo", Number(r.rows[0].n) === 5, `viu ${r.rows[0].n}`);

// =====================================================================
titulo("FASE 5 — o caso que motivou tudo, ponta a ponta");

const aluguelJun = (await db.query(
  `select id from pagamentos where empresa_id='${emp}' and descricao='Aluguel junho'`)).rows[0].id;

// Antes: pago em julho jogava a saida no DFC de junho. Agora vai para julho.
await como(uConsultor, `insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor)
  values ('${emp}','${aluguelJun}','2026-07-12',5000)`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamentos where empresa_id='${emp}' and comp_ano=2026 and comp_mes=6`);
checa("DRE de junho NÃO mudou ao pagar em julho", Number(r.rows[0].t) === 17800, `deu ${r.rows[0].t}`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamento_baixas
  where empresa_id='${emp}' and data_pagamento between '2026-06-01' and '2026-06-30'`);
checa("DFC de junho NÃO mudou", Number(r.rows[0].t) === 12800, `deu ${r.rows[0].t}`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamento_baixas
  where empresa_id='${emp}' and data_pagamento between '2026-07-01' and '2026-07-31'`);
checa("DFC de julho recebeu o aluguel atrasado (850 + 5000)", Number(r.rows[0].t) === 5850, `deu ${r.rows[0].t}`);

// =====================================================================
titulo("FASE 6 — consultas idênticas às do aplicativo");

// dadosDFC: baixas do mes com join no pagamento (cd/cfc vem do pai)
r = await db.query(`
  select p.cd, sum(b.valor) t
  from pagamento_baixas b join pagamentos p on p.id = b.pagamento_id
  where b.empresa_id='${emp}' and b.data_pagamento between '2026-07-01' and '2026-07-31'
  group by p.cd order by p.cd`);
const dfcPorCodigo = Object.fromEntries(r.rows.map((x) => [x.cd, Number(x.t)]));
checa("DFC julho classifica pelo código do pagamento pai (31=5000, 34=850)",
  dfcPorCodigo[31] === 5000 && dfcPorCodigo[34] === 850, JSON.stringify(dfcPorCodigo));

// em-aberto: saldo por lancamento
r = await db.query(`select count(*) n from pagamentos_saldo where empresa_id='${emp}' and pago = false`);
checa("Tela de contas em aberto lista só o aluguel de julho", Number(r.rows[0].n) === 1, `listou ${r.rows[0].n}`);

// dashboard: atrasado de meses anteriores
r = await db.query(`select coalesce(sum(saldo),0) t from pagamentos_saldo
  where empresa_id='${emp}' and pago=false and vencimento < '2026-08-01'`);
checa("Painel calcula o atrasado corretamente", Number(r.rows[0].t) === 5000, `deu ${r.rows[0].t}`);

// serieAnualCodigo, regime competencia
r = await db.query(`select comp_mes, sum(valor) t from pagamentos
  where empresa_id='${emp}' and cd=31 and comp_ano=2026 group by comp_mes order by comp_mes`);
const serieComp = Object.fromEntries(r.rows.map((x) => [x.comp_mes, Number(x.t)]));
checa("Série anual por competência do código 31: 5000 em jun e jul",
  serieComp[6] === 5000 && serieComp[7] === 5000, JSON.stringify(serieComp));

// serieAnualCodigo, regime caixa
r = await db.query(`
  select extract(month from b.data_pagamento)::int m, sum(b.valor) t
  from pagamento_baixas b join pagamentos p on p.id=b.pagamento_id
  where b.empresa_id='${emp}' and p.cd=31 group by 1 order by 1`);
const serieCaixa = Object.fromEntries(r.rows.map((x) => [x.m, Number(x.t)]));
checa("Série anual por caixa do código 31: nada em jun, 5000 em jul",
  serieCaixa[6] === undefined && serieCaixa[7] === 5000, JSON.stringify(serieCaixa));

// =====================================================================
titulo("FASE 7 — composição do total (o detalhamento tem que fechar)");

// O cliente vai abrir o codigo e somar as linhas na mao. Se nao bater com o
// total do relatorio, ele perde a confianca no sistema inteiro.
// Cenario: tres manutencoes diferentes no mesmo codigo, no mesmo mes.
await como(uConsultor, `insert into pagamentos (empresa_id, loja_id, vencimento, cfc, cd, descricao, comp_mes, comp_ano, valor) values
  ('${emp}','${loja}','2026-09-05',1,47,'Manutenção do freezer', 9,2026,1200),
  ('${emp}','${loja}','2026-09-12',1,47,'Manutenção elétrica',   9,2026, 800),
  ('${emp}','${loja}','2026-09-20',1,47,'Manutenção do ar',      9,2026, 450)`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamentos
  where empresa_id='${emp}' and cd=47 and comp_ano=2026 and comp_mes=9`);
const totalDRE = Number(r.rows[0].t);
checa("Total do código 47 na DRE de setembro é 2450", totalDRE === 2450, `deu ${totalDRE}`);

r = await db.query(`select descricao, valor from pagamentos
  where empresa_id='${emp}' and cd=47 and comp_ano=2026 and comp_mes=9 order by vencimento`);
checa("Detalhamento por competência lista as 3 manutenções", r.rows.length === 3, `listou ${r.rows.length}`);
checa("E a soma do detalhe fecha com o total",
  r.rows.reduce((s, x) => s + Number(x.valor), 0) === totalDRE, "não fechou");

// No caixa a leitura muda: paga uma inteira e outra pela metade.
const freezer = (await db.query(`select id from pagamentos
  where empresa_id='${emp}' and descricao='Manutenção do freezer'`)).rows[0].id;
const eletrica = (await db.query(`select id from pagamentos
  where empresa_id='${emp}' and descricao='Manutenção elétrica'`)).rows[0].id;

await como(uConsultor, `insert into pagamento_baixas (empresa_id,pagamento_id,data_pagamento,valor) values
  ('${emp}','${freezer}','2026-09-06',1200),
  ('${emp}','${eletrica}','2026-09-15',300),
  ('${emp}','${eletrica}','2026-10-02',500)`);

r = await db.query(`select coalesce(sum(b.valor),0) t
  from pagamento_baixas b join pagamentos p on p.id=b.pagamento_id
  where b.empresa_id='${emp}' and p.cd=47
    and b.data_pagamento between '2026-09-01' and '2026-09-30'`);
const totalDFC = Number(r.rows[0].t);
checa("Total do código 47 no DFC de setembro é 1500 (1200 + parcial de 300)",
  totalDFC === 1500, `deu ${totalDFC}`);

r = await db.query(`select b.valor, p.descricao
  from pagamento_baixas b join pagamentos p on p.id=b.pagamento_id
  where b.empresa_id='${emp}' and p.cd=47
    and b.data_pagamento between '2026-09-01' and '2026-09-30' order by b.data_pagamento`);
checa("Detalhamento por caixa lista 2 pagamentos (não 3 lançamentos)",
  r.rows.length === 2, `listou ${r.rows.length}`);
checa("E a soma do detalhe fecha com o total do DFC",
  r.rows.reduce((s, x) => s + Number(x.valor), 0) === totalDFC, "não fechou");

r = await db.query(`select coalesce(sum(b.valor),0) t
  from pagamento_baixas b join pagamentos p on p.id=b.pagamento_id
  where b.empresa_id='${emp}' and p.cd=47
    and b.data_pagamento between '2026-10-01' and '2026-10-31'`);
checa("A outra metade da elétrica aparece só em outubro", Number(r.rows[0].t) === 500, `deu ${r.rows[0].t}`);

r = await db.query(`select coalesce(sum(valor),0) t from pagamentos
  where empresa_id='${emp}' and cd=47 and comp_ano=2026 and comp_mes=10`);
checa("E a DRE de outubro continua zerada para esse código", Number(r.rows[0].t) === 0, `deu ${r.rows[0].t}`);

// =====================================================================
titulo("FASE 8 — casos de borda");

// estorno de parcial
const luzJul = (await db.query(
  `select id from pagamentos where empresa_id='${emp}' and descricao='Luz julho'`)).rows[0].id;
await db.exec(`delete from pagamento_baixas where pagamento_id='${luzJul}'`);
r = await db.query(`select pago, saldo from pagamentos_saldo where id='${luzJul}'`);
checa("Estornar a única baixa volta a conta para em aberto",
  r.rows[0].pago === false && Number(r.rows[0].saldo) === 850, JSON.stringify(r.rows[0]));

// valor alterado reavalia o status
await db.exec(`insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor)
  values ('${emp}','${luzJul}','2026-07-10',850)`);
await db.exec(`update pagamentos set valor = 1000 where id='${luzJul}'`);
r = await db.query(`select pago, saldo from pagamentos_saldo where id='${luzJul}'`);
checa("Corrigir o valor para cima reabre a conta",
  r.rows[0].pago === false && Number(r.rows[0].saldo) === 150, JSON.stringify(r.rows[0]));

await db.exec(`update pagamentos set valor = 850 where id='${luzJul}'`);
r = await db.query(`select pago from pagamentos_saldo where id='${luzJul}'`);
checa("Voltar o valor original quita de novo", r.rows[0].pago === true);

// exclusao em cascata
const antesBaixas = Number((await db.query(`select count(*) n from pagamento_baixas`)).rows[0].n);
await db.exec(`delete from pagamentos where id='${luzJul}'`);
const depoisBaixas = Number((await db.query(`select count(*) n from pagamento_baixas`)).rows[0].n);
checa("Excluir o lançamento leva as baixas junto (sem órfã)",
  depoisBaixas === antesBaixas - 1, `${antesBaixas} -> ${depoisBaixas}`);

// baixa com valor invalido
let msg = await tenta(uConsultor, `insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor)
  values ('${emp}','${aluguelJun}','2026-07-12',0)`);
checa("Banco recusa baixa de valor zero", msg !== null, "aceitou");

msg = await tenta(uConsultor, `insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor)
  values ('${emp}','${aluguelJun}','2026-07-12',-100)`);
checa("Banco recusa baixa negativa", msg !== null, "aceitou");

// convite expirado
const cli = (await db.query(`select id from clientes limit 1`)).rows[0].id;
const uConvidado = (await db.query(
  `insert into auth.users (email) values ('expirado@teste.com') returning id`)).rows[0].id;
await db.exec(`insert into convites (token, email, papel, cliente_id, expira_em)
  values ('tok-exp','expirado@teste.com','empresario','${cli}', now() - interval '1 day')`);
r = await como(uConvidado, `select aceitar_convite('tok-exp') as r`);
checa("Convite vencido é recusado",
  r.rows[0].r.ok === false && /xpirad/i.test(r.rows[0].r.erro ?? ""), JSON.stringify(r.rows[0].r));

r = await como(uConvidado, `select aceitar_convite('nao-existe') as r`);
checa("Token inexistente é recusado", r.rows[0].r.ok === false);

// =====================================================================
titulo("FASE 9 — isolamento nas baixas (dado financeiro entre carteiras)");

const gB = (await db.query(`insert into gestores (nome) values ('Gestor Rival') returning id`)).rows[0].id;
const uGestorB = (await db.query(
  `insert into auth.users (email) values ('rival@teste.com') returning id`)).rows[0].id;
await db.exec(`update perfis set papel='gestor', funcao='admin', gestor_id='${gB}' where user_id='${uGestorB}'`);

r = await como(uGestorB, `select count(*) n from pagamento_baixas`);
checa("Gestor de outra carteira não vê nenhuma baixa", Number(r.rows[0].n) === 0, `viu ${r.rows[0].n}`);

r = await como(uGestorB, `select count(*) n from pagamentos_saldo`);
checa("Nem os saldos em aberto", Number(r.rows[0].n) === 0, `viu ${r.rows[0].n}`);

msg = await tenta(uGestorB, `insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor)
  values ('${emp}','${aluguelJun}','2026-07-15',100)`);
checa("E não consegue dar baixa em conta alheia", msg !== null, "inserção passou!");

msg = await tenta(uGestorB, `delete from pagamento_baixas`);
r = await db.query(`select count(*) n from pagamento_baixas`);
checa("Nem apagar baixas alheias", Number(r.rows[0].n) > 0, "apagou tudo!");

r = await como(uGestorB, `select count(*) n from codigos_despesa`);
checa("Nem os códigos personalizados da outra empresa", Number(r.rows[0].n) === 0, `viu ${r.rows[0].n}`);

// =====================================================================
console.log("");
if (falhas === 0) console.log("\x1b[32m\x1b[1mTODOS OS TESTES PASSARAM\x1b[0m");
else { console.log(`\x1b[31m\x1b[1m${falhas} TESTE(S) FALHARAM\x1b[0m`); process.exit(1); }
