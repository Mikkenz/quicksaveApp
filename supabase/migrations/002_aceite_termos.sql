-- Quicksave App · 002_aceite_termos.sql
-- Guarda a versão e a data em que cada pessoa aceitou os termos de uso e a política de privacidade.
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 001_base.sql.

alter table public.profile_private
  add column if not exists terms_version text check (char_length(terms_version) <= 20),
  add column if not exists terms_accepted_at timestamptz;

-- Cadastro por e-mail: o app manda a versão aceita nos metadados (terms_version)
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
  v_terms text := left(nullif(trim(meta ->> 'terms_version'), ''), 20);
begin
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

  insert into public.profile_private (id, birth_date, guardian_email, terms_version, terms_accepted_at)
  values (
    new.id,
    v_birth,
    left(nullif(trim(meta ->> 'guardian_email'), ''), 254),
    v_terms,
    case when v_terms is not null then now() end
  );

  return new;
end;
$$;

-- Completar perfil agora também registra o aceite (obrigatório).
-- A versão antiga, com 3 parâmetros, sai para não ficar um caminho sem aceite.
drop function if exists public.complete_profile(text, date, text);

create or replace function public.complete_profile(
  p_username text,
  p_birth_date date,
  p_guardian_email text,
  p_terms_version text
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
  v_terms text := nullif(trim(p_terms_version), '');
begin
  if v_uid is null then
    raise exception 'Precisa estar logado';
  end if;
  if v_terms is null or char_length(v_terms) > 20 then
    raise exception 'termos_obrigatorios';
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
  if p_birth_date > (current_date - interval '12 years') and (v_guardian is null or v_guardian !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'responsavel_obrigatorio';
  end if;

  update public.profiles set username = v_username where id = v_uid;
  update public.profile_private
     set birth_date = p_birth_date,
         guardian_email = case when p_birth_date > (current_date - interval '12 years') then left(v_guardian, 254) else null end,
         terms_version = v_terms,
         terms_accepted_at = now()
   where id = v_uid;
end;
$$;

revoke all on function public.complete_profile(text, date, text, text) from public;
grant execute on function public.complete_profile(text, date, text, text) to authenticated;
