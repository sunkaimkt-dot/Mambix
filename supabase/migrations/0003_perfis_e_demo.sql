-- Cria automaticamente um perfil quando um usuario se cadastra no Auth
create or replace function trg_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (user_id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    'empresario'
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function trg_novo_usuario();

-- Backfill: cria perfil para usuarios que ja existem
insert into perfis (user_id, nome, papel)
select id, split_part(email, '@', 1), 'empresario'
from auth.users
on conflict (user_id) do nothing;

-- Promove o consultor responsavel
update perfis set nome = 'Neto', papel = 'consultor'
where user_id in (select id from auth.users where email = 'suporte.dgficel@gmail.com');

-- Empresa de demonstracao (dispara o seed dos 100 codigos + loja matriz)
insert into empresas (nome)
select 'Empresa Demonstração'
where not exists (select 1 from empresas where nome = 'Empresa Demonstração');

-- Vincula todos os consultores a todas as empresas
insert into empresa_usuarios (empresa_id, user_id)
select e.id, p.user_id
from empresas e
cross join perfis p
where p.papel = 'consultor'
on conflict do nothing;

-- Bancos padrao para a empresa de demonstracao
insert into bancos (empresa_id, nome)
select e.id, b.nome
from empresas e
cross join (values ('CAIXA DA EMPRESA'),('BRADESCO'),('ITAÚ'),('SANTANDER'),('BANCO DO BRASIL'),('CAIXA ECONÔMICA')) as b(nome)
where e.nome = 'Empresa Demonstração'
  and not exists (select 1 from bancos x where x.empresa_id = e.id and x.nome = b.nome);
