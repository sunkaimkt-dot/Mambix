-- Todo usuario novo enxerga a Empresa Demonstração (ambiente de teste).
-- Em producao, o vinculo passa a ser feito manualmente pelo consultor.
create or replace function trg_vincula_demo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into empresa_usuarios (empresa_id, user_id)
  select e.id, new.user_id from empresas e where e.nome = 'Empresa Demonstração'
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_perfil_created on perfis;
create trigger on_perfil_created
after insert on perfis
for each row execute function trg_vincula_demo();

-- Backfill para quem ja existe
insert into empresa_usuarios (empresa_id, user_id)
select e.id, p.user_id
from empresas e cross join perfis p
where e.nome = 'Empresa Demonstração'
on conflict do nothing;
