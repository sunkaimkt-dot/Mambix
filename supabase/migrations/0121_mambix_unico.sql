-- MAMBIX - O SISTEMA PASSA A SER DA MAMBIX, COM CLIENTES FINAIS
--
-- Decisao do Neto (02/10/2026): o sistema nao sera mais vendido para outros
-- BPOs. Ele e da Mambix, e a Mambix atende os proprios clientes finais.
--
-- O que muda AQUI no banco e pouco, de proposito. A estrutura da hierarquia
-- (gestores -> clientes -> empresas) e o RLS que ja foram testados continuam
-- iguais; a Mambix vira o unico "gestor" e o resto e simplificacao de tela.
-- Assim nada que ja funciona precisa ser reescrito, e se um dia a ideia de
-- revender voltar, o banco ainda sabe fazer.
--
--   1. a carteira da Mambix fica marcada como principal
--   2. cliente novo cai nela sozinho (gestor_id com valor padrao)
--   3. marca unica: a da Mambix, lida sem depender de quem esta logado
--   4. empresa nova ja nasce com bancos padrao (antes nascia sem nenhum)
--   5. tipo de recebimento 4, que vinha sem nome, ganha o nome de mercado
--
-- DRE Familia sai do escopo so na tela. Os codigos da familia e o campo Casa
-- continuam no banco, sem uso.

-- ============================================================
-- 1. Carteira principal
-- ============================================================
alter table gestores add column if not exists principal boolean not null default false;
create unique index if not exists gestores_um_principal on gestores (principal) where principal;

do $$
declare v_id uuid;
begin
  if exists (select 1 from gestores where principal) then
    return;
  end if;

  -- Prefere a carteira que ja se chama Mambix; senao, a mais antiga.
  select id into v_id from gestores
   order by (lower(nome) like 'mambix%') desc, criado_em
   limit 1;

  if v_id is null then
    insert into gestores (nome, principal) values ('Mambix', true);
  else
    update gestores set principal = true, nome = 'Mambix', ativo = true where id = v_id;
  end if;
end $$;

create or replace function gestor_principal() returns uuid
language sql stable security definer set search_path = public as
$$ select id from gestores where principal limit 1 $$;

comment on function gestor_principal is
  'Carteira da Mambix. Desde 02/10/2026 e a unica usada pelo sistema.';

-- ============================================================
-- 2. Cliente novo cai na carteira da Mambix
-- ============================================================
-- O dono (papel plataforma) nao tem gestor_id no perfil; sem este padrao a
-- tela teria que perguntar "carteira de quem?" -- e so existe uma.
alter table clientes alter column gestor_id set default gestor_principal();

-- ============================================================
-- 3. Marca unica
-- ============================================================
-- A marca que valia para a Mambix como consultor (linha do gestor) sobe para a
-- linha da plataforma, que passa a ser a unica lida pelo sistema.
do $$
declare
  v_gestor uuid := gestor_principal();
  v_plat uuid;
  g marcas%rowtype;
begin
  select id into v_plat from marcas
   where gestor_id is null and cliente_id is null and empresa_id is null
   limit 1;
  if v_plat is null then
    insert into marcas default values returning id into v_plat;
  end if;

  select * into g from marcas where gestor_id = v_gestor limit 1;

  update marcas set
    nome_exibido      = coalesce(g.nome_exibido, 'MAMBIX'),
    tagline           = coalesce(g.tagline, 'Gestão financeira'),
    logo_url          = coalesce(g.logo_url, logo_url),
    logo_negativo_url = coalesce(g.logo_negativo_url, logo_negativo_url),
    cor_primaria      = coalesce(g.cor_primaria, '#047857'),
    cor_secundaria    = coalesce(g.cor_secundaria, '#059669'),
    cor_positivo      = coalesce(g.cor_positivo, '#047857'),
    cor_negativo      = coalesce(g.cor_negativo, '#DC2626'),
    atualizado_em     = now()
  where id = v_plat;
end $$;

/* Marca da Mambix, sem heranca nenhuma. Serve a tela de login (ninguem logado)
   e o sistema inteiro depois de entrar. */
create or replace function marca_mambix()
returns table (
  logo_url text, logo_negativo_url text, nome_exibido text, tagline text,
  cor_primaria text, cor_secundaria text, cor_positivo text, cor_negativo text
)
language sql stable security definer set search_path = public as $$
  select logo_url, logo_negativo_url, nome_exibido, tagline,
         cor_primaria, cor_secundaria, cor_positivo, cor_negativo
    from marcas
   where gestor_id is null and cliente_id is null and empresa_id is null
   limit 1
$$;

revoke all on function marca_mambix() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function marca_mambix() to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function marca_mambix() to authenticated;
  end if;
end $$;

/* Quem edita a marca da Mambix: o dono e os administradores da equipe da
   Mambix (carteira principal).
   Antes, so a plataforma mexia na linha sem dono. Marca de cliente/empresa
   deixa de existir na tela, mas a regra antiga fica para essas linhas. */
create or replace function posso_editar_marca(
  p_gestor uuid, p_cliente uuid, p_empresa uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when meu_papel() = 'plataforma' then true
    when p_gestor is null and p_cliente is null and p_empresa is null
      then administro_a_carteira() and meu_gestor() = gestor_principal()
    when meu_papel() = 'gestor' and minha_funcao() <> 'admin' then false
    when p_gestor  is not null then meu_papel() = 'gestor' and p_gestor = meu_gestor()
    when p_cliente is not null then p_cliente in (select meus_clientes())
                                 or p_cliente in (select clientes_que_acesso())
    when p_empresa is not null then acesso_empresa(p_empresa)
    else false
  end
$$;


/* Logo da Mambix: mesma regra da marca (dono + administradores da equipe). */
create or replace function pode_gravar_logo(p_caminho text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_partes text[] := string_to_array(p_caminho, '/');
  v_dono uuid;
begin
  if coalesce(array_length(v_partes, 1), 0) < 3 then
    return false;
  end if;

  if v_partes[1] = 'plataforma' then
    return posso_editar_marca(null, null, null);
  end if;

  begin
    v_dono := v_partes[2]::uuid;
  exception when others then
    return false;
  end;

  return case v_partes[1]
    when 'gestor'  then posso_editar_marca(v_dono, null, null)
    when 'cliente' then posso_editar_marca(null, v_dono, null)
    when 'empresa' then posso_editar_marca(null, null, v_dono)
    else false
  end;
end $$;

-- ============================================================
-- 4. Bancos padrao
-- ============================================================
-- Ate aqui so a Empresa Demonstracao tinha bancos: cliente novo abria a tela
-- de pagamentos e o campo "local de pagamento" vinha vazio. A lista e a dos
-- bancos mais usados por pequena empresa no Brasil; o cliente desliga o que
-- nao usa e cadastra o que faltar na tela Bancos e lojas.
create or replace function bancos_padrao(p_empresa uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into bancos (empresa_id, nome)
  select p_empresa, b.nome
    from (values
      ('CAIXA DA EMPRESA'), ('BANCO DO BRASIL'), ('BRADESCO'), ('ITAÚ'),
      ('SANTANDER'), ('CAIXA ECONÔMICA'), ('NUBANK'), ('INTER'),
      ('SICOOB'), ('SICREDI'), ('MERCADO PAGO')
    ) as b(nome)
   where not exists (select 1 from bancos x where x.empresa_id = p_empresa and x.nome = b.nome);
end $$;

/* Roda depois do seed dos codigos (os triggers disparam em ordem alfabetica:
   empresas_seed < empresas_zz_padroes_mercado). */
create or replace function trg_padroes_mercado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform bancos_padrao(new.id);
  update tipos_recebimento set nome = 'VALE ALIMENTAÇÃO / REFEIÇÃO'
   where empresa_id = new.id and codigo = 4 and coalesce(nome, '') = '';
  return new;
end $$;

drop trigger if exists empresas_zz_padroes_mercado on empresas;
create trigger empresas_zz_padroes_mercado after insert on empresas
  for each row execute function trg_padroes_mercado();

-- Empresas que ja existem: so ganha banco quem nao tem nenhum.
do $$
declare e record;
begin
  for e in select id from empresas x where not exists (select 1 from bancos b where b.empresa_id = x.id) loop
    perform bancos_padrao(e.id);
  end loop;
end $$;

-- ============================================================
-- 5. Tipo de recebimento 4
-- ============================================================
update tipos_recebimento set nome = 'VALE ALIMENTAÇÃO / REFEIÇÃO'
 where codigo = 4 and coalesce(nome, '') = '';
