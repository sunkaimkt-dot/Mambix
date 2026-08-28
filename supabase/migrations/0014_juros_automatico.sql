-- NORTEX - JUROS AUTOMATICO NA BAIXA DE PAGAMENTO
--
-- Pedido do Marcelo (ticket #10649, 01/08/2026):
--   "No caso desses pagamentos em atraso, tem como ter dois campos, um do
--   valor nominal do boleto e outro do valor pago, e o sistema identificar
--   os juros cobrados? Dai o sistema alimentar automaticamente o valor dos
--   juros pagos e alimentar a DRE e a DFC?"
--   "No caso dos juros, ele entra tanto na dre quanto na dfc no mes que
--   esta sendo pago."
--
-- Reaproveita a arquitetura de pagamentos + baixas (migration 0007): quando o
-- valor pago numa baixa e MAIOR que o saldo em aberto da conta, a diferenca
-- vira um SEGUNDO lancamento (o juro), com competencia = mes do pagamento,
-- ja baixado na mesma data. Isso faz o valor aparecer na DRE e no DFC do mes
-- em que foi pago, exatamente como pedido, sem misturar com o valor original
-- da conta (que continua batendo com o boleto, pra conferencia).
--
-- Tudo roda dentro de uma unica funcao (registrar_baixa_com_juros), pra nao
-- correr risco de gravar so metade da operacao se algo falhar no meio.

alter table pagamentos add column gerado_por_juros_de uuid references pagamentos(id) on delete set null;
comment on column pagamentos.gerado_por_juros_de is
  'Preenchido quando este lancamento e o juro automatico de outra conta. So rastreabilidade -- nao ha cascata de exclusao.';

-- A view usa "p.*", que o Postgres expande na lista de colunas JA existentes
-- no momento da criacao. Sem recriar aqui, a coluna nova ficaria invisivel
-- para quem consulta pagamentos_saldo (usado pela funcao abaixo). "create or
-- replace" nao serve: ele so aceita colunas novas no FINAL da view, e aqui a
-- coluna nova entraria no meio (antes de total_pago/saldo) -- por isso dropa
-- e recria.
drop view pagamentos_saldo;
create view pagamentos_saldo as
select
  p.*,
  coalesce(b.total_pago, 0) as total_pago,
  p.valor - coalesce(b.total_pago, 0) as saldo
from pagamentos p
left join (
  select pagamento_id, sum(valor) as total_pago
  from pagamento_baixas group by pagamento_id
) b on b.pagamento_id = p.id;

alter view pagamentos_saldo set (security_invoker = true);

create or replace function registrar_baixa_com_juros(
  p_pagamento_id uuid,
  p_data_pagamento date,
  p_valor numeric,
  p_banco_id uuid,
  p_cp smallint,
  p_cd_juros smallint default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_pag record;
  v_juros numeric(14,2);
  v_novo_id uuid;
begin
  select * into v_pag from pagamentos_saldo where id = p_pagamento_id;
  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;

  -- security definer pula o RLS: confere o acesso aqui pra nao virar brecha.
  if not acesso_empresa(v_pag.empresa_id) then
    raise exception 'Sem acesso a esta empresa.';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor válido.';
  end if;

  if p_valor <= v_pag.saldo + 0.01 then
    -- Caminho normal: paga ate o saldo, sem juro.
    insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor, banco_id, cp)
    values (v_pag.empresa_id, p_pagamento_id, p_data_pagamento, p_valor, p_banco_id, p_cp);
    return;
  end if;

  -- Passou do saldo: quita a conta original pelo que falta e joga a
  -- diferenca como um lancamento novo de juro, ja pago, na competencia do
  -- pagamento (nao da conta original).
  if p_cd_juros is null then
    raise exception 'Informe o código de despesa do juro.';
  end if;

  v_juros := round(p_valor - v_pag.saldo, 2);

  insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor, banco_id, cp)
  values (v_pag.empresa_id, p_pagamento_id, p_data_pagamento, v_pag.saldo, p_banco_id, p_cp);

  insert into pagamentos (
    empresa_id, loja_id, vencimento, cfc, cd, descricao,
    comp_mes, comp_ano, valor, banco_id, cp, gerado_por_juros_de
  ) values (
    v_pag.empresa_id, v_pag.loja_id, p_data_pagamento, v_pag.cfc, p_cd_juros,
    'Juros - ' || coalesce(nullif(v_pag.descricao, ''), 'lançamento'),
    extract(month from p_data_pagamento)::smallint, extract(year from p_data_pagamento)::smallint,
    v_juros, p_banco_id, p_cp, p_pagamento_id
  ) returning id into v_novo_id;

  insert into pagamento_baixas (empresa_id, pagamento_id, data_pagamento, valor, banco_id, cp)
  values (v_pag.empresa_id, v_novo_id, p_data_pagamento, v_juros, p_banco_id, p_cp);
end $$;

comment on function registrar_baixa_com_juros is
  'Registra uma baixa; se o valor pago exceder o saldo, cria automaticamente um lancamento de juro (pago) na competencia do pagamento.';
