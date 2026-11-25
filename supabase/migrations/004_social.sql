-- Quicksave App · 004_social.sql
-- Amizades, bloqueios, grupos privados, reações, comentários, curtidas em reviews, notificações,
-- feed (Amigos, grupo e Popular), horas jogadas e as novas regras de quem vê o quê.
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 003. Pode rodar de novo sem problema.

-- ---------------------------------------------------------------
-- Horas jogadas e marcação de review no histórico
-- ---------------------------------------------------------------
alter table public.logs add column if not exists hours_played integer check (hours_played between 0 and 9999);
alter table public.events add column if not exists with_review boolean not null default false;

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------

-- Amizade: um pedido por par de pessoas. "accepted" = amigos.
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_par_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee, status);

-- Bloqueios
create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked);

-- Grupos privados (até 20 pessoas, contando convites)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  description text check (char_length(description) <= 280),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('invited', 'member')),
  invited_by uuid references public.profiles (id) on delete set null,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id, status);

-- Reações nas atividades (uma por pessoa)
create table if not exists public.event_reactions (
  event_id bigint not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('curti', 'quero', 'gg')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Comentários nas atividades
create table if not exists public.event_comments (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists event_comments_event_idx on public.event_comments (event_id, id);
create index if not exists event_comments_user_idx on public.event_comments (user_id, created_at desc);

-- Curtidas em reviews
create table if not exists public.review_likes (
  owner_id uuid not null,
  game_id integer not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, game_id, user_id),
  foreign key (owner_id, game_id) references public.logs (user_id, game_id) on delete cascade
);

-- Notificações dentro do app
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'friend_request', 'friend_accepted', 'group_invite', 'reaction', 'comment', 'review_like', 'group_activity'
  )),
  event_id bigint references public.events (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  game_id integer references public.games (igdb_id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, id desc);

-- Tudo fechado: o app só usa estas tabelas pelas funções abaixo
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.event_reactions enable row level security;
alter table public.event_comments enable row level security;
alter table public.review_likes enable row level security;
alter table public.notifications enable row level security;
revoke all on public.friendships, public.blocks, public.groups, public.group_members, public.event_reactions,
  public.event_comments, public.review_likes, public.notifications from anon, authenticated;

-- ---------------------------------------------------------------
-- Funções auxiliares no esquema "private" (não ficam expostas na API do Supabase)
-- ---------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

create or replace function private.share_group(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members x
      join public.group_members y on y.group_id = x.group_id
     where x.user_id = a and y.user_id = b and x.status = 'member' and y.status = 'member'
  );
$$;

create or replace function private.blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
     where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- Menor de 12 sem autorização do responsável: ainda não pode fazer amizades nem interagir
create or replace function private.needs_guardian(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select pp.birth_date > (current_date - interval '12 years') and pp.guardian_consent_at is null
       from public.profile_private pp where pp.id = p_user),
    false
  );
$$;

-- Relação de "a" com "b": self, blocked (a bloqueou b), friends, sent, received, none
create or replace function private.relation(a uuid, b uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when a = b then 'self'
    when exists (select 1 from public.blocks where blocker = a and blocked = b) then 'blocked'
    when private.are_friends(a, b) then 'friends'
    when exists (select 1 from public.friendships where status = 'pending' and requester = a and addressee = b) then 'sent'
    when exists (select 1 from public.friendships where status = 'pending' and requester = b and addressee = a) then 'received'
    else 'none'
  end;
$$;

-- Quem está logado pode ver um registro (ou atividade) com esta visibilidade?
create or replace function private.can_see_log(p_owner uuid, p_visibility text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner = auth.uid()
      or (auth.uid() is not null
          and not private.blocked_between(auth.uid(), p_owner)
          and (p_visibility = 'public'
               or private.are_friends(auth.uid(), p_owner)
               or private.share_group(auth.uid(), p_owner)));
$$;

create or replace function private.can_see_event(p_event bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e where e.id = p_event and private.can_see_log(e.user_id, e.visibility)
  );
$$;

-- Perfil: adultos aparecem para todos; menores só para amigos, colegas de grupo e quem tem pedido com eles.
-- Quem bloqueou você some para você.
create or replace function private.can_see_profile(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_id = auth.uid()
      or (auth.uid() is not null
          and not exists (select 1 from public.blocks b where b.blocker = p_id and b.blocked = auth.uid())
          and (not public.is_minor(p_id)
               or private.are_friends(auth.uid(), p_id)
               or private.share_group(auth.uid(), p_id)
               or exists (select 1 from public.friendships f
                           where f.status = 'pending'
                             and ((f.requester = p_id and f.addressee = auth.uid())
                               or (f.requester = auth.uid() and f.addressee = p_id)))));
$$;

-- Favoritos de menores: só para amigos e colegas de grupo
create or replace function private.can_see_favorites(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_see_profile(p_user)
     and (p_user = auth.uid()
          or not public.is_minor(p_user)
          or private.are_friends(auth.uid(), p_user)
          or private.share_group(auth.uid(), p_user));
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.can_see_log(uuid, text) to authenticated;
grant execute on function private.can_see_profile(uuid) to authenticated;
grant execute on function private.can_see_favorites(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Novas regras de leitura (RLS)
-- ---------------------------------------------------------------
drop policy if exists "perfis visiveis para logados" on public.profiles;
drop policy if exists "ver perfis" on public.profiles;
create policy "ver perfis" on public.profiles for select to authenticated
  using (private.can_see_profile(id));

drop policy if exists "ler registros" on public.logs;
create policy "ler registros" on public.logs for select to authenticated
  using (private.can_see_log(user_id, visibility));

drop policy if exists "ler eventos" on public.events;
create policy "ler eventos" on public.events for select to authenticated
  using (private.can_see_log(user_id, visibility));

drop policy if exists "ler favoritos" on public.favorites;
create policy "ler favoritos" on public.favorites for select to authenticated
  using (private.can_see_favorites(user_id));

-- ---------------------------------------------------------------
-- Histórico: uma atividade por vez que a pessoa salva.
-- Mudanças no mesmo jogo em até 10 minutos viram uma atividade só
-- (ex.: marcar "Zerei", dar nota e escrever review aparece como um cartão no feed).
-- ---------------------------------------------------------------
create or replace function public.logs_after_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status_mudou boolean := tg_op = 'INSERT' or new.status is distinct from old.status;
  v_review_nova boolean := new.review is not null and (tg_op = 'INSERT' or old.review is null);
  v_nota_mudou boolean := new.rating is not null and (tg_op = 'INSERT' or new.rating is distinct from old.rating);
  v_tipo text;
  v_ultimo bigint;
begin
  -- Mudou a visibilidade: o histórico daquele jogo acompanha
  if tg_op = 'UPDATE' and new.visibility is distinct from old.visibility then
    update public.events set visibility = new.visibility
     where user_id = new.user_id and game_id = new.game_id;
  end if;

  if not (v_status_mudou or v_review_nova or v_nota_mudou) then
    return null;
  end if;

  v_tipo := case
    when v_status_mudou then case new.status
      when 'wishlist' then 'wishlisted'
      when 'playing' then 'started'
      when 'finished' then 'finished'
      when 'dropped' then 'dropped'
    end
    when v_review_nova then 'reviewed'
    else 'rated'
  end;

  -- Atividade recente do mesmo jogo, ainda sem reações nem comentários: junta nela
  select e.id into v_ultimo
    from public.events e
   where e.user_id = new.user_id and e.game_id = new.game_id
     and e.created_at > now() - interval '10 minutes'
     and not exists (select 1 from public.event_reactions r where r.event_id = e.id)
     and not exists (select 1 from public.event_comments c where c.event_id = e.id)
   order by e.id desc
   limit 1;

  if v_ultimo is not null then
    update public.events set
      type = case
        when v_status_mudou then v_tipo
        when v_tipo = 'reviewed' and type = 'rated' then 'reviewed'
        else type
      end,
      platform = new.platform,
      rating = new.rating,
      with_review = with_review or v_review_nova,
      visibility = new.visibility
     where id = v_ultimo;
  else
    insert into public.events (user_id, game_id, type, platform, rating, visibility, with_review)
    values (new.user_id, new.game_id, v_tipo, new.platform, new.rating, new.visibility, v_review_nova);
  end if;

  return null;
end;
$$;

-- Atividade nova de alguém: avisa os colegas de grupo que deixaram os avisos ligados
create or replace function public.events_notify_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type not in ('started', 'finished', 'dropped', 'reviewed') then
    return null;
  end if;
  insert into public.notifications (user_id, actor_id, type, event_id, group_id, game_id)
  select distinct on (outro.user_id) outro.user_id, new.user_id, 'group_activity', new.id, outro.group_id, new.game_id
    from public.group_members eu
    join public.group_members outro on outro.group_id = eu.group_id
   where eu.user_id = new.user_id and eu.status = 'member'
     and outro.status = 'member' and outro.notify
     and outro.user_id <> new.user_id
     and not private.blocked_between(outro.user_id, new.user_id)
   order by outro.user_id;
  return null;
end;
$$;

drop trigger if exists events_notify_groups on public.events;
create trigger events_notify_groups after insert on public.events
  for each row execute function public.events_notify_groups();

-- ---------------------------------------------------------------
-- Pessoas e amizades
-- ---------------------------------------------------------------

-- Busca de pessoas. Menores só aparecem com o @ exato.
create or replace function public.search_profiles(p_q text)
returns table (id uuid, username text, display_name text, avatar_url text, relation text)
language sql stable security definer set search_path = '' as $$
  with q as (
    select lower(ltrim(btrim(coalesce(p_q, '')), '@')) as termo
  ), q2 as (
    select termo, replace(replace(replace(termo, '\', '\\'), '%', '\%'), '_', '\_') as seguro from q
  )
  select p.id, p.username, p.display_name, p.avatar_url, private.relation(auth.uid(), p.id)
    from public.profiles p, q2
   where auth.uid() is not null
     and char_length(q2.termo) >= 2
     and p.username is not null
     and p.id <> auth.uid()
     and not private.blocked_between(auth.uid(), p.id)
     and (p.username = q2.termo
          or (not public.is_minor(p.id)
              and (p.username like q2.seguro || '%' or lower(p.display_name) like '%' || q2.seguro || '%')))
   order by (p.username = q2.termo) desc, p.username
   limit 20;
$$;

-- Perfil de outra pessoa. "limited" = menor que não é sua amiga: só @ e foto.
create or replace function public.profile_view(p_username text)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, relation text, limited boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username,
         case when x.lim then null else p.display_name end,
         p.avatar_url,
         case when x.lim then null else p.bio end,
         private.relation(auth.uid(), p.id),
         x.lim
    from public.profiles p
   cross join lateral (
     select public.is_minor(p.id)
            and not (p.id = auth.uid()
                     or private.are_friends(auth.uid(), p.id)
                     or private.share_group(auth.uid(), p.id)) as lim
   ) x
   where auth.uid() is not null
     and p.username = lower(ltrim(btrim(p_username), '@'))
     and not exists (select 1 from public.blocks b where b.blocker = p.id and b.blocked = auth.uid());
$$;

create or replace function public.send_friend_request(p_user uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships%rowtype;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if p_user is null or p_user = v_uid
     or not exists (select 1 from public.profiles where id = p_user and username is not null) then
    raise exception 'pessoa_nao_encontrada';
  end if;
  if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
  if private.needs_guardian(p_user) or private.blocked_between(v_uid, p_user) then
    raise exception 'nao_disponivel';
  end if;

  select * into v_row from public.friendships
   where (requester = v_uid and addressee = p_user) or (requester = p_user and addressee = v_uid);
  if found then
    if v_row.status = 'accepted' then return 'friends'; end if;
    if v_row.requester = v_uid then return 'sent'; end if;
    -- A outra pessoa já tinha pedido: vira amizade
    update public.friendships set status = 'accepted', accepted_at = now()
     where requester = p_user and addressee = v_uid;
    delete from public.notifications where user_id = v_uid and actor_id = p_user and type = 'friend_request';
    insert into public.notifications (user_id, actor_id, type) values (p_user, v_uid, 'friend_accepted');
    return 'friends';
  end if;

  if (select count(*) from public.friendships where requester = v_uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'limite_pedidos_dia';
  end if;
  if (select count(*) from public.friendships where requester = v_uid and status = 'pending') >= 50 then
    raise exception 'limite_pedidos_pendentes';
  end if;

  insert into public.friendships (requester, addressee) values (v_uid, p_user);
  insert into public.notifications (user_id, actor_id, type) values (p_user, v_uid, 'friend_request');
  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if not exists (select 1 from public.friendships where requester = p_user and addressee = v_uid and status = 'pending') then
    raise exception 'pedido_nao_encontrado';
  end if;
  delete from public.notifications where user_id = v_uid and actor_id = p_user and type = 'friend_request';
  if p_accept then
    if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
    update public.friendships set status = 'accepted', accepted_at = now()
     where requester = p_user and addressee = v_uid;
    insert into public.notifications (user_id, actor_id, type) values (p_user, v_uid, 'friend_accepted');
    return 'friends';
  end if;
  delete from public.friendships where requester = p_user and addressee = v_uid;
  return 'none';
end;
$$;

-- Desfaz amizade ou cancela pedido enviado
create or replace function public.remove_friend(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  delete from public.friendships
   where (requester = v_uid and addressee = p_user) or (requester = p_user and addressee = v_uid);
  delete from public.notifications where user_id = p_user and actor_id = v_uid and type = 'friend_request';
end;
$$;

create or replace function public.block_user(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if p_user is null or p_user = v_uid then raise exception 'pessoa_nao_encontrada'; end if;
  insert into public.blocks (blocker, blocked) values (v_uid, p_user) on conflict do nothing;
  delete from public.friendships
   where (requester = v_uid and addressee = p_user) or (requester = p_user and addressee = v_uid);
  delete from public.notifications
   where (user_id = v_uid and actor_id = p_user) or (user_id = p_user and actor_id = v_uid);
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker = auth.uid() and blocked = p_user;
$$;

create or replace function public.my_friends()
returns table (id uuid, username text, display_name text, avatar_url text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_url, f.accepted_at
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())
   order by lower(coalesce(p.display_name, p.username));
$$;

create or replace function public.friend_requests()
returns table (id uuid, username text, display_name text, avatar_url text, direction text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_url,
         case when f.addressee = auth.uid() then 'received' else 'sent' end,
         f.created_at
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where f.status = 'pending' and (f.requester = auth.uid() or f.addressee = auth.uid())
   order by f.created_at desc;
$$;

create or replace function public.my_blocks()
returns table (id uuid, username text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.avatar_url, b.created_at
    from public.blocks b join public.profiles p on p.id = b.blocked
   where b.blocker = auth.uid()
   order by b.created_at desc;
$$;

-- ---------------------------------------------------------------
-- Grupos privados
-- ---------------------------------------------------------------
create or replace function public.create_group(p_name text, p_description text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
  if (select count(*) from public.groups where owner_id = v_uid) >= 10 then raise exception 'limite_grupos'; end if;
  insert into public.groups (name, description, owner_id)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), v_uid)
  returning id into v_id;
  insert into public.group_members (group_id, user_id, status, joined_at) values (v_id, v_uid, 'member', now());
  return v_id;
end;
$$;

create or replace function public.update_group(p_group uuid, p_name text, p_description text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.groups
     set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), '')
   where id = p_group and owner_id = auth.uid();
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

create or replace function public.invite_to_group(p_group uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id = v_uid and status = 'member') then
    raise exception 'sem_acesso';
  end if;
  if not private.are_friends(v_uid, p_user) or private.needs_guardian(p_user) then
    raise exception 'so_amigos';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group and user_id = p_user) then
    return;
  end if;
  if (select count(*) from public.group_members where group_id = p_group) >= 20 then
    raise exception 'grupo_cheio';
  end if;
  insert into public.group_members (group_id, user_id, status, invited_by) values (p_group, p_user, 'invited', v_uid);
  insert into public.notifications (user_id, actor_id, type, group_id) values (p_user, v_uid, 'group_invite', p_group);
end;
$$;

create or replace function public.respond_group_invite(p_group uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id = v_uid and status = 'invited') then
    raise exception 'convite_nao_encontrado';
  end if;
  delete from public.notifications where user_id = v_uid and group_id = p_group and type = 'group_invite';
  if p_accept then
    if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
    update public.group_members set status = 'member', joined_at = now()
     where group_id = p_group and user_id = v_uid;
  else
    delete from public.group_members where group_id = p_group and user_id = v_uid;
  end if;
end;
$$;

-- Sair do grupo. Se quem sai é o dono, o membro mais antigo vira dono; sem ninguém, o grupo é apagado.
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_novo uuid;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if exists (select 1 from public.groups where id = p_group and owner_id = v_uid) then
    select user_id into v_novo from public.group_members
     where group_id = p_group and user_id <> v_uid and status = 'member'
     order by joined_at nulls last, created_at
     limit 1;
    if v_novo is null then
      delete from public.groups where id = p_group;
      return;
    end if;
    update public.groups set owner_id = v_novo where id = p_group;
  end if;
  delete from public.group_members where group_id = p_group and user_id = v_uid;
end;
$$;

create or replace function public.remove_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.groups where id = p_group and owner_id = auth.uid()) or p_user = auth.uid() then
    raise exception 'sem_acesso';
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  delete from public.notifications where user_id = p_user and group_id = p_group and type = 'group_invite';
end;
$$;

create or replace function public.delete_group(p_group uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.groups where id = p_group and owner_id = auth.uid();
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

create or replace function public.set_group_notify(p_group uuid, p_on boolean)
returns void
language sql security definer set search_path = '' as $$
  update public.group_members set notify = p_on where group_id = p_group and user_id = auth.uid();
$$;

create or replace function public.my_groups()
returns table (id uuid, name text, description text, owner_id uuid, my_status text, members integer, notify boolean, invited_by text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.description, g.owner_id, m.status,
         (select count(*) from public.group_members x where x.group_id = g.id and x.status = 'member')::integer,
         m.notify,
         (select p.username from public.profiles p where p.id = m.invited_by)
    from public.group_members m
    join public.groups g on g.id = m.group_id
   where m.user_id = auth.uid()
   order by m.status desc, lower(g.name);
$$;

create or replace function public.group_members_list(p_group uuid)
returns table (user_id uuid, username text, display_name text, avatar_url text, status text, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_url, m.status, g.owner_id = p.id
    from public.group_members m
    join public.groups g on g.id = m.group_id
    join public.profiles p on p.id = m.user_id
   where m.group_id = p_group
     and exists (select 1 from public.group_members eu where eu.group_id = p_group and eu.user_id = auth.uid())
   order by (g.owner_id = p.id) desc, m.status desc, lower(coalesce(p.display_name, p.username));
$$;

-- ---------------------------------------------------------------
-- Feed: Amigos, um grupo ou uma atividade só
-- ---------------------------------------------------------------
create or replace function public.activity_feed(
  p_scope text,                 -- 'friends', 'group' ou 'event'
  p_group uuid default null,
  p_before bigint default null, -- para carregar mais: id da última atividade mostrada
  p_limit integer default 20,
  p_event bigint default null
)
returns table (
  event_id bigint, created_at timestamptz, type text,
  user_id uuid, username text, display_name text, avatar_url text,
  game_id integer, game_name text, cover_image_id text,
  rating smallint, platform text, hours_played integer, review text, has_spoilers boolean,
  reactions jsonb, my_reaction text, comments integer
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.created_at, e.type,
         p.id, p.username, p.display_name, p.avatar_url,
         g.igdb_id, g.name, g.cover_image_id,
         e.rating, e.platform,
         case when e.type in ('finished', 'dropped') then l.hours_played end,
         case when e.with_review then l.review end,
         l.has_spoilers,
         (select coalesce(jsonb_object_agg(x.kind, x.n), '{}'::jsonb)
            from (select r.kind, count(*) as n from public.event_reactions r where r.event_id = e.id group by r.kind) x),
         (select r.kind from public.event_reactions r where r.event_id = e.id and r.user_id = auth.uid()),
         (select count(*) from public.event_comments c where c.event_id = e.id)::integer
    from public.events e
    join public.profiles p on p.id = e.user_id
    join public.games g on g.igdb_id = e.game_id
    join public.logs l on l.user_id = e.user_id and l.game_id = e.game_id
   where auth.uid() is not null
     and not private.blocked_between(auth.uid(), e.user_id)
     and (p_before is null or e.id < p_before)
     and case p_scope
       when 'friends' then e.user_id in (
         select case when f.requester = auth.uid() then f.addressee else f.requester end
           from public.friendships f
          where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid()))
       when 'group' then
         exists (select 1 from public.group_members eu
                  where eu.group_id = p_group and eu.user_id = auth.uid() and eu.status = 'member')
         and e.user_id in (select m.user_id from public.group_members m where m.group_id = p_group and m.status = 'member')
       when 'event' then e.id = p_event and private.can_see_log(e.user_id, e.visibility)
       else false
     end
   order by e.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ---------------------------------------------------------------
-- Reações e comentários
-- ---------------------------------------------------------------
create or replace function public.react_to_event(p_event bigint, p_kind text)
returns text -- reação atual (null = tirou)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_atual text;
  v_dono uuid;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if p_kind not in ('curti', 'quero', 'gg') then raise exception 'reacao_invalida'; end if;
  if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
  if not private.can_see_event(p_event) then raise exception 'sem_acesso'; end if;

  select kind into v_atual from public.event_reactions where event_id = p_event and user_id = v_uid;
  if v_atual = p_kind then
    delete from public.event_reactions where event_id = p_event and user_id = v_uid;
    return null;
  end if;
  insert into public.event_reactions (event_id, user_id, kind) values (p_event, v_uid, p_kind)
  on conflict (event_id, user_id) do update set kind = excluded.kind, created_at = now();

  select e.user_id into v_dono from public.events e where e.id = p_event;
  if v_atual is null and v_dono <> v_uid
     and not exists (select 1 from public.notifications
                      where user_id = v_dono and actor_id = v_uid and type = 'reaction' and event_id = p_event) then
    insert into public.notifications (user_id, actor_id, type, event_id, game_id)
    select v_dono, v_uid, 'reaction', p_event, e.game_id from public.events e where e.id = p_event;
  end if;
  return p_kind;
end;
$$;

create or replace function public.add_comment(p_event bigint, p_body text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_dono uuid;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
  if not private.can_see_event(p_event) then raise exception 'sem_acesso'; end if;
  if (select count(*) from public.event_comments where user_id = v_uid and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'limite_comentarios';
  end if;
  insert into public.event_comments (event_id, user_id, body) values (p_event, v_uid, btrim(p_body))
  returning id into v_id;

  select e.user_id into v_dono from public.events e where e.id = p_event;
  if v_dono <> v_uid then
    insert into public.notifications (user_id, actor_id, type, event_id, game_id)
    select v_dono, v_uid, 'comment', p_event, e.game_id from public.events e where e.id = p_event;
  end if;
  return v_id;
end;
$$;

-- Apaga o próprio comentário, ou qualquer comentário na sua atividade
create or replace function public.delete_comment(p_id bigint)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.event_comments c
   where c.id = p_id
     and (c.user_id = auth.uid()
          or exists (select 1 from public.events e where e.id = c.event_id and e.user_id = auth.uid()));
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

create or replace function public.event_comments_list(p_event bigint)
returns table (id bigint, user_id uuid, username text, avatar_url text, body text, created_at timestamptz, can_delete boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, p.id, p.username, p.avatar_url, c.body, c.created_at,
         c.user_id = auth.uid() or e.user_id = auth.uid()
    from public.event_comments c
    join public.events e on e.id = c.event_id
    join public.profiles p on p.id = c.user_id
   where c.event_id = p_event
     and private.can_see_event(p_event)
     and not private.blocked_between(auth.uid(), c.user_id)
   order by c.id
   limit 200;
$$;

-- ---------------------------------------------------------------
-- Reviews: curtidas, reviews de um jogo e reviews em alta
-- ---------------------------------------------------------------
create or replace function public.toggle_review_like(p_owner uuid, p_game integer)
returns boolean -- true = ficou curtida
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if p_owner = v_uid then raise exception 'propria_review'; end if;
  if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
  if not exists (select 1 from public.logs l
                  where l.user_id = p_owner and l.game_id = p_game and l.review is not null
                    and private.can_see_log(l.user_id, l.visibility)) then
    raise exception 'sem_acesso';
  end if;
  if exists (select 1 from public.review_likes where owner_id = p_owner and game_id = p_game and user_id = v_uid) then
    delete from public.review_likes where owner_id = p_owner and game_id = p_game and user_id = v_uid;
    return false;
  end if;
  insert into public.review_likes (owner_id, game_id, user_id) values (p_owner, p_game, v_uid);
  if not exists (select 1 from public.notifications
                  where user_id = p_owner and actor_id = v_uid and type = 'review_like' and game_id = p_game) then
    insert into public.notifications (user_id, actor_id, type, game_id) values (p_owner, v_uid, 'review_like', p_game);
  end if;
  return true;
end;
$$;

-- Reviews de um jogo que você pode ver: amigos e colegas de grupo primeiro
create or replace function public.reviews_for_game(p_game integer, p_limit integer default 30)
returns table (
  user_id uuid, username text, display_name text, avatar_url text,
  rating smallint, review text, has_spoilers boolean, platform text, hours_played integer, updated_at timestamptz,
  is_friend boolean, likes integer, liked boolean
)
language sql stable security definer set search_path = '' as $$
  select l.user_id, p.username, p.display_name, p.avatar_url,
         l.rating, l.review, l.has_spoilers, l.platform,
         case when l.status in ('finished', 'dropped') then l.hours_played end,
         l.updated_at,
         private.are_friends(auth.uid(), l.user_id) or private.share_group(auth.uid(), l.user_id),
         (select count(*) from public.review_likes rl where rl.owner_id = l.user_id and rl.game_id = l.game_id)::integer,
         exists (select 1 from public.review_likes rl where rl.owner_id = l.user_id and rl.game_id = l.game_id and rl.user_id = auth.uid())
    from public.logs l
    join public.profiles p on p.id = l.user_id
   where l.game_id = p_game
     and l.review is not null
     and private.can_see_log(l.user_id, l.visibility)
   order by 11 desc, 12 desc, l.updated_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Popular: reviews públicas de adultos dos últimos 30 dias, pelas curtidas da semana
create or replace function public.trending_reviews(p_limit integer default 10)
returns table (
  user_id uuid, username text, display_name text, avatar_url text,
  game_id integer, game_name text, cover_image_id text,
  rating smallint, review text, has_spoilers boolean, updated_at timestamptz,
  likes integer, liked boolean
)
language sql stable security definer set search_path = '' as $$
  select l.user_id, p.username, p.display_name, p.avatar_url,
         g.igdb_id, g.name, g.cover_image_id,
         l.rating, l.review, l.has_spoilers, l.updated_at,
         (select count(*) from public.review_likes rl where rl.owner_id = l.user_id and rl.game_id = l.game_id)::integer,
         exists (select 1 from public.review_likes rl where rl.owner_id = l.user_id and rl.game_id = l.game_id and rl.user_id = auth.uid())
    from public.logs l
    join public.profiles p on p.id = l.user_id
    join public.games g on g.igdb_id = l.game_id
   where auth.uid() is not null
     and l.visibility = 'public'
     and l.review is not null
     and l.updated_at > now() - interval '30 days'
     and not public.is_minor(l.user_id)
     and not private.blocked_between(auth.uid(), l.user_id)
   order by (select count(*) from public.review_likes rl
              where rl.owner_id = l.user_id and rl.game_id = l.game_id and rl.created_at > now() - interval '7 days') desc,
            12 desc,
            l.updated_at desc
   limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

-- Popular: jogos com mais pessoas registrando nos últimos dias (só o número, sem dizer quem; sem menores)
create or replace function public.popular_games(p_days integer default 7, p_limit integer default 20)
returns table (game_id integer, name text, cover_image_id text, first_release date, players integer)
language sql stable security definer set search_path = '' as $$
  select g.igdb_id, g.name, g.cover_image_id, g.first_release, count(distinct e.user_id)::integer
    from public.events e
    join public.games g on g.igdb_id = e.game_id
   where auth.uid() is not null
     and e.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
     and e.type <> 'wishlisted'
     and not public.is_minor(e.user_id)
   group by g.igdb_id
   order by 5 desc, max(e.created_at) desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ---------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------
create or replace function public.my_notifications(p_limit integer default 50)
returns table (
  id bigint, type text, created_at timestamptz, read boolean,
  actor_username text, actor_avatar_url text,
  event_id bigint, event_type text, group_id uuid, group_name text, game_id integer, game_name text
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.type, n.created_at, n.read_at is not null,
         a.username, a.avatar_url,
         n.event_id, e.type, n.group_id, gr.name, n.game_id, g.name
    from public.notifications n
    left join public.profiles a on a.id = n.actor_id
    left join public.events e on e.id = n.event_id
    left join public.groups gr on gr.id = n.group_id
    left join public.games g on g.igdb_id = n.game_id
   where n.user_id = auth.uid()
     and (n.actor_id is null or not private.blocked_between(auth.uid(), n.actor_id))
   order by n.id desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- Marca tudo como lido e apaga avisos com mais de 90 dias
create or replace function public.mark_notifications_read()
returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
  delete from public.notifications where user_id = auth.uid() and created_at < now() - interval '90 days';
$$;

-- Números para os avisos nas abas
create or replace function public.badge_counts()
returns table (notifications integer, friend_requests integer, group_invites integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.notifications n where n.user_id = auth.uid() and n.read_at is null)::integer,
    (select count(*) from public.friendships f where f.addressee = auth.uid() and f.status = 'pending')::integer,
    (select count(*) from public.group_members m where m.user_id = auth.uid() and m.status = 'invited')::integer;
$$;

-- ---------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------
revoke all on function public.logs_after_save() from public, anon, authenticated;
revoke all on function public.events_notify_groups() from public, anon, authenticated;

revoke all on function
  public.search_profiles(text),
  public.profile_view(text),
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.my_friends(),
  public.friend_requests(),
  public.my_blocks(),
  public.create_group(text, text),
  public.update_group(uuid, text, text),
  public.invite_to_group(uuid, uuid),
  public.respond_group_invite(uuid, boolean),
  public.leave_group(uuid),
  public.remove_group_member(uuid, uuid),
  public.delete_group(uuid),
  public.set_group_notify(uuid, boolean),
  public.my_groups(),
  public.group_members_list(uuid),
  public.activity_feed(text, uuid, bigint, integer, bigint),
  public.react_to_event(bigint, text),
  public.add_comment(bigint, text),
  public.delete_comment(bigint),
  public.event_comments_list(bigint),
  public.toggle_review_like(uuid, integer),
  public.reviews_for_game(integer, integer),
  public.trending_reviews(integer),
  public.popular_games(integer, integer),
  public.my_notifications(integer),
  public.mark_notifications_read(),
  public.badge_counts()
from public, anon;

grant execute on function
  public.search_profiles(text),
  public.profile_view(text),
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.my_friends(),
  public.friend_requests(),
  public.my_blocks(),
  public.create_group(text, text),
  public.update_group(uuid, text, text),
  public.invite_to_group(uuid, uuid),
  public.respond_group_invite(uuid, boolean),
  public.leave_group(uuid),
  public.remove_group_member(uuid, uuid),
  public.delete_group(uuid),
  public.set_group_notify(uuid, boolean),
  public.my_groups(),
  public.group_members_list(uuid),
  public.activity_feed(text, uuid, bigint, integer, bigint),
  public.react_to_event(bigint, text),
  public.add_comment(bigint, text),
  public.delete_comment(bigint),
  public.event_comments_list(bigint),
  public.toggle_review_like(uuid, integer),
  public.reviews_for_game(integer, integer),
  public.trending_reviews(integer),
  public.popular_games(integer, integer),
  public.my_notifications(integer),
  public.mark_notifications_read(),
  public.badge_counts()
to authenticated;
