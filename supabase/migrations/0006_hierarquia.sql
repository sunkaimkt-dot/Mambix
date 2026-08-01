-- MAMBIX - HIERARQUIA DE ACESSO EM QUATRO NIVEIS
--
--   LEADS DE SUCESSO (plataforma)  ve absolutamente tudo
--     +-- Gestor financeiro          ve apenas a propria carteira
--           +-- Cliente              pode ter varias empresas (CNPJs)
--                 +-- Empresa
--                       +-- Loja
--
-- Regra que da nome a tudo: um gestor NAO PODE saber que outro gestor existe.
-- Nao e filtro de tela -- e o Postgres que recusa a linha via RLS. Se a interface
-- tiver bug, ou alguem chamar a API na mao, o dado continua invisivel.
--
-- O que muda no que ja existia:
--   - papel 'consultor' (que significava "ve tudo") vira 'gestor' (ve a carteira)
--   - nasce o papel 'plataforma', acima de todos
--   - empresas passam a pertencer a um cliente, que pertence a um gestor
--   - usuario novo so entra na hierarquia por CONVITE

-- ============================================================
-- 1. Limpa as politicas antigas
-- ============================================================
-- Elas dependem de meu_papel(), que precisa ser recriada com o enum novo.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

drop function if exists meu_papel();
drop function if exists minhas_empresas();

-- ============================================================
-- 2. Novo enum de papeis
-- ============================================================
-- ALTER TYPE ... ADD VALUE nao pode ser usado na mesma transacao em que o valor
-- e referenciado, e migration roda em transacao. Por isso troca-se o tipo inteiro.
create type papel_novo as enum ('plataforma', 'gestor', 'empresario');

alter table perfis alter column papel drop default;
alter table perfis alter column papel type papel_novo
  using (case papel::text when 'consultor' then 'gestor' else 'empresario' end)::papel_novo;
alter table perfis alter column papel set default 'empresario';

drop type papel_usuario;
alter type papel_novo rename to papel_usuario;

-- ============================================================
-- 3. Estrutura da hierarquia
-- ============================================================
create table gestores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table gestores is
  'Clientes da Leads de Sucesso. Cada um enxerga apenas a propria carteira e nunca os demais.';

create table clientes (
  id uuid primary key default gen_random_uuid(),
  gestor_id uuid not null references gestores(id) on delete restrict,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index idx_cliente_gestor on clientes (gestor_id);

comment on table clientes is
  'Cliente final de um gestor. Pode ter varias empresas (CNPJs do mesmo dono).';

-- Quem, do lado do cliente, tem login
create table cliente_usuarios (
  cliente_id uuid not null references clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (cliente_id, user_id)
);

-- Empresa passa a pertencer a um cliente
alter table empresas add column cliente_id uuid references clientes(id) on delete restrict;
create index idx_empresa_cliente on empresas (cliente_id);

-- Gestor a que o usuario pertence (nulo para plataforma e para cliente final)
alter table perfis add column gestor_id uuid references gestores(id) on delete set null;

-- ============================================================
-- 4. Acolhe os dados que ja existem
-- ============================================================
do $$
declare v_gestor uuid; v_cliente uuid;
begin
  insert into gestores (nome) values ('Leads de Sucesso - carteira inicial')
  returning id into v_gestor;

  insert into clientes (gestor_id, nome) values (v_gestor, 'Clientes iniciais')
  returning id into v_cliente;

  update empresas set cliente_id = v_cliente where cliente_id is null;

  -- Ex-consultores viraram 'gestor' no passo 2; ficam nessa carteira inicial.
  update perfis set gestor_id = v_gestor where papel = 'gestor' and gestor_id is null;
end $$;

alter table empresas alter column cliente_id set not null;

-- O dono da plataforma sobe de nivel.
update perfis set papel = 'plataforma', gestor_id = null
where user_id in (select id from auth.users where email = 'suporte.dgficel@gmail.com');

-- ============================================================
-- 5. Convites - unica porta de entrada na hierarquia
-- ============================================================
create table convites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text not null,
  papel papel_usuario not null,
  gestor_id uuid references gestores(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_em timestamptz,
  aceito_por uuid references auth.users(id) on delete set null,

  -- convite de gestor aponta para um gestor; de cliente final, para um cliente
  constraint destino_coerente check (
    (papel = 'gestor'     and gestor_id is not null and cliente_id is null) or
    (papel = 'empresario' and cliente_id is not null)
  )
);
create index idx_convite_token on convites (token);
create index idx_convite_gestor on convites (gestor_id);

comment on table convites is
  'Quem se cadastra sem convite fica sem vinculo e nao enxerga nada. Este e o unico caminho para entrar em uma carteira.';

-- ============================================================
-- 6. Funcoes de acesso
-- ============================================================
create or replace function meu_papel() returns papel_usuario
language sql stable security definer set search_path = public as
$$ select papel from perfis where user_id = auth.uid() $$;

create or replace function meu_gestor() returns uuid
language sql stable security definer set search_path = public as
$$ select gestor_id from perfis where user_id = auth.uid() $$;

/* Empresas da carteira do gestor logado. */
create or replace function empresas_da_carteira() returns setof uuid
language sql stable security definer set search_path = public as $$
  select e.id
  from empresas e
  join clientes c on c.id = e.cliente_id
  where c.gestor_id = meu_gestor()
$$;

/* Empresas que o usuario acessa como cliente final. */
create or replace function minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select e.id
  from empresas e
  join cliente_usuarios cu on cu.cliente_id = e.cliente_id
  where cu.user_id = auth.uid()
  union
  select empresa_id from empresa_usuarios where user_id = auth.uid()
$$;

/* Porteiro unico: toda tabela com empresa_id pergunta a ele. */
create or replace function acesso_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    meu_papel() = 'plataforma'
    or (meu_papel() = 'gestor' and p_empresa in (select empresas_da_carteira()))
    or p_empresa in (select minhas_empresas())
$$;

/* ATENCAO -- estas tres funcoes existem para quebrar recursao de politica.
   Se a policy de `clientes` consultar `cliente_usuarios` diretamente, o Postgres
   avalia a policy de `cliente_usuarios`, que consulta `clientes` de volta:
   "infinite recursion detected in policy". Como security definer nao aplica RLS,
   a consulta interna nao dispara politica nenhuma e o ciclo se fecha.
   Nao troque estas chamadas por subquery direta na tabela. */

/* Clientes da carteira do gestor logado. */
create or replace function meus_clientes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from clientes where gestor_id = meu_gestor()
$$;

/* Clientes que o usuario acessa como cliente final. */
create or replace function clientes_que_acesso() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cliente_id from cliente_usuarios where user_id = auth.uid()
$$;

/* Usuarios ligados a carteira do gestor logado (para listar perfis). */
create or replace function usuarios_da_minha_carteira() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cu.user_id
  from cliente_usuarios cu
  join clientes c on c.id = cu.cliente_id
  where c.gestor_id = meu_gestor()
$$;

-- ============================================================
-- 7. Politicas
-- ============================================================

-- 7.1 Tabelas com empresa_id ------------------------------------------------
do $do$
declare t text;
declare tabelas text[] := array[
  'lojas','codigos_despesa','codigos_familia','formas_pagamento','tipos_recebimento',
  'tipos_venda','bancos','pagamentos','receitas','caixa_diario','parametros_mes'
];
begin
  foreach t in array tabelas loop
    execute format($f$
      create policy %1$I_leitura on %1$I for select using (acesso_empresa(empresa_id))
    $f$, t);
    execute format($f$
      create policy %1$I_insercao on %1$I for insert with check (acesso_empresa(empresa_id))
    $f$, t);
    execute format($f$
      create policy %1$I_atualizacao on %1$I for update
      using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id))
    $f$, t);
    execute format($f$
      create policy %1$I_exclusao on %1$I for delete using (acesso_empresa(empresa_id))
    $f$, t);
  end loop;
end
$do$;

-- 7.2 Gestores --------------------------------------------------------------
-- O gestor enxerga UMA linha: a dele. E assim que "nao saber que o outro existe"
-- deixa de ser promessa de interface e vira garantia do banco.
alter table gestores enable row level security;

create policy gestores_leitura on gestores for select
  using (meu_papel() = 'plataforma' or id = meu_gestor());
create policy gestores_escrita on gestores for all
  using (meu_papel() = 'plataforma') with check (meu_papel() = 'plataforma');

-- 7.3 Clientes --------------------------------------------------------------
alter table clientes enable row level security;

create policy clientes_leitura on clientes for select using (
  meu_papel() = 'plataforma'
  or gestor_id = meu_gestor()
  or id in (select clientes_que_acesso())
);
create policy clientes_insercao on clientes for insert with check (
  meu_papel() = 'plataforma' or (meu_papel() = 'gestor' and gestor_id = meu_gestor())
);
create policy clientes_atualizacao on clientes for update
  using (meu_papel() = 'plataforma' or (meu_papel() = 'gestor' and gestor_id = meu_gestor()))
  with check (meu_papel() = 'plataforma' or (meu_papel() = 'gestor' and gestor_id = meu_gestor()));
create policy clientes_exclusao on clientes for delete
  using (meu_papel() = 'plataforma' or (meu_papel() = 'gestor' and gestor_id = meu_gestor()));

-- 7.4 Empresas --------------------------------------------------------------
alter table empresas enable row level security;

create policy empresas_leitura on empresas for select using (acesso_empresa(id));
create policy empresas_insercao on empresas for insert with check (
  meu_papel() = 'plataforma'
  or (meu_papel() = 'gestor' and cliente_id in (select meus_clientes()))
);
create policy empresas_atualizacao on empresas for update
  using (meu_papel() = 'plataforma'
     or (meu_papel() = 'gestor' and id in (select empresas_da_carteira())))
  with check (meu_papel() = 'plataforma'
     or (meu_papel() = 'gestor' and cliente_id in (select meus_clientes())));
create policy empresas_exclusao on empresas for delete
  using (meu_papel() = 'plataforma'
     or (meu_papel() = 'gestor' and id in (select empresas_da_carteira())));

-- 7.5 Vinculos de usuario ---------------------------------------------------
alter table cliente_usuarios enable row level security;

create policy cliente_usuarios_leitura on cliente_usuarios for select using (
  meu_papel() = 'plataforma'
  or user_id = auth.uid()
  or cliente_id in (select meus_clientes())
);
create policy cliente_usuarios_escrita on cliente_usuarios for all
  using (meu_papel() = 'plataforma' or cliente_id in (select meus_clientes()))
  with check (meu_papel() = 'plataforma' or cliente_id in (select meus_clientes()));

alter table empresa_usuarios enable row level security;

create policy empresa_usuarios_leitura on empresa_usuarios for select
  using (meu_papel() = 'plataforma' or user_id = auth.uid() or acesso_empresa(empresa_id));
create policy empresa_usuarios_escrita on empresa_usuarios for all
  using (meu_papel() = 'plataforma' or (meu_papel() = 'gestor' and acesso_empresa(empresa_id)))
  with check (meu_papel() = 'plataforma' or (meu_papel() = 'gestor' and acesso_empresa(empresa_id)));

-- 7.6 Perfis ----------------------------------------------------------------
-- Um gestor nao pode listar perfis de outra carteira: veria nomes e e-mails alheios.
alter table perfis enable row level security;

create policy perfis_leitura on perfis for select using (
  user_id = auth.uid()
  or meu_papel() = 'plataforma'
  or (meu_papel() = 'gestor'
      and (gestor_id = meu_gestor() or user_id in (select usuarios_da_minha_carteira())))
);
create policy perfis_escrita on perfis for all
  using (meu_papel() = 'plataforma') with check (meu_papel() = 'plataforma');

-- 7.7 Convites --------------------------------------------------------------
alter table convites enable row level security;

create policy convites_leitura on convites for select using (
  meu_papel() = 'plataforma'
  or gestor_id = meu_gestor()
  or cliente_id in (select meus_clientes())
);
create policy convites_insercao on convites for insert with check (
  meu_papel() = 'plataforma'
  or (meu_papel() = 'gestor' and cliente_id in (select meus_clientes()))
);
create policy convites_exclusao on convites for delete using (
  meu_papel() = 'plataforma'
  or cliente_id in (select meus_clientes())
);

-- ============================================================
-- 8. Cadastro deixa de dar acesso automatico
-- ============================================================
-- O trigger da migration 0004 vinculava TODO usuario novo a Empresa Demonstração.
-- Servia como ambiente de teste; com hierarquia seria vazamento aberto.
drop trigger if exists on_perfil_created on perfis;
drop function if exists trg_vincula_demo();

-- Perfil continua sendo criado no cadastro, porem sem vinculo nenhum:
-- sem cliente e sem gestor, o usuario nao enxerga uma linha sequer.

-- Apagar o trigger nao basta: os vinculos que ele ja criou continuam valendo.
-- Todo mundo que se cadastrou ate hoje esta preso a Empresa Demonstração e
-- continuaria enxergando ela depois da migration -- inclusive clientes finais de
-- gestores diferentes, olhando a mesma base. Limpa-se o passivo aqui.
-- A plataforma nao e afetada: ela ve tudo pelo papel, nao por vinculo.
delete from empresa_usuarios eu
using empresas e, perfis p
where eu.empresa_id = e.id
  and p.user_id = eu.user_id
  and e.nome = 'Empresa Demonstração'
  and p.papel <> 'plataforma';

-- ============================================================
-- 9. Aceitar convite
-- ============================================================
-- security definer porque quem aceita ainda nao tem permissao para se vincular.
create or replace function aceitar_convite(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_convite convites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'Faca login antes de aceitar o convite.');
  end if;

  select * into v_convite from convites where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Convite invalido.');
  end if;
  if v_convite.aceito_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Este convite ja foi utilizado.');
  end if;
  if v_convite.expira_em < now() then
    return jsonb_build_object('ok', false, 'erro', 'Convite expirado. Peca um novo.');
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if lower(v_email) <> lower(v_convite.email) then
    return jsonb_build_object('ok', false, 'erro', 'Este convite foi enviado para outro e-mail.');
  end if;

  if v_convite.papel = 'gestor' then
    update perfis set papel = 'gestor', gestor_id = v_convite.gestor_id
    where user_id = auth.uid();
  else
    update perfis set papel = 'empresario' where user_id = auth.uid();
    insert into cliente_usuarios (cliente_id, user_id)
    values (v_convite.cliente_id, auth.uid())
    on conflict do nothing;
  end if;

  update convites set aceito_em = now(), aceito_por = auth.uid() where id = v_convite.id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function aceitar_convite(text) from public;
grant execute on function aceitar_convite(text) to authenticated;
