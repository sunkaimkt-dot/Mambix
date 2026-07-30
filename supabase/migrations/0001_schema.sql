-- MAMBIX - Schema inicial v1
-- Multi-tenant: consultor (admin) ve tudo; empresario ve apenas suas empresas.

create type papel_usuario as enum ('consultor', 'empresario');
create type grupo_despesa as enum ('PRO_LABORE','RH_PESSOAL','FIXAS','IMPOSTOS','FINANCEIRAS','VARIAVEIS','INVESTIMENTOS','RETIRADA_SOCIO','ESTOQUE');
create type grupo_familia as enum ('MORADIA','ALIMENTACAO','PESSOAIS','SAUDE','EDUCACAO','LAZER','VEICULOS','FINANCEIRAS','SEGUROS','IMPOSTOS','OUTRAS','INVESTIMENTOS');

create table perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel papel_usuario not null default 'empresario',
  criado_em timestamptz not null default now()
);

create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table lojas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  is_matriz boolean not null default false,
  criado_em timestamptz not null default now()
);

create table empresa_usuarios (
  empresa_id uuid not null references empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (empresa_id, user_id)
);

-- Tabelas de codigos (personalizaveis por empresa; semeadas com padrao)
create table codigos_despesa (
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo smallint not null check (codigo between 1 and 100),
  nome text not null default '',
  grupo grupo_despesa not null,
  primary key (empresa_id, codigo)
);

create table codigos_familia (
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo smallint not null check (codigo between 1 and 100),
  nome text not null default '',
  grupo grupo_familia not null,
  primary key (empresa_id, codigo)
);

create table formas_pagamento ( -- CP: como foi pago
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo smallint not null check (codigo between 1 and 20),
  nome text not null default '',
  primary key (empresa_id, codigo)
);

create table tipos_recebimento (
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo smallint not null check (codigo between 1 and 20),
  nome text not null default '',
  primary key (empresa_id, codigo)
);

create table tipos_venda ( -- caixa diario
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo smallint not null check (codigo between 1 and 20),
  nome text not null default '',
  primary key (empresa_id, codigo)
);

create table bancos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true
);

-- ============ LANCAMENTOS ============
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  loja_id uuid references lojas(id),
  data date not null,                       -- dia do pagamento/vencimento
  cfc smallint not null check (cfc between 1 and 4),  -- 1 fixa 2 variavel 3 nao-oper 4 investimento
  cd smallint not null check (cd between 1 and 100),  -- codigo de despesa
  descricao text not null default '',
  comp_mes smallint not null check (comp_mes between 1 and 12),
  comp_ano smallint not null,
  valor numeric(14,2) not null,
  banco_id uuid references bancos(id),
  cp smallint,                              -- forma de pagamento
  pago boolean not null default false,
  cod_familia smallint check (cod_familia between 1 and 100), -- orcamento domestico (opcional)
  criado_em timestamptz not null default now()
);
create index idx_pag_empresa_data on pagamentos (empresa_id, data);
create index idx_pag_empresa_comp on pagamentos (empresa_id, comp_ano, comp_mes);

create table receitas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  loja_id uuid references lojas(id),
  data date not null,
  descricao text not null default '',
  valor numeric(14,2) not null,
  banco_id uuid references bancos(id),
  tipo_recebimento smallint not null,
  criado_em timestamptz not null default now()
);
create index idx_rec_empresa_data on receitas (empresa_id, data);

create table caixa_diario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  loja_id uuid references lojas(id),
  data date not null,
  tipo_venda smallint not null,
  valor numeric(14,2) not null,
  unique (empresa_id, loja_id, data, tipo_venda)
);
create index idx_cd_empresa_data on caixa_diario (empresa_id, data);

create table parametros_mes (
  empresa_id uuid not null references empresas(id) on delete cascade,
  ano smallint not null,
  mes smallint not null check (mes between 1 and 12),
  margem_bruta_pct numeric(6,4),   -- ex.: 0.6168
  clientes integer,
  saldo_inicial jsonb,             -- {banco_id: valor}
  primary key (empresa_id, ano, mes)
);

-- ============ RLS ============
create or replace function meu_papel() returns papel_usuario
language sql stable security definer set search_path = public as
$$ select papel from perfis where user_id = auth.uid() $$;

create or replace function minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as
$$ select empresa_id from empresa_usuarios where user_id = auth.uid() $$;

alter table perfis enable row level security;
alter table empresas enable row level security;
alter table lojas enable row level security;
alter table empresa_usuarios enable row level security;
alter table codigos_despesa enable row level security;
alter table codigos_familia enable row level security;
alter table formas_pagamento enable row level security;
alter table tipos_recebimento enable row level security;
alter table tipos_venda enable row level security;
alter table bancos enable row level security;
alter table pagamentos enable row level security;
alter table receitas enable row level security;
alter table caixa_diario enable row level security;
alter table parametros_mes enable row level security;

create policy perfis_proprio on perfis for select using (user_id = auth.uid() or meu_papel() = 'consultor');
create policy perfis_consultor_admin on perfis for all using (meu_papel() = 'consultor');

create policy empresas_sel on empresas for select using (meu_papel() = 'consultor' or id in (select minhas_empresas()));
create policy empresas_adm on empresas for all using (meu_papel() = 'consultor');

create policy eu_sel on empresa_usuarios for select using (meu_papel() = 'consultor' or user_id = auth.uid());
create policy eu_adm on empresa_usuarios for all using (meu_papel() = 'consultor');

-- Politicas genericas para tabelas com empresa_id
do $do$
declare t text;
begin
  foreach t in array array['lojas','codigos_despesa','codigos_familia','formas_pagamento','tipos_recebimento','tipos_venda','bancos','pagamentos','receitas','caixa_diario','parametros_mes']
  loop
    execute format('create policy %I_sel on %I for select using (meu_papel() = ''consultor'' or empresa_id in (select minhas_empresas()))', t, t);
    execute format('create policy %I_adm on %I for all using (meu_papel() = ''consultor'')', t, t);
  end loop;
end
$do$;
