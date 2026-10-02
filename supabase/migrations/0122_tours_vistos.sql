-- MAMBIX - TOUR GUIADO: QUEM JA VIU O TOUR DE QUAL TELA
--
-- O tour de cada tela aparece sozinho no PRIMEIRO acesso da pessoa a ela.
-- Guardar isso no banco (e nao no navegador) faz o tour nao reaparecer quando
-- a pessoa troca de computador ou abre pelo celular. Rever e sempre possivel
-- pelo botao "Tour guiado" da tela -- isso nao depende desta tabela.

create table if not exists tours_vistos (
  user_id  uuid not null references auth.users(id) on delete cascade,
  tela     text not null check (tela ~ '^[a-z0-9-]{1,40}$'),
  visto_em timestamptz not null default now(),
  primary key (user_id, tela)
);

alter table tours_vistos enable row level security;

-- Cada um so enxerga e grava o proprio registro.
drop policy if exists tours_vistos_proprio on tours_vistos;
create policy tours_vistos_proprio on tours_vistos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on tours_vistos to authenticated;
  end if;
end $$;
