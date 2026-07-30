-- Corrige as politicas: quem pertence a empresa tambem pode lancar,
-- nao apenas o consultor. Separa por operacao e usa WITH CHECK explicito.

do $do$
declare t text;
declare tabelas text[] := array[
  'lojas','codigos_despesa','codigos_familia','formas_pagamento','tipos_recebimento',
  'tipos_venda','bancos','pagamentos','receitas','caixa_diario','parametros_mes'
];
begin
  foreach t in array tabelas loop
    execute format('drop policy if exists %I_sel on %I', t, t);
    execute format('drop policy if exists %I_adm on %I', t, t);

    execute format($f$
      create policy %1$I_leitura on %1$I for select
      using (meu_papel() = 'consultor' or empresa_id in (select minhas_empresas()))
    $f$, t);

    execute format($f$
      create policy %1$I_insercao on %1$I for insert
      with check (meu_papel() = 'consultor' or empresa_id in (select minhas_empresas()))
    $f$, t);

    execute format($f$
      create policy %1$I_atualizacao on %1$I for update
      using (meu_papel() = 'consultor' or empresa_id in (select minhas_empresas()))
      with check (meu_papel() = 'consultor' or empresa_id in (select minhas_empresas()))
    $f$, t);

    execute format($f$
      create policy %1$I_exclusao on %1$I for delete
      using (meu_papel() = 'consultor' or empresa_id in (select minhas_empresas()))
    $f$, t);
  end loop;
end
$do$;

-- Empresas: leitura para membros, escrita apenas para consultor
drop policy if exists empresas_sel on empresas;
drop policy if exists empresas_adm on empresas;
create policy empresas_leitura on empresas for select
  using (meu_papel() = 'consultor' or id in (select minhas_empresas()));
create policy empresas_escrita on empresas for all
  using (meu_papel() = 'consultor') with check (meu_papel() = 'consultor');

-- Perfis: cada um le o seu; consultor administra
drop policy if exists perfis_proprio on perfis;
drop policy if exists perfis_consultor_admin on perfis;
create policy perfis_leitura on perfis for select
  using (user_id = auth.uid() or meu_papel() = 'consultor');
create policy perfis_escrita on perfis for all
  using (meu_papel() = 'consultor') with check (meu_papel() = 'consultor');
