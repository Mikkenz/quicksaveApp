-- Quicksave App · 003_jogos.sql
-- Jogos (cache do IGDB), registros, histórico (eventos), favoritos e o que a função "igdb" precisa.
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 002.

-- ---------------------------------------------------------------
-- Cache dos jogos usados (não copiamos o catálogo inteiro do IGDB)
-- Só o servidor (Edge Function "igdb") escreve aqui.
-- ---------------------------------------------------------------
create table if not exists public.games (
  igdb_id integer primary key,
  name text not null,
  slug text,
  cover_image_id text,
  first_release date,
  platforms text[] not null default '{}',
  genres text[] not null default '{}',
  developer text,
  summary text,
  detailed boolean not null default false, -- true quando já buscamos a ficha completa
  fetched_at timestamptz not null default now()
);

-- Buscas guardadas por 24 h (a mesma busca não gasta o IGDB de novo)
create table if not exists public.igdb_search_cache (
  q text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Token de acesso da Twitch (renovado pela função)
create table if not exists public.igdb_token (
  id smallint primary key default 1 check (id = 1),
  token text not null,
  expires_at timestamptz not null
);

-- Limite de buscas por pessoa (janelas de 1 minuto)
create table if not exists public.igdb_rate (
  user_id uuid not null references auth.users (id) on delete cascade,
  minute timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, minute)
);

-- Soma 1 pedido e diz se a pessoa ainda está dentro do limite. Só a função "igdb" chama.
create or replace function public.igdb_rate_hit(p_user uuid, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min timestamptz := date_trunc('minute', now());
  v_hits integer;
begin
  insert into public.igdb_rate (user_id, minute, hits) values (p_user, v_min, 1)
  on conflict (user_id, minute) do update set hits = public.igdb_rate.hits + 1
  returning hits into v_hits;
  -- limpeza leve das janelas antigas
  delete from public.igdb_rate where minute < now() - interval '10 minutes';
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------
-- Registros: o estado atual de cada jogo para cada pessoa
-- ---------------------------------------------------------------
create table if not exists public.logs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id integer not null references public.games (igdb_id),
  status text not null check (status in ('wishlist', 'playing', 'finished', 'dropped')),
  platform text check (char_length(platform) <= 30),
  rating smallint check (rating between 1 and 10),
  review text check (char_length(review) <= 5000),
  has_spoilers boolean not null default false,
  visibility text not null default 'friends' check (visibility in ('friends', 'public')),
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index if not exists logs_user_updated_idx on public.logs (user_id, updated_at desc);
create index if not exists logs_game_public_idx on public.logs (game_id) where visibility = 'public';

-- Histórico (alimenta o feed na fase 3 e o Rewind na fase 4). Criado só pelos gatilhos.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  game_id integer not null,
  type text not null check (type in ('wishlisted', 'started', 'finished', 'dropped', 'rated', 'reviewed')),
  platform text,
  rating smallint,
  visibility text not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, game_id) references public.logs (user_id, game_id) on delete cascade
);

create index if not exists events_user_created_idx on public.events (user_id, created_at desc);
create index if not exists events_public_created_idx on public.events (created_at desc) where visibility = 'public';

-- Favoritos (até 4 por pessoa)
create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id integer not null references public.games (igdb_id),
  position smallint not null check (position between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (user_id, position),
  unique (user_id, game_id)
);

-- ---------------------------------------------------------------
-- Regras automáticas
-- ---------------------------------------------------------------

-- A pessoa tem menos de 18 anos?
create or replace function public.is_minor(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select birth_date > (current_date - interval '18 years') from public.profile_private where id = p_user),
    false
  );
$$;

-- Antes de salvar um registro: menores ficam sempre em "Amigos", datas automáticas e updated_at
create or replace function public.logs_before_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_minor(new.user_id) then
    new.visibility := 'friends';
  end if;
  if new.review is not null and btrim(new.review) = '' then
    new.review := null;
  end if;
  if new.status = 'playing' and new.started_at is null then
    new.started_at := current_date;
  end if;
  if new.status = 'finished' and new.finished_at is null then
    new.finished_at := current_date;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists logs_before_save on public.logs;
create trigger logs_before_save before insert or update on public.logs
  for each row execute function public.logs_before_save();

-- Depois de salvar: grava o que mudou no histórico
create or replace function public.logs_after_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    v_tipo := case new.status
      when 'wishlist' then 'wishlisted'
      when 'playing' then 'started'
      when 'finished' then 'finished'
      when 'dropped' then 'dropped'
    end;
    insert into public.events (user_id, game_id, type, platform, rating, visibility)
    values (new.user_id, new.game_id, v_tipo, new.platform, new.rating, new.visibility);
  end if;

  if new.rating is not null and (tg_op = 'INSERT' or new.rating is distinct from old.rating) then
    insert into public.events (user_id, game_id, type, platform, rating, visibility)
    values (new.user_id, new.game_id, 'rated', new.platform, new.rating, new.visibility);
  end if;

  if new.review is not null and (tg_op = 'INSERT' or old.review is null) then
    insert into public.events (user_id, game_id, type, platform, rating, visibility)
    values (new.user_id, new.game_id, 'reviewed', new.platform, new.rating, new.visibility);
  end if;

  -- Mudou a visibilidade: o histórico daquele jogo acompanha
  if tg_op = 'UPDATE' and new.visibility is distinct from old.visibility then
    update public.events set visibility = new.visibility
     where user_id = new.user_id and game_id = new.game_id;
  end if;

  return null;
end;
$$;

drop trigger if exists logs_after_save on public.logs;
create trigger logs_after_save after insert or update on public.logs
  for each row execute function public.logs_after_save();

-- Favoritar / desfavoritar (no máximo 4)
create or replace function public.toggle_favorite(p_game integer)
returns boolean -- true = ficou favorito
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pos smallint;
begin
  if v_uid is null then
    raise exception 'Precisa estar logado';
  end if;
  if exists (select 1 from public.favorites where user_id = v_uid and game_id = p_game) then
    delete from public.favorites where user_id = v_uid and game_id = p_game;
    return false;
  end if;
  if not exists (select 1 from public.games where igdb_id = p_game) then
    raise exception 'jogo_desconhecido';
  end if;
  select min(p) into v_pos
    from generate_series(1, 4) as p
   where p not in (select position from public.favorites where user_id = v_uid);
  if v_pos is null then
    raise exception 'favoritos_cheios';
  end if;
  insert into public.favorites (user_id, game_id, position) values (v_uid, p_game, v_pos);
  return true;
end;
$$;

-- Números de um jogo no Quicksave. A média usa só notas públicas, para não revelar notas privadas.
create or replace function public.game_stats(p_game integer)
returns table (media numeric, notas integer, registros integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    round(avg(rating) filter (where visibility = 'public' and rating is not null), 1),
    (count(*) filter (where visibility = 'public' and rating is not null))::integer,
    count(*)::integer
  from public.logs
  where game_id = p_game;
$$;

-- ---------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------
alter table public.games enable row level security;
alter table public.igdb_search_cache enable row level security;
alter table public.igdb_token enable row level security;
alter table public.igdb_rate enable row level security;
alter table public.logs enable row level security;
alter table public.events enable row level security;
alter table public.favorites enable row level security;

revoke all on public.games, public.igdb_search_cache, public.igdb_token, public.igdb_rate,
  public.logs, public.events, public.favorites from anon, authenticated;

-- Tabelas internas da função "igdb": nenhum acesso pelo app (só a chave secreta do servidor)
revoke all on function public.igdb_rate_hit(uuid, integer) from public, anon, authenticated;
revoke all on function public.logs_before_save() from public, anon, authenticated;
revoke all on function public.logs_after_save() from public, anon, authenticated;
revoke all on function public.is_minor(uuid) from public, anon, authenticated;
revoke all on function public.toggle_favorite(integer) from public;
revoke all on function public.game_stats(integer) from public;
grant execute on function public.toggle_favorite(integer) to authenticated;
grant execute on function public.game_stats(integer) to authenticated;

-- A função "igdb" usa a chave secreta (papel service_role)
grant select, insert, update, delete on public.games, public.igdb_search_cache, public.igdb_token, public.igdb_rate
  to service_role;
grant execute on function public.igdb_rate_hit(uuid, integer) to service_role;

-- Jogos: leitura para quem está logado
grant select on public.games to authenticated;
drop policy if exists "jogos para logados" on public.games;
create policy "jogos para logados" on public.games for select to authenticated using (true);

-- Registros: o dono faz tudo; os outros só leem os públicos (amigos entram na fase 3)
grant select, insert, update, delete on public.logs to authenticated;
drop policy if exists "ler registros" on public.logs;
create policy "ler registros" on public.logs for select to authenticated
  using (user_id = (select auth.uid()) or visibility = 'public');
drop policy if exists "criar o proprio registro" on public.logs;
create policy "criar o proprio registro" on public.logs for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "editar o proprio registro" on public.logs;
create policy "editar o proprio registro" on public.logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "apagar o proprio registro" on public.logs;
create policy "apagar o proprio registro" on public.logs for delete to authenticated
  using (user_id = (select auth.uid()));

-- Histórico: só leitura, com a mesma regra
grant select on public.events to authenticated;
drop policy if exists "ler eventos" on public.events;
create policy "ler eventos" on public.events for select to authenticated
  using (user_id = (select auth.uid()) or visibility = 'public');

-- Favoritos: aparecem no perfil para quem está logado; mudanças só pela função toggle_favorite
grant select on public.favorites to authenticated;
drop policy if exists "ler favoritos" on public.favorites;
create policy "ler favoritos" on public.favorites for select to authenticated using (true);
