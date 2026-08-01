-- MAMBIX - Separa REGIME DE COMPETENCIA de REGIME DE CAIXA
--
-- Problema que esta migration resolve (feedback do cliente, 2026-07-30):
--   O campo pagamentos.data carregava dois significados ("dia do pagamento/vencimento").
--   Enquanto a conta esta em aberto ele e vencimento; depois de paga vira data do
--   pagamento. Como alternarPago() so virava o booleano, um aluguel que vencia em
--   junho e foi pago em julho continuava com data de junho -- e caia no DFC de junho.
--
-- Depois desta migration:
--   DRE  = comp_ano/comp_mes do pagamento    (competencia: aparece pago ou nao)
--   DFC  = data_pagamento das baixas          (caixa: so o que saiu do banco)
--
-- Um pagamento pode receber VARIAS baixas (pagamento parcial). O aluguel de junho
-- pago em julho nao gera lancamento novo: recebe uma baixa com data de julho.
-- A DRE de junho nao muda; o DFC de julho recebe o valor. Sem duplicidade.

-- ============================================================
-- 1. data -> vencimento
-- ============================================================
alter table pagamentos rename column data to vencimento;
alter index idx_pag_empresa_data rename to idx_pag_empresa_vencimento;

comment on column pagamentos.vencimento is
  'Data em que a conta vence. Nao muda depois de lancada. Nao alimenta o DFC.';
comment on column pagamentos.comp_mes is
  'Mes de competencia: define em qual DRE a despesa aparece, tenha sido paga ou nao.';
comment on column pagamentos.pago is
  'Derivado das baixas (ver sincroniza_pago). Nao editar na mao.';

-- ============================================================
-- 2. Baixas (saidas reais de dinheiro)
-- ============================================================
create table pagamento_baixas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  pagamento_id uuid not null references pagamentos(id) on delete cascade,
  data_pagamento date not null,
  valor numeric(14,2) not null check (valor > 0),
  banco_id uuid references bancos(id),
  cp smallint,
  criado_em timestamptz not null default now()
);

create index idx_baixa_empresa_data on pagamento_baixas (empresa_id, data_pagamento);
create index idx_baixa_pagamento on pagamento_baixas (pagamento_id);

comment on table pagamento_baixas is
  'Cada saida real de dinheiro. E daqui que o DFC le. Varias baixas por pagamento = pagamento parcial.';
comment on column pagamento_baixas.data_pagamento is
  'Dia em que o dinheiro saiu. Pode cair em mes diferente do vencimento (conta atrasada).';

-- ============================================================
-- 3. Backfill: o que ja estava pago vira baixa integral
-- ============================================================
-- Preserva o resultado atual dos relatorios: quem estava pago com data X continua
-- aparecendo no DFC do mes de X, agora atraves da baixa.
insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor, banco_id, cp)
select empresa_id, id, vencimento, valor, banco_id, cp
from pagamentos
where pago = true;

-- ============================================================
-- 4. pago passa a ser derivado das baixas
-- ============================================================
create or replace function sincroniza_pago(p_pagamento uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total numeric(14,2);
  v_valor numeric(14,2);
begin
  select valor into v_valor from pagamentos where id = p_pagamento;
  if not found then return; end if;

  select coalesce(sum(valor), 0) into v_total
  from pagamento_baixas where pagamento_id = p_pagamento;

  -- Tolerancia de 1 centavo: evita conta "quase paga" por arredondamento.
  update pagamentos set pago = (v_total >= v_valor - 0.01) where id = p_pagamento;
end $$;

create or replace function trg_sincroniza_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform sincroniza_pago(old.pagamento_id);
    return old;
  end if;
  perform sincroniza_pago(new.pagamento_id);
  if tg_op = 'UPDATE' and old.pagamento_id <> new.pagamento_id then
    perform sincroniza_pago(old.pagamento_id);
  end if;
  return new;
end $$;

create trigger baixa_sincroniza_pago
after insert or update or delete on pagamento_baixas
for each row execute function trg_sincroniza_pago();

-- Se o valor da conta for corrigido, o status precisa ser reavaliado.
create or replace function trg_pagamento_valor_alterado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.valor is distinct from new.valor then
    perform sincroniza_pago(new.id);
  end if;
  return new;
end $$;

create trigger pagamento_valor_alterado
after update on pagamentos
for each row execute function trg_pagamento_valor_alterado();

-- ============================================================
-- 5. Saldo em aberto
-- ============================================================
create or replace view pagamentos_saldo as
select
  p.*,
  coalesce(b.total_pago, 0) as total_pago,
  p.valor - coalesce(b.total_pago, 0) as saldo
from pagamentos p
left join (
  select pagamento_id, sum(valor) as total_pago
  from pagamento_baixas group by pagamento_id
) b on b.pagamento_id = p.id;

-- security_invoker: a view respeita o RLS de quem consulta, nao do dono.
alter view pagamentos_saldo set (security_invoker = true);

-- ============================================================
-- 6. RLS - usa o porteiro da hierarquia (migration 0006)
-- ============================================================
alter table pagamento_baixas enable row level security;

create policy pagamento_baixas_leitura on pagamento_baixas for select
  using (acesso_empresa(empresa_id));

create policy pagamento_baixas_insercao on pagamento_baixas for insert
  with check (acesso_empresa(empresa_id));

create policy pagamento_baixas_atualizacao on pagamento_baixas for update
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));

create policy pagamento_baixas_exclusao on pagamento_baixas for delete
  using (acesso_empresa(empresa_id));
