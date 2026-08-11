-- NORTEX - FUNCAO DE CADA PESSOA DENTRO DO BPO
--
-- Ate aqui, "gestor" era uma coisa so: quem entrava na carteira de um BPO podia
-- tudo -- lancar, cadastrar cliente, criar empresa, apagar e convidar mais
-- gente. Para o dono do BPO isso esta certo. Para o assistente que so digita
-- contas, e permissao demais.
--
-- Nascem tres funcoes dentro da carteira:
--
--   admin     o dono do BPO. Faz tudo o que o gestor fazia antes.
--   operador  o dia a dia: lanca, edita, da baixa, apaga lancamento.
--             NAO cadastra cliente nem empresa, NAO convida, NAO mexe na marca.
--   consulta  le relatorio e mais nada. Nenhuma escrita, em lugar nenhum.
--
-- Por que tres funcoes fechadas e nao uma lista de permissoes por pessoa:
-- cada permissao vira condicao dentro das policies do Postgres. Com tres
-- funcoes existem tres caminhos, e da para testar os tres de verdade. Com oito
-- interruptores independentes seriam 256 combinacoes -- e teste que cobre cinco
-- delas e chama de seguro e teatro. Aqui, policy frouxa nao da erro de tela:
-- mostra dado de cliente para quem nao devia ver, em silencio.
--
-- Quem convida: SO o admin. Convite e a unica porta de entrada da hierarquia --
-- se o operador pudesse convidar, daria acesso a si mesmo por outra conta, ou a
-- alguem de fora, sem o dono do BPO ficar sabendo.

create type funcao_carteira as enum ('admin', 'operador', 'consulta');

alter table perfis add column funcao funcao_carteira;

comment on column perfis.funcao is
  'Funcao dentro da carteira do BPO. So faz sentido para papel = gestor; nulo nos demais.';

-- Quem ja era gestor continua podendo tudo: eram todos donos de carteira.
update perfis set funcao = 'admin' where papel = 'gestor';

/* Coerencia: funcao so existe para gestor, e todo gestor tem uma.

   O trigger abaixo preenche sozinho em vez de deixar a gravacao explodir --
   e quando ninguem disse qual funcao, a pessoa entra como `operador`, que e a
   mais limitada das duas que trabalham. Promover depois e um clique; descobrir
   que alguem entrou como admin por omissao e bem pior. */
create or replace function normaliza_funcao_do_perfil() returns trigger
language plpgsql as $$
begin
  if new.papel = 'gestor' then
    new.funcao := coalesce(new.funcao, 'operador');
  else
    new.funcao := null;
  end if;
  return new;
end $$;

create trigger perfis_normaliza_funcao
  before insert or update on perfis
  for each row execute function normaliza_funcao_do_perfil();

alter table perfis add constraint funcao_so_para_gestor check (
  (papel = 'gestor' and funcao is not null) or (papel <> 'gestor' and funcao is null)
);

-- O convite ja diz que funcao a pessoa vai ter ao entrar. Mesma regra do
-- perfil: quem nao disser a funcao esta convidando um `operador`.
alter table convites add column funcao funcao_carteira;

create or replace function normaliza_funcao_do_convite() returns trigger
language plpgsql as $$
begin
  if new.papel = 'gestor' then
    new.funcao := coalesce(new.funcao, 'operador');
  else
    new.funcao := null;
  end if;
  return new;
end $$;

create trigger convites_normaliza_funcao
  before insert or update on convites
  for each row execute function normaliza_funcao_do_convite();

update convites set funcao = 'admin' where papel = 'gestor' and funcao is null;

alter table convites add constraint funcao_do_convite check (
  (papel = 'gestor' and funcao is not null) or (papel <> 'gestor' and funcao is null)
);

-- ============================================================
-- Perguntas que as policies fazem
-- ============================================================
create or replace function minha_funcao() returns funcao_carteira
language sql stable security definer set search_path = public as
$$ select funcao from perfis where user_id = auth.uid() $$;

/* Manda na carteira: cadastra cliente e empresa, convida, mexe na marca.
   A plataforma entra aqui tambem porque manda em todas. */
create or replace function administro_a_carteira() returns boolean
language sql stable security definer set search_path = public as $$
  select meu_papel() = 'plataforma'
      or (meu_papel() = 'gestor' and minha_funcao() = 'admin')
$$;

/* Pode gravar lancamento. Cliente final continua podendo -- e o dado dele.
   So quem e 'consulta' fica de fora. */
create or replace function posso_gravar() returns boolean
language sql stable security definer set search_path = public as $$
  select case meu_papel()
    when 'plataforma' then true
    when 'gestor'     then minha_funcao() <> 'consulta'
    else true
  end
$$;

/* Porteiro de escrita nas tabelas de lancamento: alem de ter acesso a empresa,
   a pessoa precisa ter permissao de gravar. */
create or replace function escrita_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select acesso_empresa(p_empresa) and posso_gravar()
$$;

-- ============================================================
-- Politicas revistas
-- ============================================================
-- Leitura continua igual: quem tem acesso a empresa le. Muda so a escrita.
do $do$
declare t text;
declare tabelas text[] := array[
  'lojas','codigos_despesa','codigos_familia','formas_pagamento','tipos_recebimento',
  'tipos_venda','bancos','pagamentos','receitas','caixa_diario','parametros_mes'
];
begin
  foreach t in array tabelas loop
    execute format('drop policy if exists %1$I_insercao on %1$I', t);
    execute format('drop policy if exists %1$I_atualizacao on %1$I', t);
    execute format('drop policy if exists %1$I_exclusao on %1$I', t);

    execute format($f$
      create policy %1$I_insercao on %1$I for insert with check (escrita_empresa(empresa_id))
    $f$, t);
    execute format($f$
      create policy %1$I_atualizacao on %1$I for update
      using (escrita_empresa(empresa_id)) with check (escrita_empresa(empresa_id))
    $f$, t);
    execute format($f$
      create policy %1$I_exclusao on %1$I for delete using (escrita_empresa(empresa_id))
    $f$, t);
  end loop;
end
$do$;

-- Baixas tem empresa_id proprio, entao seguem a mesma regra das demais.
drop policy if exists pagamento_baixas_insercao    on pagamento_baixas;
drop policy if exists pagamento_baixas_atualizacao on pagamento_baixas;
drop policy if exists pagamento_baixas_exclusao    on pagamento_baixas;

create policy pagamento_baixas_insercao on pagamento_baixas for insert
  with check (escrita_empresa(empresa_id));
create policy pagamento_baixas_atualizacao on pagamento_baixas for update
  using (escrita_empresa(empresa_id)) with check (escrita_empresa(empresa_id));
create policy pagamento_baixas_exclusao on pagamento_baixas for delete
  using (escrita_empresa(empresa_id));

-- Cadastro de cliente, empresa e vinculo: so quem administra a carteira.
drop policy if exists clientes_insercao   on clientes;
drop policy if exists clientes_atualizacao on clientes;
drop policy if exists clientes_exclusao   on clientes;

create policy clientes_insercao on clientes for insert with check (
  meu_papel() = 'plataforma' or (administro_a_carteira() and gestor_id = meu_gestor())
);
create policy clientes_atualizacao on clientes for update
  using      (meu_papel() = 'plataforma' or (administro_a_carteira() and gestor_id = meu_gestor()))
  with check (meu_papel() = 'plataforma' or (administro_a_carteira() and gestor_id = meu_gestor()));
create policy clientes_exclusao on clientes for delete
  using (meu_papel() = 'plataforma' or (administro_a_carteira() and gestor_id = meu_gestor()));

drop policy if exists empresas_insercao    on empresas;
drop policy if exists empresas_atualizacao on empresas;
drop policy if exists empresas_exclusao    on empresas;

create policy empresas_insercao on empresas for insert with check (
  meu_papel() = 'plataforma'
  or (administro_a_carteira() and cliente_id in (select meus_clientes()))
);
create policy empresas_atualizacao on empresas for update
  using (meu_papel() = 'plataforma'
     or (administro_a_carteira() and id in (select empresas_da_carteira())))
  with check (meu_papel() = 'plataforma'
     or (administro_a_carteira() and cliente_id in (select meus_clientes())));
create policy empresas_exclusao on empresas for delete
  using (meu_papel() = 'plataforma'
     or (administro_a_carteira() and id in (select empresas_da_carteira())));

-- Convite: a porta de entrada. So o admin abre.
drop policy if exists convites_insercao on convites;
drop policy if exists convites_exclusao on convites;

create policy convites_insercao on convites for insert with check (
  meu_papel() = 'plataforma'
  or (administro_a_carteira()
      and (cliente_id in (select meus_clientes()) or gestor_id = meu_gestor()))
);
create policy convites_exclusao on convites for delete using (
  meu_papel() = 'plataforma'
  or (administro_a_carteira()
      and (cliente_id in (select meus_clientes()) or gestor_id = meu_gestor()))
);

-- Marca: identidade do BPO nao e coisa de operador.
drop policy if exists marcas_insercao    on marcas;
drop policy if exists marcas_atualizacao on marcas;
drop policy if exists marcas_exclusao    on marcas;

create or replace function posso_editar_marca(
  p_gestor uuid, p_cliente uuid, p_empresa uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when meu_papel() = 'plataforma' then true
    when p_gestor is null and p_cliente is null and p_empresa is null then false
    -- dentro de um BPO, so o admin mexe na marca
    when meu_papel() = 'gestor' and minha_funcao() <> 'admin' then false
    when p_gestor  is not null then meu_papel() = 'gestor' and p_gestor = meu_gestor()
    when p_cliente is not null then p_cliente in (select meus_clientes())
                                 or p_cliente in (select clientes_que_acesso())
    when p_empresa is not null then acesso_empresa(p_empresa)
    else false
  end
$$;

create policy marcas_insercao on marcas for insert
  with check (posso_editar_marca(gestor_id, cliente_id, empresa_id));
create policy marcas_atualizacao on marcas for update
  using      (posso_editar_marca(gestor_id, cliente_id, empresa_id))
  with check (posso_editar_marca(gestor_id, cliente_id, empresa_id));
create policy marcas_exclusao on marcas for delete
  using (posso_editar_marca(gestor_id, cliente_id, empresa_id));

-- Vinculo de usuario a cliente/empresa tambem e ato administrativo.
drop policy if exists cliente_usuarios_escrita on cliente_usuarios;
create policy cliente_usuarios_escrita on cliente_usuarios for all
  using      (meu_papel() = 'plataforma' or (administro_a_carteira() and cliente_id in (select meus_clientes())))
  with check (meu_papel() = 'plataforma' or (administro_a_carteira() and cliente_id in (select meus_clientes())));

drop policy if exists empresa_usuarios_escrita on empresa_usuarios;
create policy empresa_usuarios_escrita on empresa_usuarios for all
  using      (meu_papel() = 'plataforma' or (administro_a_carteira() and acesso_empresa(empresa_id)))
  with check (meu_papel() = 'plataforma' or (administro_a_carteira() and acesso_empresa(empresa_id)));

-- ============================================================
-- Perfis: quem pode mudar a funcao de quem
-- ============================================================
/* O admin do BPO troca a funcao da equipe dele -- e esse era o pedido: o dono
   controla o acesso sem depender da plataforma.

   Duas travas: ninguem muda o proprio papel (senao o operador se promove a
   admin em um clique), e ninguem move gente para outra carteira. */
drop policy if exists perfis_escrita on perfis;

create policy perfis_escrita on perfis for all
  using (
    meu_papel() = 'plataforma'
    or user_id = auth.uid()
    or (administro_a_carteira() and gestor_id = meu_gestor() and user_id <> auth.uid())
  )
  with check (
    meu_papel() = 'plataforma'
    or user_id = auth.uid()
    or (administro_a_carteira() and gestor_id = meu_gestor() and user_id <> auth.uid())
  );

create or replace function protege_o_proprio_acesso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sem sessao e acesso direto ao banco (migration, seed, chave de servico),
  -- que ja tem poder total por outros caminhos -- o trigger nao tem o que
  -- proteger ali. A trava existe contra o usuario logado.
  if auth.uid() is null or meu_papel() = 'plataforma' then
    return new;
  end if;

  /* Aceitar convite muda o proprio papel, e isso e legitimo -- e a unica porta
     de entrada da hierarquia. aceitar_convite() marca a transacao antes de
     gravar; fora dela, ninguem mexe no proprio acesso. */
  if current_setting('mambix.aceitando_convite', true) = '1' then
    return new;
  end if;
  -- Mexendo na propria linha: nao muda papel, funcao nem carteira.
  if new.user_id = auth.uid() then
    if new.papel is distinct from old.papel
       or new.funcao is distinct from old.funcao
       or new.gestor_id is distinct from old.gestor_id then
      raise exception 'Voce nao pode alterar o proprio nivel de acesso.';
    end if;
  else
    -- Mexendo na linha de outra pessoa: ela nao sai da carteira.
    if new.gestor_id is distinct from old.gestor_id then
      raise exception 'Nao e possivel mover alguem para outra carteira.';
    end if;
    if new.papel is distinct from old.papel then
      raise exception 'Nao e possivel trocar o papel de outra pessoa.';
    end if;
  end if;
  return new;
end $$;

create trigger perfis_protege_acesso
  before update on perfis
  for each row execute function protege_o_proprio_acesso();

-- ============================================================
-- Convite passa a carregar a funcao
-- ============================================================
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

  -- Marca a transacao para o trigger de protecao deixar passar. `true` no
  -- terceiro argumento = vale so ate o fim desta transacao.
  perform set_config('mambix.aceitando_convite', '1', true);

  if v_convite.papel = 'gestor' then
    update perfis
       set papel = 'gestor',
           gestor_id = v_convite.gestor_id,
           funcao = coalesce(v_convite.funcao, 'operador')
     where user_id = auth.uid();
  else
    update perfis set papel = 'empresario', funcao = null where user_id = auth.uid();
    insert into cliente_usuarios (cliente_id, user_id)
    values (v_convite.cliente_id, auth.uid())
    on conflict do nothing;
  end if;

  update convites set aceito_em = now(), aceito_por = auth.uid() where id = v_convite.id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function aceitar_convite(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function aceitar_convite(text) to authenticated;
  end if;
end $$;
