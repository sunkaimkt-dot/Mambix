-- MAMBIX - MARCA POR NIVEL DA HIERARQUIA (white-label)
--
--   plataforma          marca do produto. E o fim da cadeia: nunca herda de ninguem.
--     +-- gestor        marca do consultor financeiro (ex: Mambix Assessoria)
--           +-- cliente marca do dono
--                 +-- empresa   marca daquele CNPJ
--
-- Cada nivel preenche o que quiser. O que ficar em branco desce do nivel de cima,
-- CAMPO A CAMPO -- entao uma empresa pode trocar so a logo e continuar com as
-- cores do cliente. Quem resolve a cadeia e marca_efetiva().
--
-- Por que nao e uma tabela polimorfica com (escopo, escopo_id):
-- com tres colunas de chave estrangeira reais o Postgres apaga a marca sozinho
-- quando o dono some (on delete cascade) e recusa id inventado. Polimorfico
-- exigiria trigger para as duas coisas.

-- ============================================================
-- 1. Tabela
-- ============================================================
create table marcas (
  id uuid primary key default gen_random_uuid(),

  -- No maximo UMA destas e preenchida. Nenhuma preenchida = marca da plataforma.
  gestor_id  uuid references gestores(id)  on delete cascade,
  cliente_id uuid references clientes(id)  on delete cascade,
  empresa_id uuid references empresas(id)  on delete cascade,

  logo_url          text,
  logo_negativo_url text,
  nome_exibido      text,
  tagline           text,

  cor_primaria   text,
  cor_secundaria text,
  cor_positivo   text,
  cor_negativo   text,

  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,

  constraint um_dono_apenas check (num_nonnulls(gestor_id, cliente_id, empresa_id) <= 1),

  -- Cor so entra no formato #RRGGBB. A interface injeta esses valores direto em
  -- CSS: sem essa trava, texto arbitrario viraria injecao de estilo.
  constraint cores_hexadecimais check (
    coalesce(cor_primaria,   '#000000') ~ '^#[0-9A-Fa-f]{6}$' and
    coalesce(cor_secundaria, '#000000') ~ '^#[0-9A-Fa-f]{6}$' and
    coalesce(cor_positivo,   '#000000') ~ '^#[0-9A-Fa-f]{6}$' and
    coalesce(cor_negativo,   '#000000') ~ '^#[0-9A-Fa-f]{6}$'
  )
);

comment on table marcas is
  'Identidade visual por nivel da hierarquia. Campo em branco herda do nivel de cima.';

-- Coluna calculada: evita repetir o mesmo CASE na interface e nos testes.
alter table marcas add column escopo text
  generated always as (
    case
      when empresa_id is not null then 'empresa'
      when cliente_id is not null then 'cliente'
      when gestor_id  is not null then 'gestor'
      else 'plataforma'
    end
  ) stored;

-- Uma marca por dono. Indice parcial porque as colunas sao nulas na maioria das linhas.
create unique index marca_por_gestor  on marcas (gestor_id)  where gestor_id  is not null;
create unique index marca_por_cliente on marcas (cliente_id) where cliente_id is not null;
create unique index marca_por_empresa on marcas (empresa_id) where empresa_id is not null;
-- E uma unica linha de plataforma em toda a tabela.
create unique index marca_da_plataforma on marcas ((1))
  where gestor_id is null and cliente_id is null and empresa_id is null;

-- ============================================================
-- 2. Marca da plataforma
-- ============================================================
-- Semeada com as cores que o sistema JA usa hoje (emerald-700/600 e red-600).
-- Assim esta migration nao muda um pixel: a tela so muda quando alguem
-- resolver customizar.
insert into marcas (nome_exibido, tagline, cor_primaria, cor_secundaria, cor_positivo, cor_negativo)
values ('MAMBIX', 'Gestão financeira', '#047857', '#059669', '#047857', '#DC2626');

-- ============================================================
-- 3. Quem manda em cada nivel
-- ============================================================
/* plataforma  todas
   gestor      a propria, a dos clientes da carteira e a das empresas da carteira
   empresario  a dos clientes que acessa e a das empresas que acessa

   O gestor nao escreve na linha da plataforma nem em nivel nenhum de outra
   carteira. E como as colunas de dono SAO a identidade da linha, o `with check`
   ja impede mover uma marca de um dono para outro: o destino tambem precisa
   passar no teste. */
create or replace function posso_editar_marca(
  p_gestor uuid, p_cliente uuid, p_empresa uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when meu_papel() = 'plataforma' then true
    -- linha da plataforma: so a plataforma
    when p_gestor is null and p_cliente is null and p_empresa is null then false
    when p_gestor  is not null then meu_papel() = 'gestor' and p_gestor = meu_gestor()
    when p_cliente is not null then p_cliente in (select meus_clientes())
                                 or p_cliente in (select clientes_que_acesso())
    when p_empresa is not null then acesso_empresa(p_empresa)
    else false
  end
$$;

-- ============================================================
-- 4. Resolucao da cadeia
-- ============================================================
/* Marca que vale para o usuario logado neste momento.

   Com empresa aberta:  empresa -> cliente -> gestor -> plataforma
   Sem empresa aberta:  gestor do usuario -> plataforma
                        (telas de carteira e login, que nao tem empresa)

   E security definer de proposito: o empresario precisa enxergar a marca do
   gestor dele para a tela pintar certo, mas nao pode ler a tabela `gestores`.
   A funcao devolve as cores sem revelar a linha.

   A guarda de acesso_empresa() no inicio impede o caminho obvio de abuso:
   chamar a funcao com o uuid de uma empresa de outra carteira para descobrir
   se ela existe e que cara tem. */
create or replace function marca_efetiva(p_empresa uuid default null)
returns table (
  logo_url text, logo_negativo_url text, nome_exibido text, tagline text,
  cor_primaria text, cor_secundaria text, cor_positivo text, cor_negativo text
)
language sql stable security definer set search_path = public as $$
  with alvo as (
    select case when p_empresa is not null and acesso_empresa(p_empresa)
                then p_empresa end as empresa_id
  ),
  cadeia as (
    -- nivel 1: a propria empresa
    select m.*, 1 as nivel from marcas m, alvo a where m.empresa_id = a.empresa_id

    union all
    -- nivel 2: o cliente dono da empresa
    select m.*, 2 from marcas m
      join empresas e on e.cliente_id = m.cliente_id
      join alvo a on a.empresa_id = e.id

    union all
    -- nivel 3: o gestor -- pela empresa aberta, ou pelo perfil de quem esta logado
    select m.*, 3 from marcas m
     where m.gestor_id is not null
       and m.gestor_id = coalesce(
             (select c.gestor_id from clientes c
                join empresas e on e.cliente_id = c.id
                join alvo a on a.empresa_id = e.id),
             meu_gestor()
           )

    union all
    -- nivel 4: plataforma, sempre presente
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
  'Marca resolvida campo a campo: empresa, cliente, gestor, plataforma -- o primeiro valor nao nulo vence.';

-- ============================================================
-- 5. Politicas da tabela
-- ============================================================
alter table marcas enable row level security;

-- Leitura: a marca da plataforma e publica (e o fundo de todas as telas);
-- o resto segue a mesma regra da escrita.
create policy marcas_leitura on marcas for select using (
  (gestor_id is null and cliente_id is null and empresa_id is null)
  or posso_editar_marca(gestor_id, cliente_id, empresa_id)
);

create policy marcas_insercao on marcas for insert
  with check (posso_editar_marca(gestor_id, cliente_id, empresa_id));

create policy marcas_atualizacao on marcas for update
  using      (posso_editar_marca(gestor_id, cliente_id, empresa_id))
  with check (posso_editar_marca(gestor_id, cliente_id, empresa_id));

create policy marcas_exclusao on marcas for delete
  using (posso_editar_marca(gestor_id, cliente_id, empresa_id));

-- ============================================================
-- 6. Empresa desligada
-- ============================================================
-- `ativa` ja existia desde o 0001, mas nenhuma tela mexia nela.
comment on column empresas.ativa is
  'Empresa desligada some do seletor. O historico continua no banco -- nao se apaga empresa com lancamento.';

-- ============================================================
-- 7. Armazenamento das logos
-- ============================================================
/* Caminho do arquivo: <nivel>/<uuid do dono>/<arquivo>
     empresa/9f1c.../logo.png
     plataforma/geral/logo.png
   A primeira pasta diz o nivel, a segunda diz de quem e -- e e isso que a
   policy confere. Sem essa convencao nao ha como autorizar upload.

   Fica em `public` (e nao dentro do bloco abaixo) para poder ser testada em
   PGlite, onde o schema `storage` nao existe. */
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
    return meu_papel() = 'plataforma';
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

-- O schema `storage` so existe no Supabase de verdade. Os testes rodam em
-- PGlite puro, sem ele -- e a migration precisa passar nos dois lugares.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('marcas', 'marcas', true, 2097152,
            array['image/png','image/jpeg','image/svg+xml','image/webp'])
    on conflict (id) do update
      set public = true,
          file_size_limit = 2097152,
          allowed_mime_types = array['image/png','image/jpeg','image/svg+xml','image/webp'];

    drop policy if exists marcas_logo_leitura  on storage.objects;
    drop policy if exists marcas_logo_envio    on storage.objects;
    drop policy if exists marcas_logo_troca    on storage.objects;
    drop policy if exists marcas_logo_exclusao on storage.objects;

    create policy marcas_logo_leitura on storage.objects for select
      using (bucket_id = 'marcas');

    create policy marcas_logo_envio on storage.objects for insert
      with check (bucket_id = 'marcas' and public.pode_gravar_logo(name));

    create policy marcas_logo_troca on storage.objects for update
      using      (bucket_id = 'marcas' and public.pode_gravar_logo(name))
      with check (bucket_id = 'marcas' and public.pode_gravar_logo(name));

    create policy marcas_logo_exclusao on storage.objects for delete
      using (bucket_id = 'marcas' and public.pode_gravar_logo(name));

  end if;
end $$;
