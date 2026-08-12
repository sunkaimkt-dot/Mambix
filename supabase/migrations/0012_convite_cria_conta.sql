-- NORTEX - O CONVITE PASSA A CRIAR A CONTA
--
-- Faltava a porta: o sistema nunca teve tela de cadastro. O convite levava a
-- uma pagina que exigia estar logado, e so logava quem ja tinha conta -- as
-- unicas que existiam foram criadas a mao no painel do Supabase. Na pratica,
-- nao havia como dar acesso a ninguem.
--
-- Agora quem abre o link do convite sem estar logado cria a senha ali mesmo.
-- Continua valendo a regra: so entra quem foi convidado, e o vinculo so e feito
-- se o e-mail bater com o do convite.

/* Dados do convite para quem AINDA NAO tem sessao.
   Devolve o suficiente para montar a tela -- de quem e o convite e que marca
   usar -- e nada mais.

   O e-mail NAO sai daqui de proposito: um token que vaze nao deve entregar
   para quem vazou o endereco de quem foi convidado. A pessoa digita o e-mail
   e quem confere e o banco, no aceite. */
create or replace function convite_publico(p_token text)
returns table (
  valido boolean, papel papel_usuario, funcao funcao_carteira,
  logo_url text, nome_exibido text, tagline text,
  cor_primaria text, cor_positivo text, cor_negativo text
)
language sql stable security definer set search_path = public as $$
  with c as (
    select * from convites
     where token = p_token and aceito_em is null and expira_em > now()
  ),
  gestor_do_convite as (
    select coalesce(
      (select c.gestor_id from c),
      (select cl.gestor_id from clientes cl join c on cl.id = c.cliente_id)
    ) as id
  ),
  cadeia as (
    select m.*, 1 as nivel from marcas m, gestor_do_convite g
     where m.gestor_id is not null and m.gestor_id = g.id
    union all
    -- A plataforma so entra como fundo de escala se o convite existir. Token
    -- invalido nao ganha marca nenhuma: a tela dele e neutra, sem revelar de
    -- quem seria o convite nem em que produto ele estaria.
    select m.*, 2 from marcas m
     where m.gestor_id is null and m.cliente_id is null and m.empresa_id is null
       and exists (select 1 from c)
  )
  select
    (select count(*) from c) > 0,
    (select c.papel from c),
    (select c.funcao from c),
    (array_agg(x.logo_url     order by x.nivel) filter (where x.logo_url     is not null))[1],
    (array_agg(x.nome_exibido order by x.nivel) filter (where x.nome_exibido is not null))[1],
    (array_agg(x.tagline      order by x.nivel) filter (where x.tagline      is not null))[1],
    (array_agg(x.cor_primaria order by x.nivel) filter (where x.cor_primaria is not null))[1],
    (array_agg(x.cor_positivo order by x.nivel) filter (where x.cor_positivo is not null))[1],
    (array_agg(x.cor_negativo order by x.nivel) filter (where x.cor_negativo is not null))[1]
  from cadeia x
$$;

comment on function convite_publico is
  'O que a tela de convite mostra antes do login: se o token vale, que tipo de acesso e, e a marca de quem convidou. Sem e-mail.';

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function convite_publico(text) to %I', r);
    end if;
  end loop;
end $$;
