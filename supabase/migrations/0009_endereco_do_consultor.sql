-- MAMBIX/NORTEX - ENDERECO PROPRIO POR CONSULTOR
--
-- Problema que isto resolve: na tela de login ninguem esta autenticado ainda,
-- entao o sistema nao tem como saber de qual BPO o visitante e cliente --
-- marca_efetiva() cai na plataforma e todo mundo ve a marca da Nortex.
--
-- A saida e o proprio endereco carregar a informacao:  nortex.app/mambix
-- O apelido na URL diz de quem e a tela antes de qualquer login.

alter table gestores add column apelido text;

-- Minusculas, sem acento, sem espaco: e o que vai na barra de endereco.
alter table gestores add constraint apelido_valido
  check (apelido is null or apelido ~ '^[a-z0-9][a-z0-9-]{1,30}$');

create unique index gestor_por_apelido on gestores (apelido) where apelido is not null;

comment on column gestores.apelido is
  'Identificador do consultor na URL publica (nortex.app/<apelido>). Nulo = sem endereco proprio.';

-- Palavras que ja sao rota do sistema nao podem virar apelido, senao o
-- consultor sequestra uma tela. Vale para as rotas de hoje e para as que ja
-- estao previstas no menu com cadeado.
create or replace function apelido_reservado(p_apelido text) returns boolean
language sql immutable as $$
  select p_apelido = any (array[
    'login','dashboard','painel','carteira','codigos','marca','pagamentos',
    'receitas','caixa','parametros','dre','dfc','em-aberto','evolucao',
    'convite','auth','api','importar','admin','conta','sair','signout',
    'dre-contabil','fluxo-contabil','fluxo-diario','faturamento-diario',
    'impressao','evolucao-dre','evolucao-dfc','graficos','simulador','familia'
  ])
$$;

alter table gestores add constraint apelido_nao_reservado
  check (apelido is null or not apelido_reservado(apelido));

-- ============================================================
-- Marca publica
-- ============================================================
/* Devolve APENAS o que precisa para pintar uma tela de login: nome, logo,
   linha de apoio e cores. Nada de cliente, empresa ou usuario.

   E security definer e sem checagem de sessao de proposito -- quem abre o link
   ainda nao entrou. Em compensacao nao ha nenhum caminho daqui para dado de
   ninguem: quem souber o apelido descobre a logo do consultor, que e
   exatamente o que ele quer mostrar. */
create or replace function marca_publica(p_apelido text)
returns table (
  logo_url text, logo_negativo_url text, nome_exibido text, tagline text,
  cor_primaria text, cor_secundaria text, cor_positivo text, cor_negativo text
)
language sql stable security definer set search_path = public as $$
  with alvo as (
    select id from gestores
     where apelido = lower(trim(p_apelido)) and ativo
  ),
  cadeia as (
    select m.*, 1 as nivel from marcas m join alvo a on a.id = m.gestor_id
    union all
    select m.*, 2 from marcas m
     where m.gestor_id is null and m.cliente_id is null and m.empresa_id is null
       and exists (select 1 from alvo)   -- apelido inexistente devolve nada
  )
  select
    (array_agg(c.logo_url          order by c.nivel) filter (where c.logo_url          is not null))[1],
    (array_agg(c.logo_negativo_url order by c.nivel) filter (where c.logo_negativo_url is not null))[1],
    (array_agg(c.nome_exibido      order by c.nivel) filter (where c.nome_exibido      is not null))[1],
    (array_agg(c.tagline           order by c.nivel) filter (where c.tagline           is not null))[1],
    (array_agg(c.cor_primaria      order by c.nivel) filter (where c.cor_primaria      is not null))[1],
    (array_agg(c.cor_secundaria    order by c.nivel) filter (where c.cor_secundaria    is not null))[1],
    (array_agg(c.cor_positivo      order by c.nivel) filter (where c.cor_positivo      is not null))[1],
    (array_agg(c.cor_negativo      order by c.nivel) filter (where c.cor_negativo      is not null))[1]
  from cadeia c
  having count(*) > 0
$$;

comment on function marca_publica is
  'Marca de um consultor pelo apelido da URL, para a tela de login. So identidade visual -- nenhum dado de cliente.';

-- Os papeis `anon` e `authenticated` sao do Supabase e nao existem no PGlite
-- onde os testes rodam. A migration precisa passar nos dois lugares.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function marca_publica(text) to %I', r);
    end if;
  end loop;
end $$;

-- O consultor edita o proprio apelido? Nao: endereco publico e coisa da
-- plataforma. A policy de update de `gestores` ja e so da plataforma, entao
-- nao ha nada a fazer aqui -- fica registrado para nao virar duvida depois.

-- Mambix, que ja existe, ganha o endereco dela.
update gestores set apelido = 'mambix' where nome = 'Mambix' and apelido is null;
