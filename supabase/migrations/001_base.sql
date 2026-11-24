-- Quicksave App · 001_base.sql
-- Perfis, dados privados (data de nascimento e responsável), criação automática no cadastro e RLS.
-- Rodar uma vez no SQL Editor do projeto Supabase DO APP (não no do site).

-- ---------------------------------------------------------------
-- Perfil público: qualquer pessoa logada pode ler
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 50),
  avatar_url text check (char_length(avatar_url) <= 500),
  bio text check (char_length(bio) <= 160),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Dados privados: só o dono lê. Ninguém escreve direto (só pelas funções abaixo)
-- ---------------------------------------------------------------
create table if not exists public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date check (birth_date >= date '1900-01-01'),
  guardian_email text check (char_length(guardian_email) <= 254),
  guardian_consent_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists profile_private_updated_at on public.profile_private;
create trigger profile_private_updated_at before update on public.profile_private
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Cria o perfil quando alguém se cadastra (e-mail ou Google)
-- No cadastro por e-mail, o app manda username, display_name e birth_date nos metadados.
-- No Google, vem nome e foto; o @ e a data são preenchidos depois em "Completar perfil".
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := nullif(lower(trim(meta ->> 'username')), '');
  v_birth date;
begin
  -- @ inválido ou já usado: deixa vazio e a pessoa escolhe em "Completar perfil"
  if v_username is not null and (
    v_username !~ '^[a-z0-9_]{3,20}$'
    or exists (select 1 from public.profiles p where p.username = v_username)
  ) then
    v_username := null;
  end if;

  begin
    v_birth := (meta ->> 'birth_date')::date;
    if v_birth < date '1900-01-01' or v_birth > current_date then
      v_birth := null;
    end if;
  exception when others then
    v_birth := null;
  end;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_username,
    left(coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name'), 50),
    left(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), 500)
  );

  insert into public.profile_private (id, birth_date, guardian_email)
  values (new.id, v_birth, left(nullif(trim(meta ->> 'guardian_email'), ''), 254));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Funções que o app chama
-- ---------------------------------------------------------------

-- O @ está livre? (usada na tela de cadastro, antes de ter login)
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

-- Completar perfil (depois do Google, ou se o @ do cadastro já estava em uso)
create or replace function public.complete_profile(
  p_username text,
  p_birth_date date,
  p_guardian_email text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := lower(trim(p_username));
  v_guardian text := nullif(trim(p_guardian_email), '');
begin
  if v_uid is null then
    raise exception 'Precisa estar logado';
  end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'usuario_invalido';
  end if;
  if exists (select 1 from public.profiles where username = v_username and id <> v_uid) then
    raise exception 'usuario_em_uso';
  end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > current_date then
    raise exception 'data_invalida';
  end if;
  -- Menores de 12 anos: e-mail do responsável é obrigatório
  if p_birth_date > (current_date - interval '12 years') and (v_guardian is null or v_guardian !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'responsavel_obrigatorio';
  end if;

  update public.profiles set username = v_username where id = v_uid;
  update public.profile_private
     set birth_date = p_birth_date,
         guardian_email = case when p_birth_date > (current_date - interval '12 years') then left(v_guardian, 254) else null end
   where id = v_uid;
end;
$$;

-- A pessoa logada é admin? (usada nas próximas fases e no admin do site)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.username_available(text) from public;
revoke all on function public.complete_profile(text, date, text) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.complete_profile(text, date, text) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

-- Tira tudo e devolve só o necessário
revoke all on public.profiles from anon, authenticated;
revoke all on public.profile_private from anon, authenticated;

grant select on public.profiles to authenticated;
-- O próprio usuário só pode mudar estes campos (role e username ficam de fora)
grant update (display_name, avatar_url, bio) on public.profiles to authenticated;
grant select on public.profile_private to authenticated;

drop policy if exists "perfis visiveis para logados" on public.profiles;
create policy "perfis visiveis para logados" on public.profiles
  for select to authenticated using (true);

drop policy if exists "cada um edita o seu perfil" on public.profiles;
create policy "cada um edita o seu perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "dados privados so do dono" on public.profile_private;
create policy "dados privados so do dono" on public.profile_private
  for select to authenticated using (id = (select auth.uid()));
-- O "unique" em username já cria o índice usado na busca por @.
