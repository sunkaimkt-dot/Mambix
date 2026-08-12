-- NORTEX - A MARCA CERTA DEPOIS DO LOGIN
--
-- Dois furos na resolucao da marca, que davam no mesmo sintoma: o cliente da
-- Mambix entrava e via a Nortex.
--
-- 1. `meu_gestor()` le perfis.gestor_id, que e NULO para cliente final -- ele
--    se liga ao BPO atraves do cliente, nao do perfil. Entao, enquanto nao
--    houvesse empresa aberta (primeiro login, tela de carteira), a cadeia
--    pulava direto para a plataforma. Quem contratou a Mambix via a marca de
--    um produto do qual nunca ouviu falar.
--
-- 2. Quem entra por /mambix e nao tem vinculo nenhum com aquele BPO -- o caso
--    da plataforma abrindo a porta de um consultor para dar suporte -- tambem
--    caia na Nortex, apesar de ter entrado pela porta da Mambix.
--
-- A ordem de precedencia agora e explicita:
--   1. o gestor da empresa aberta        (contexto de trabalho manda)
--   2. o gestor do proprio perfil        (funcionario do BPO)
--   3. o gestor do cliente que acessa    (cliente final)
--   4. o gestor da porta por onde entrou (cookie, so cosmetico)
--
-- O item 4 e informado pela aplicacao e vem do navegador, entao nao vale como
-- autorizacao: forcar esse cookie so troca logo e cor, que ja sao publicas em
-- /<apelido>. Nenhum dado muda de dono por causa dele.

create or replace function gestor_dos_meus_clientes() returns uuid
language sql stable security definer set search_path = public as $$
  select c.gestor_id
    from clientes c
   where c.id in (select clientes_que_acesso())
   limit 1
$$;

comment on function gestor_dos_meus_clientes is
  'BPO do cliente final. Existe porque perfis.gestor_id e nulo para quem e cliente -- o vinculo dele passa pelo cliente.';

-- A assinatura antiga tinha um parametro so; com o novo default, as duas
-- passariam a existir e "marca_efetiva(null)" ficaria ambigua.
drop function if exists marca_efetiva(uuid);

create or replace function marca_efetiva(p_empresa uuid default null, p_consultor text default null)
returns table (
  logo_url text, logo_negativo_url text, nome_exibido text, tagline text,
  cor_primaria text, cor_secundaria text, cor_positivo text, cor_negativo text
)
language sql stable security definer set search_path = public as $$
  with alvo as (
    select case when p_empresa is not null and acesso_empresa(p_empresa)
                then p_empresa end as empresa_id
  ),
  gestor_alvo as (
    select coalesce(
      (select c.gestor_id from clientes c
         join empresas e on e.cliente_id = c.id
         join alvo a on a.empresa_id = e.id),
      meu_gestor(),
      gestor_dos_meus_clientes(),
      (select id from gestores
        where apelido = lower(trim(p_consultor)) and ativo)
    ) as id
  ),
  cadeia as (
    select m.*, 1 as nivel from marcas m, alvo a where m.empresa_id = a.empresa_id

    union all
    select m.*, 2 from marcas m
      join empresas e on e.cliente_id = m.cliente_id
      join alvo a on a.empresa_id = e.id

    union all
    select m.*, 3 from marcas m, gestor_alvo g
     where m.gestor_id is not null and m.gestor_id = g.id

    union all
    select m.*, 4 from marcas m
     where m.gestor_id is null and m.cliente_id is null and m.empresa_id is null
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
$$;

comment on function marca_efetiva is
  'Marca resolvida campo a campo. Ordem: empresa aberta, cliente dela, gestor (da empresa, do perfil, do cliente ou da porta de entrada), plataforma.';
