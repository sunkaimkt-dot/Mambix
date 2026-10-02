-- NORTEX - IMPORTACAO EM MASSA (Combo 3)
--
-- Especificacao 5.13: "detectar duplicidade antes de gravar, permitir desfazer
-- uma importacao inteira (lote identificado), e nunca gravar sem confirmacao".
--
-- Esta migration NAO toca nas tabelas de lancamento (pagamentos, receitas,
-- caixa_diario). Os lancamentos continuam sendo gravados pelas mesmas actions
-- das telas (salvarPagamento / salvarReceita / salvarCaixa), entao trigger
-- sincroniza_pago, baixas e RLS valem igual. Aqui so se guarda o RECIBO de cada
-- importacao (o lote) e o que ela gravou (os itens), para:
--   1. mostrar o historico de importacoes;
--   2. desfazer o lote inteiro depois (apagando pelos mesmos caminhos da tela).
--
-- Caixa Diario e diferente: la existe um valor so por loja + dia + tipo de
-- venda, e salvarCaixa SUBSTITUI o que havia. Por isso o item do caixa guarda a
-- chave e o valor anterior -- desfazer devolve o valor antigo (ou apaga, se o
-- dia estava vazio).

create table importacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('pagamentos', 'receitas', 'caixa_diario')),
  arquivo text not null default '',
  loja_id uuid references lojas(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  linhas_arquivo integer not null default 0,
  linhas_importadas integer not null default 0,
  linhas_rejeitadas integer not null default 0,
  valor_importado numeric(14,2) not null default 0,
  desfeita_em timestamptz,
  desfeita_por uuid references auth.users(id) on delete set null,
  -- Alvo da FK composta dos itens: garante que item e lote sao da mesma empresa.
  unique (id, empresa_id)
);
create index idx_importacoes_empresa on importacoes (empresa_id, criado_em desc);

comment on table importacoes is
  'Lote de importacao (Excel/CSV). Recibo do que foi importado; permite desfazer o lote inteiro.';

create table importacao_itens (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null,
  empresa_id uuid not null,
  tabela text not null check (tabela in ('pagamentos', 'receitas', 'caixa_diario')),
  -- pagamentos / receitas: id do lancamento criado. Sem FK de proposito: se o
  -- usuario apagar o lancamento na tela, o recibo continua existindo.
  registro_id uuid,
  -- caixa_diario: chave do dia (loja + data + tipo de venda)
  loja_id uuid,
  data date,
  tipo_venda smallint,
  valor numeric(14,2) not null,
  -- caixa_diario: valor que havia antes da importacao (null = dia vazio)
  valor_anterior numeric(14,2),
  linha_arquivo integer,
  foreign key (importacao_id, empresa_id) references importacoes (id, empresa_id) on delete cascade,
  check (
    (tabela in ('pagamentos', 'receitas') and registro_id is not null)
    or (tabela = 'caixa_diario' and data is not null and tipo_venda is not null)
  )
);
create index idx_importacao_itens_lote on importacao_itens (importacao_id);

comment on table importacao_itens is
  'O que cada lote gravou. Caixa diario guarda a chave do dia e o valor anterior (para desfazer).';

-- ============================================================
-- RLS: mesmo porteiro das tabelas de lancamento.
-- Le quem tem acesso a empresa (acesso_empresa); grava quem pode gravar
-- (escrita_empresa = acesso_empresa + nao ser "consulta", migration 0010).
-- ============================================================
alter table importacoes enable row level security;
alter table importacao_itens enable row level security;

create policy importacoes_leitura on importacoes for select
  using (acesso_empresa(empresa_id));
create policy importacoes_insercao on importacoes for insert
  with check (escrita_empresa(empresa_id));
create policy importacoes_atualizacao on importacoes for update
  using (escrita_empresa(empresa_id)) with check (escrita_empresa(empresa_id));
create policy importacoes_exclusao on importacoes for delete
  using (escrita_empresa(empresa_id));

create policy importacao_itens_leitura on importacao_itens for select
  using (acesso_empresa(empresa_id));
create policy importacao_itens_insercao on importacao_itens for insert
  with check (escrita_empresa(empresa_id));
create policy importacao_itens_atualizacao on importacao_itens for update
  using (escrita_empresa(empresa_id)) with check (escrita_empresa(empresa_id));
create policy importacao_itens_exclusao on importacao_itens for delete
  using (escrita_empresa(empresa_id));
