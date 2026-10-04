-- MAMBIX - CHAT DE DUVIDAS: REGISTRO DAS PERGUNTAS
--
-- Cada pergunta feita ao assistente "Dúvidas?" fica registrada. Serve para:
--  * limitar o uso por pessoa (o plano gratuito da IA tem cota);
--  * a Mambix ver o que os clientes perguntam e melhorar telas e manual.
--
-- A pessoa grava e le so as proprias perguntas. Le tudo: o dono da plataforma
-- e os administradores da equipe Mambix.

create table if not exists ajuda_perguntas (
  id        bigint generated always as identity primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tela      text check (tela is null or tela ~ '^[a-z0-9-]{1,40}$'),
  pergunta  text not null check (char_length(pergunta) between 1 and 1000),
  resposta  text check (resposta is null or char_length(resposta) <= 8000),
  criado_em timestamptz not null default now()
);

create index if not exists ajuda_perguntas_user_data on ajuda_perguntas (user_id, criado_em desc);

alter table ajuda_perguntas enable row level security;

drop policy if exists ajuda_perguntas_grava on ajuda_perguntas;
create policy ajuda_perguntas_grava on ajuda_perguntas for insert
  with check (user_id = auth.uid());

drop policy if exists ajuda_perguntas_le on ajuda_perguntas;
create policy ajuda_perguntas_le on ajuda_perguntas for select
  using (
    user_id = auth.uid()
    or meu_papel() = 'plataforma'
    or (meu_papel() = 'gestor' and minha_funcao() = 'admin')
  );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert on ajuda_perguntas to authenticated;
  end if;
end $$;
