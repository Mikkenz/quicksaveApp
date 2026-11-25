-- Quicksave App · 006_comunidades.sql
-- Comunidades públicas (fórum por tema): tópicos, respostas, curtidas, moderação, banimentos e denúncias.
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 005. Pode rodar de novo sem problema.

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'),
  name text not null check (char_length(btrim(name)) between 3 and 50),
  description text check (char_length(description) <= 300),
  rules text check (char_length(rules) <= 2000),
  owner_id uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz, -- escondida pelo admin depois de denúncia
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'mod', 'member')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on public.community_members (user_id);

create table if not exists public.community_bans (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  banned_by uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.community_posts (
  id bigint generated always as identity primary key,
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'discussao' check (kind in ('discussao', 'indicacao', 'pergunta')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null default '' check (char_length(body) <= 5000),
  games integer[] not null default '{}' check (cardinality(games) <= 5),
  pinned boolean not null default false,
  locked boolean not null default false,
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz, -- escondido automaticamente com 3 denúncias, até a moderação analisar
  edited_at timestamptz,
  reply_count integer not null default 0,
  like_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists community_posts_list_idx on public.community_posts (community_id, pinned desc, last_activity_at desc);
create index if not exists community_posts_user_idx on public.community_posts (user_id, created_at desc);

create table if not exists public.community_replies (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  games integer[] not null default '{}' check (cardinality(games) <= 3),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz,
  edited_at timestamptz,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists community_replies_post_idx on public.community_replies (post_id, id);
create index if not exists community_replies_user_idx on public.community_replies (user_id, created_at desc);

create table if not exists public.post_likes (
  post_id bigint not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.reply_likes (
  reply_id bigint not null references public.community_replies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

-- Denúncias. target_id: id do tópico/resposta/comentário, id da comunidade ou do perfil,
-- e "dono:jogo" para reviews (ex.: "uuid:1942").
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'reply', 'community', 'comment', 'review', 'profile')),
  target_id text not null check (char_length(target_id) <= 80),
  community_id uuid references public.communities (id) on delete cascade,
  reason text not null check (reason in ('spam', 'ofensa', 'adulto', 'spoiler', 'outro')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists reports_target_idx on public.reports (target_type, target_id, status);
create index if not exists reports_community_idx on public.reports (community_id, status);

-- Notificações: respostas, ações da moderação e denúncias novas
alter table public.notifications add column if not exists post_id bigint references public.community_posts (id) on delete cascade;
alter table public.notifications add column if not exists community_id uuid references public.communities (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'friend_request', 'friend_accepted', 'group_invite', 'reaction', 'comment', 'review_like', 'group_activity',
  'post_reply', 'mod_action', 'report'
));

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_bans enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.post_likes enable row level security;
alter table public.reply_likes enable row level security;
alter table public.reports enable row level security;
revoke all on public.communities, public.community_members, public.community_bans, public.community_posts,
  public.community_replies, public.post_likes, public.reply_likes, public.reports from anon, authenticated;

-- ---------------------------------------------------------------
-- Auxiliares (esquema private, fora da API)
-- ---------------------------------------------------------------
create or replace function private.community_role(p_comm uuid, p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.community_members where community_id = p_comm and user_id = p_user;
$$;

create or replace function private.can_moderate(p_comm uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.community_role(p_comm, auth.uid()) in ('owner', 'mod'), false) or public.is_admin();
$$;

create or replace function private.is_banned(p_comm uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.community_bans where community_id = p_comm and user_id = p_user);
$$;

-- Pode postar e responder: adulto, membro e não banido
create or replace function private.can_post(p_comm uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and not public.is_minor(auth.uid())
     and not private.needs_guardian(auth.uid())
     and private.community_role(p_comm, auth.uid()) is not null
     and not private.is_banned(p_comm, auth.uid());
$$;

-- Jogos anexados: só os que já estão no cache (a busca do app guarda os jogos encontrados)
create or replace function private.valid_games(p_games integer[], p_max integer)
returns integer[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.id order by x.ord), '{}')
    from (
      select distinct on (u.id) u.id, u.ord
        from unnest(coalesce(p_games, '{}')) with ordinality as u(id, ord)
       where exists (select 1 from public.games g where g.igdb_id = u.id)
       order by u.id, u.ord
    ) x
   where x.ord <= 50
   limit 1;
$$;

create or replace function private.games_json(p_games integer[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', g.igdb_id, 'name', g.name, 'cover', g.cover_image_id)
              order by array_position(p_games, g.igdb_id)),
    '[]'::jsonb)
    from public.games g
   where g.igdb_id = any(coalesce(p_games, '{}'));
$$;

revoke all on all functions in schema private from public, anon;

-- ---------------------------------------------------------------
-- Comunidades
-- ---------------------------------------------------------------
create or replace function public.create_community(p_name text, p_slug text, p_description text, p_rules text)
returns text -- slug final
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_final text;
  v_id uuid;
  i integer := 1;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if public.is_minor(v_uid) or private.needs_guardian(v_uid) then raise exception 'so_adultos'; end if;
  if (select count(*) from public.communities where owner_id = v_uid) >= 3 then raise exception 'limite_comunidades'; end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{1,34})[a-z0-9]$' then raise exception 'endereco_invalido'; end if;

  v_final := v_slug;
  -- "nova" e "gerenciar" são endereços de telas do app
  while v_final in ('nova', 'gerenciar') or exists (select 1 from public.communities where slug = v_final) loop
    i := i + 1;
    if i > 20 then raise exception 'endereco_em_uso'; end if;
    v_final := v_slug || '-' || i;
  end loop;

  insert into public.communities (slug, name, description, rules, owner_id)
  values (v_final, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_rules, '')), ''), v_uid)
  returning id into v_id;
  insert into public.community_members (community_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_final;
end;
$$;

create or replace function public.update_community(p_id uuid, p_name text, p_description text, p_rules text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(private.community_role(p_id, auth.uid()), '') <> 'owner' then raise exception 'sem_acesso'; end if;
  update public.communities
     set name = btrim(p_name),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         rules = nullif(btrim(coalesce(p_rules, '')), '')
   where id = p_id;
end;
$$;

create or replace function public.delete_community(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(private.community_role(p_id, auth.uid()), '') <> 'owner' and not public.is_admin() then
    raise exception 'sem_acesso';
  end if;
  delete from public.communities where id = p_id;
end;
$$;

create or replace function public.join_community(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if private.needs_guardian(v_uid) then raise exception 'precisa_responsavel'; end if;
  if not exists (select 1 from public.communities where id = p_id and hidden_at is null) then raise exception 'comunidade_nao_encontrada'; end if;
  if private.is_banned(p_id, v_uid) then raise exception 'banido'; end if;
  insert into public.community_members (community_id, user_id) values (p_id, v_uid) on conflict do nothing;
end;
$$;

create or replace function public.leave_community(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.community_role(p_id, auth.uid()) = 'owner' then raise exception 'dono_nao_sai'; end if;
  delete from public.community_members where community_id = p_id and user_id = auth.uid();
end;
$$;

-- Atualiza quando a pessoa viu a comunidade pela última vez (para "tópicos novos")
create or replace function public.mark_community_seen(p_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.community_members set last_seen_at = now() where community_id = p_id and user_id = auth.uid();
$$;

create or replace function public.set_moderator(p_id uuid, p_user uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(private.community_role(p_id, auth.uid()), '') <> 'owner' or p_user = auth.uid() then raise exception 'sem_acesso'; end if;
  if private.community_role(p_id, p_user) is null then raise exception 'nao_e_membro'; end if;
  if p_on then
    if public.is_minor(p_user) then raise exception 'so_adultos'; end if;
    if (select count(*) from public.community_members where community_id = p_id and role = 'mod') >= 5 then
      raise exception 'limite_moderadores';
    end if;
    update public.community_members set role = 'mod' where community_id = p_id and user_id = p_user;
  else
    update public.community_members set role = 'member' where community_id = p_id and user_id = p_user;
  end if;
end;
$$;

create or replace function public.ban_member(p_id uuid, p_user uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_alvo text := private.community_role(p_id, p_user);
begin
  if not private.can_moderate(p_id) or p_user = auth.uid() then raise exception 'sem_acesso'; end if;
  -- Moderadores não banem o dono nem outros moderadores
  if v_alvo = 'owner' or (v_alvo = 'mod' and coalesce(private.community_role(p_id, auth.uid()), '') <> 'owner' and not public.is_admin()) then
    raise exception 'sem_acesso';
  end if;
  insert into public.community_bans (community_id, user_id, banned_by, reason)
  values (p_id, p_user, auth.uid(), nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (community_id, user_id) do nothing;
  delete from public.community_members where community_id = p_id and user_id = p_user;
end;
$$;

create or replace function public.unban_member(p_id uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_moderate(p_id) then raise exception 'sem_acesso'; end if;
  delete from public.community_bans where community_id = p_id and user_id = p_user;
end;
$$;

create or replace function public.community_view(p_slug text)
returns table (
  id uuid, slug text, name text, description text, rules text, created_at timestamptz,
  owner_username text, members integer, my_role text, banned boolean, can_post boolean, can_moderate boolean,
  open_reports integer
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.slug, c.name, c.description, c.rules, c.created_at,
         (select p.username from public.profiles p where p.id = c.owner_id),
         (select count(*) from public.community_members m where m.community_id = c.id)::integer,
         private.community_role(c.id, auth.uid()),
         private.is_banned(c.id, auth.uid()),
         private.can_post(c.id),
         private.can_moderate(c.id),
         case when private.can_moderate(c.id) then
           (select count(distinct (r.target_type, r.target_id)) from public.reports r
             where r.community_id = c.id and r.status = 'open')::integer
         else 0 end
    from public.communities c
   where auth.uid() is not null
     and c.slug = lower(btrim(p_slug))
     and not private.needs_guardian(auth.uid())
     and (c.hidden_at is null or public.is_admin());
$$;

create or replace function public.search_communities(p_q text)
returns table (id uuid, slug text, name text, description text, members integer, is_member boolean)
language sql stable security definer set search_path = '' as $$
  with q as (
    select replace(replace(replace(lower(btrim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select c.id, c.slug, c.name, c.description,
         (select count(*) from public.community_members m where m.community_id = c.id)::integer,
         private.community_role(c.id, auth.uid()) is not null
    from public.communities c, q
   where auth.uid() is not null
     and not private.needs_guardian(auth.uid())
     and c.hidden_at is null
     and char_length(q.t) >= 2
     and (lower(c.name) like '%' || q.t || '%' or c.slug like '%' || q.t || '%' or lower(coalesce(c.description, '')) like '%' || q.t || '%')
   order by (lower(c.name) like q.t || '%') desc, 5 desc
   limit 30;
$$;

-- Em alta: tópicos e respostas nos últimos 7 dias
create or replace function public.trending_communities(p_limit integer default 10)
returns table (id uuid, slug text, name text, description text, members integer, activity integer, is_member boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.slug, c.name, c.description,
         (select count(*) from public.community_members m where m.community_id = c.id)::integer,
         ((select count(*) from public.community_posts p
            where p.community_id = c.id and p.created_at > now() - interval '7 days' and p.removed_at is null)
          + (select count(*) from public.community_replies r join public.community_posts p on p.id = r.post_id
              where p.community_id = c.id and r.created_at > now() - interval '7 days' and r.removed_at is null))::integer,
         private.community_role(c.id, auth.uid()) is not null
    from public.communities c
   where auth.uid() is not null
     and not private.needs_guardian(auth.uid())
     and c.hidden_at is null
   order by 6 desc, 5 desc, c.created_at desc
   limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

create or replace function public.my_communities()
returns table (id uuid, slug text, name text, description text, members integer, my_role text, new_posts integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.slug, c.name, c.description,
         (select count(*) from public.community_members x where x.community_id = c.id)::integer,
         m.role,
         (select count(*) from public.community_posts p
           where p.community_id = c.id and p.created_at > m.last_seen_at and p.user_id <> auth.uid()
             and p.removed_at is null and p.hidden_at is null)::integer
    from public.community_members m
    join public.communities c on c.id = m.community_id
   where m.user_id = auth.uid() and c.hidden_at is null
   order by 7 desc, lower(c.name);
$$;

create or replace function public.community_members_list(p_id uuid)
returns table (user_id uuid, username text, display_name text, avatar_url text, role text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_url, m.role, m.joined_at
    from public.community_members m
    join public.profiles p on p.id = m.user_id
   where m.community_id = p_id
     and auth.uid() is not null
     and not private.blocked_between(auth.uid(), p.id)
     -- menores aparecem só para quem modera (para poder banir, se precisar)
     and (not public.is_minor(p.id) or p.id = auth.uid() or private.can_moderate(p_id))
   order by case m.role when 'owner' then 0 when 'mod' then 1 else 2 end, m.joined_at
   limit 300;
$$;

create or replace function public.community_bans_list(p_id uuid)
returns table (user_id uuid, username text, reason text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, b.reason, b.created_at
    from public.community_bans b join public.profiles p on p.id = b.user_id
   where b.community_id = p_id and private.can_moderate(p_id)
   order by b.created_at desc;
$$;

-- ---------------------------------------------------------------
-- Tópicos e respostas
-- ---------------------------------------------------------------
create or replace function public.create_post(p_community uuid, p_kind text, p_title text, p_body text, p_games integer[])
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if public.is_minor(v_uid) or private.needs_guardian(v_uid) then raise exception 'so_adultos'; end if;
  if private.is_banned(p_community, v_uid) then raise exception 'banido'; end if;
  if not private.can_post(p_community) then raise exception 'precisa_participar'; end if;
  if (select count(*) from public.community_posts where user_id = v_uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'limite_topicos';
  end if;
  insert into public.community_posts (community_id, user_id, kind, title, body, games)
  values (p_community, v_uid, coalesce(p_kind, 'discussao'), btrim(p_title), btrim(coalesce(p_body, '')),
          (private.valid_games(p_games, 5))[1:5])
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.edit_post(p_id bigint, p_kind text, p_title text, p_body text, p_games integer[])
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_posts
     set kind = coalesce(p_kind, kind), title = btrim(p_title), body = btrim(coalesce(p_body, '')),
         games = (private.valid_games(p_games, 5))[1:5], edited_at = now()
   where id = p_id and user_id = auth.uid() and removed_at is null;
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

-- O autor apaga o próprio tópico (fica "Removido pelo autor")
create or replace function public.delete_post(p_id bigint)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_posts set removed_at = now(), removed_by = auth.uid()
   where id = p_id and user_id = auth.uid() and removed_at is null;
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

create or replace function public.create_reply(p_post bigint, p_body text, p_games integer[])
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_post public.community_posts%rowtype;
  v_id bigint;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  select * into v_post from public.community_posts where id = p_post;
  if not found or v_post.removed_at is not null or v_post.hidden_at is not null then raise exception 'topico_nao_encontrado'; end if;
  if public.is_minor(v_uid) or private.needs_guardian(v_uid) then raise exception 'so_adultos'; end if;
  if private.is_banned(v_post.community_id, v_uid) then raise exception 'banido'; end if;
  if not private.can_post(v_post.community_id) then raise exception 'precisa_participar'; end if;
  if v_post.locked and not private.can_moderate(v_post.community_id) then raise exception 'topico_trancado'; end if;
  if (select count(*) from public.community_replies where user_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'limite_respostas';
  end if;

  insert into public.community_replies (post_id, user_id, body, games)
  values (p_post, v_uid, btrim(p_body), (private.valid_games(p_games, 3))[1:3])
  returning id into v_id;
  update public.community_posts set reply_count = reply_count + 1, last_activity_at = now() where id = p_post;

  if v_post.user_id <> v_uid
     and not private.blocked_between(v_post.user_id, v_uid)
     and not exists (select 1 from public.notifications
                      where user_id = v_post.user_id and type = 'post_reply' and post_id = p_post and read_at is null) then
    insert into public.notifications (user_id, actor_id, type, post_id, community_id)
    values (v_post.user_id, v_uid, 'post_reply', p_post, v_post.community_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.edit_reply(p_id bigint, p_body text, p_games integer[])
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_replies
     set body = btrim(p_body), games = (private.valid_games(p_games, 3))[1:3], edited_at = now()
   where id = p_id and user_id = auth.uid() and removed_at is null;
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

create or replace function public.delete_reply(p_id bigint)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_replies set removed_at = now(), removed_by = auth.uid()
   where id = p_id and user_id = auth.uid() and removed_at is null;
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

create or replace function public.toggle_post_like(p_id bigint)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or private.needs_guardian(v_uid) then raise exception 'sem_acesso'; end if;
  if not exists (select 1 from public.community_posts where id = p_id and removed_at is null and hidden_at is null) then
    raise exception 'topico_nao_encontrado';
  end if;
  if exists (select 1 from public.post_likes where post_id = p_id and user_id = v_uid) then
    delete from public.post_likes where post_id = p_id and user_id = v_uid;
    update public.community_posts set like_count = greatest(like_count - 1, 0) where id = p_id;
    return false;
  end if;
  insert into public.post_likes (post_id, user_id) values (p_id, v_uid);
  update public.community_posts set like_count = like_count + 1 where id = p_id;
  return true;
end;
$$;

create or replace function public.toggle_reply_like(p_id bigint)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or private.needs_guardian(v_uid) then raise exception 'sem_acesso'; end if;
  if not exists (select 1 from public.community_replies where id = p_id and removed_at is null and hidden_at is null) then
    raise exception 'resposta_nao_encontrada';
  end if;
  if exists (select 1 from public.reply_likes where reply_id = p_id and user_id = v_uid) then
    delete from public.reply_likes where reply_id = p_id and user_id = v_uid;
    update public.community_replies set like_count = greatest(like_count - 1, 0) where id = p_id;
    return false;
  end if;
  insert into public.reply_likes (reply_id, user_id) values (p_id, v_uid);
  update public.community_replies set like_count = like_count + 1 where id = p_id;
  return true;
end;
$$;

-- Lista de tópicos. Removidos e escondidos só aparecem para a moderação.
create or replace function public.community_posts_list(p_community uuid, p_kind text default null, p_offset integer default 0, p_limit integer default 20)
returns table (
  id bigint, kind text, title text, excerpt text, games jsonb,
  user_id uuid, username text, avatar_url text,
  pinned boolean, locked boolean, removed boolean, hidden boolean,
  reply_count integer, like_count integer, last_activity_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.title, left(p.body, 220), private.games_json(p.games),
         u.id, u.username, u.avatar_url,
         p.pinned, p.locked, p.removed_at is not null, p.hidden_at is not null,
         p.reply_count, p.like_count, p.last_activity_at, p.created_at
    from public.community_posts p
    join public.communities c on c.id = p.community_id
    join public.profiles u on u.id = p.user_id
   where p.community_id = p_community
     and auth.uid() is not null
     and not private.needs_guardian(auth.uid())
     and (c.hidden_at is null or public.is_admin())
     and (p_kind is null or p.kind = p_kind)
     and not private.blocked_between(auth.uid(), p.user_id)
     and ((p.removed_at is null and p.hidden_at is null) or private.can_moderate(p_community))
   order by p.pinned desc, p.last_activity_at desc
   offset greatest(coalesce(p_offset, 0), 0)
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.post_view(p_id bigint)
returns table (
  id bigint, community_id uuid, community_slug text, community_name text,
  kind text, title text, body text, games jsonb,
  user_id uuid, username text, avatar_url text,
  pinned boolean, locked boolean, removed boolean, removed_by_author boolean, hidden boolean,
  edited boolean, reply_count integer, like_count integer, liked boolean, created_at timestamptz,
  is_author boolean, can_moderate boolean, can_reply boolean
)
language sql stable security definer set search_path = '' as $$
  select p.id, c.id, c.slug, c.name,
         p.kind, p.title,
         case when (p.removed_at is null and p.hidden_at is null) or private.can_moderate(c.id) then p.body end,
         case when (p.removed_at is null and p.hidden_at is null) or private.can_moderate(c.id) then private.games_json(p.games) else '[]'::jsonb end,
         u.id, u.username, u.avatar_url,
         p.pinned, p.locked, p.removed_at is not null, p.removed_by = p.user_id, p.hidden_at is not null,
         p.edited_at is not null, p.reply_count, p.like_count,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         p.created_at,
         p.user_id = auth.uid(),
         private.can_moderate(c.id),
         private.can_post(c.id) and p.removed_at is null and p.hidden_at is null and (not p.locked or private.can_moderate(c.id))
    from public.community_posts p
    join public.communities c on c.id = p.community_id
    join public.profiles u on u.id = p.user_id
   where p.id = p_id
     and auth.uid() is not null
     and not private.needs_guardian(auth.uid())
     and (c.hidden_at is null or public.is_admin())
     and not private.blocked_between(auth.uid(), p.user_id)
     and ((p.removed_at is null and p.hidden_at is null) or private.can_moderate(c.id) or p.user_id = auth.uid());
$$;

-- Respostas: removidas viram aviso (o texto some), para a conversa continuar fazendo sentido
create or replace function public.post_replies(p_post bigint)
returns table (
  id bigint, body text, games jsonb, user_id uuid, username text, avatar_url text,
  removed boolean, removed_by_author boolean, hidden boolean, edited boolean,
  like_count integer, liked boolean, created_at timestamptz, is_author boolean
)
language sql stable security definer set search_path = '' as $$
  select r.id,
         case when (r.removed_at is null and r.hidden_at is null) or private.can_moderate(p.community_id) then r.body end,
         case when (r.removed_at is null and r.hidden_at is null) or private.can_moderate(p.community_id) then private.games_json(r.games) else '[]'::jsonb end,
         u.id, u.username, u.avatar_url,
         r.removed_at is not null, r.removed_by = r.user_id, r.hidden_at is not null, r.edited_at is not null,
         r.like_count,
         exists (select 1 from public.reply_likes l where l.reply_id = r.id and l.user_id = auth.uid()),
         r.created_at,
         r.user_id = auth.uid()
    from public.community_replies r
    join public.community_posts p on p.id = r.post_id
    join public.communities c on c.id = p.community_id
    join public.profiles u on u.id = r.user_id
   where r.post_id = p_post
     and auth.uid() is not null
     and not private.needs_guardian(auth.uid())
     and (c.hidden_at is null or public.is_admin())
     and (p.removed_at is null or private.can_moderate(p.community_id) or p.user_id = auth.uid())
     and not private.blocked_between(auth.uid(), r.user_id)
   order by r.id
   limit 500;
$$;

-- ---------------------------------------------------------------
-- Moderação de tópicos e respostas
-- ---------------------------------------------------------------
create or replace function public.moderate_post(p_id bigint, p_action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_post public.community_posts%rowtype;
begin
  select * into v_post from public.community_posts where id = p_id;
  if not found or not private.can_moderate(v_post.community_id) then raise exception 'sem_acesso'; end if;
  case p_action
    when 'pin' then update public.community_posts set pinned = true where id = p_id;
    when 'unpin' then update public.community_posts set pinned = false where id = p_id;
    when 'lock' then update public.community_posts set locked = true where id = p_id;
    when 'unlock' then update public.community_posts set locked = false where id = p_id;
    when 'remove' then
      update public.community_posts set removed_at = now(), removed_by = auth.uid(), hidden_at = null where id = p_id;
      update public.reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now()
       where target_type = 'post' and target_id = p_id::text and status = 'open';
      if v_post.user_id <> auth.uid() then
        insert into public.notifications (user_id, type, post_id, community_id)
        values (v_post.user_id, 'mod_action', p_id, v_post.community_id);
      end if;
    when 'restore' then
      update public.community_posts set removed_at = null, removed_by = null, hidden_at = null where id = p_id;
      update public.reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
       where target_type = 'post' and target_id = p_id::text and status = 'open';
    else raise exception 'acao_invalida';
  end case;
end;
$$;

create or replace function public.moderate_reply(p_id bigint, p_action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reply public.community_replies%rowtype;
  v_comm uuid;
begin
  select * into v_reply from public.community_replies where id = p_id;
  if not found then raise exception 'sem_acesso'; end if;
  select community_id into v_comm from public.community_posts where id = v_reply.post_id;
  if not private.can_moderate(v_comm) then raise exception 'sem_acesso'; end if;
  if p_action = 'remove' then
    update public.community_replies set removed_at = now(), removed_by = auth.uid(), hidden_at = null where id = p_id;
    update public.reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now()
     where target_type = 'reply' and target_id = p_id::text and status = 'open';
    if v_reply.user_id <> auth.uid() then
      insert into public.notifications (user_id, type, post_id, community_id)
      values (v_reply.user_id, 'mod_action', v_reply.post_id, v_comm);
    end if;
  elsif p_action = 'restore' then
    update public.community_replies set removed_at = null, removed_by = null, hidden_at = null where id = p_id;
    update public.reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
     where target_type = 'reply' and target_id = p_id::text and status = 'open';
  else
    raise exception 'acao_invalida';
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Denúncias
-- ---------------------------------------------------------------
create or replace function public.report_content(p_type text, p_target text, p_reason text, p_details text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_comm uuid;
  v_total integer;
  v_novo boolean;
begin
  if v_uid is null then raise exception 'Precisa estar logado'; end if;
  if (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'limite_denuncias';
  end if;

  -- Descobre a comunidade (para mandar à moderação certa) e confere se o alvo existe
  if p_type = 'post' then
    select community_id into v_comm from public.community_posts where id = p_target::bigint;
  elsif p_type = 'reply' then
    select p.community_id into v_comm from public.community_replies r join public.community_posts p on p.id = r.post_id where r.id = p_target::bigint;
  elsif p_type = 'community' then
    select id into v_comm from public.communities where id = p_target::uuid;
  elsif p_type = 'comment' then
    if not exists (select 1 from public.event_comments where id = p_target::bigint) then raise exception 'alvo_nao_encontrado'; end if;
  elsif p_type = 'review' then
    if not exists (select 1 from public.logs where user_id = split_part(p_target, ':', 1)::uuid
                     and game_id = split_part(p_target, ':', 2)::integer and review is not null) then
      raise exception 'alvo_nao_encontrado';
    end if;
  elsif p_type = 'profile' then
    if not exists (select 1 from public.profiles where id = p_target::uuid) then raise exception 'alvo_nao_encontrado'; end if;
  else
    raise exception 'alvo_nao_encontrado';
  end if;
  if p_type in ('post', 'reply', 'community') and v_comm is null then raise exception 'alvo_nao_encontrado'; end if;

  insert into public.reports (reporter_id, target_type, target_id, community_id, reason, details)
  values (v_uid, p_type, p_target, case when p_type = 'community' then null else v_comm end, p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  on conflict (reporter_id, target_type, target_id) do nothing;
  if not found then return; end if;

  select count(*) into v_total from public.reports where target_type = p_type and target_id = p_target and status = 'open';
  v_novo := v_total = 1;

  -- 3 denúncias de pessoas diferentes: esconde até a moderação analisar
  if v_total >= 3 then
    if p_type = 'post' then update public.community_posts set hidden_at = coalesce(hidden_at, now()) where id = p_target::bigint and removed_at is null;
    elsif p_type = 'reply' then update public.community_replies set hidden_at = coalesce(hidden_at, now()) where id = p_target::bigint and removed_at is null;
    end if;
  end if;

  -- Primeira denúncia: avisa quem analisa (moderação da comunidade ou admins)
  if v_novo then
    if p_type in ('post', 'reply') then
      insert into public.notifications (user_id, type, community_id)
      select m.user_id, 'report', v_comm from public.community_members m
       where m.community_id = v_comm and m.role in ('owner', 'mod') and m.user_id <> v_uid;
    else
      insert into public.notifications (user_id, type)
      select p.id, 'report' from public.profiles p where p.role = 'admin' and p.id <> v_uid;
    end if;
  end if;
end;
$$;

-- Fila de denúncias: uma linha por conteúdo denunciado. Admin vê tudo; moderação vê a da sua comunidade.
create or replace function public.reports_queue(p_status text default 'open')
returns table (
  target_type text, target_id text, total integer, reasons text[], details text[], last_at timestamptz,
  community_slug text, community_name text, preview text, author_username text,
  post_id bigint, event_id bigint, game_id integer, profile_username text
)
language sql stable security definer set search_path = '' as $$
  with grupo as (
    select r.target_type, r.target_id, r.community_id,
           count(*)::integer as total,
           array_agg(distinct r.reason) as reasons,
           array_remove(array_agg(r.details order by r.created_at desc), null) as details,
           max(r.created_at) as last_at
      from public.reports r
     where r.status = coalesce(p_status, 'open')
       and (public.is_admin()
            or (r.community_id is not null and private.can_moderate(r.community_id)))
     group by r.target_type, r.target_id, r.community_id
  )
  select g.target_type, g.target_id, g.total, g.reasons, g.details[1:5], g.last_at,
         c.slug, c.name,
         case g.target_type
           when 'post' then (select p.title || ' — ' || left(p.body, 200) from public.community_posts p where p.id = g.target_id::bigint)
           when 'reply' then (select left(r.body, 240) from public.community_replies r where r.id = g.target_id::bigint)
           when 'community' then (select x.name || ' — ' || coalesce(x.description, '') from public.communities x where x.id = g.target_id::uuid)
           when 'comment' then (select left(ec.body, 240) from public.event_comments ec where ec.id = g.target_id::bigint)
           when 'review' then (select left(l.review, 240) from public.logs l
                                where l.user_id = split_part(g.target_id, ':', 1)::uuid and l.game_id = split_part(g.target_id, ':', 2)::integer)
           when 'profile' then (select coalesce(pr.display_name, '') || ' ' || coalesce(pr.bio, '') from public.profiles pr where pr.id = g.target_id::uuid)
         end,
         case g.target_type
           when 'post' then (select u.username from public.community_posts p join public.profiles u on u.id = p.user_id where p.id = g.target_id::bigint)
           when 'reply' then (select u.username from public.community_replies r join public.profiles u on u.id = r.user_id where r.id = g.target_id::bigint)
           when 'comment' then (select u.username from public.event_comments ec join public.profiles u on u.id = ec.user_id where ec.id = g.target_id::bigint)
           when 'review' then (select u.username from public.profiles u where u.id = split_part(g.target_id, ':', 1)::uuid)
           when 'profile' then (select u.username from public.profiles u where u.id = g.target_id::uuid)
           when 'community' then (select u.username from public.communities x join public.profiles u on u.id = x.owner_id where x.id = g.target_id::uuid)
         end,
         case g.target_type
           when 'post' then g.target_id::bigint
           when 'reply' then (select r.post_id from public.community_replies r where r.id = g.target_id::bigint)
         end,
         case when g.target_type = 'comment' then (select ec.event_id from public.event_comments ec where ec.id = g.target_id::bigint) end,
         case when g.target_type = 'review' then split_part(g.target_id, ':', 2)::integer end,
         case when g.target_type = 'profile' then (select u.username from public.profiles u where u.id = g.target_id::uuid) end
    from grupo g
    left join public.communities c on c.id = coalesce(g.community_id, case when g.target_type = 'community' then g.target_id::uuid end)
   order by g.total desc, g.last_at desc
   limit 100;
$$;

-- Resolver: 'dismiss' (nada de errado: volta a aparecer) ou 'remove' (tira o conteúdo do ar)
create or replace function public.resolve_report(p_type text, p_target text, p_action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_comm uuid;
begin
  if p_action not in ('dismiss', 'remove') then raise exception 'acao_invalida'; end if;

  if p_type = 'post' then
    select community_id into v_comm from public.community_posts where id = p_target::bigint;
    perform public.moderate_post(p_target::bigint, case when p_action = 'remove' then 'remove' else 'restore' end);
    return;
  elsif p_type = 'reply' then
    perform public.moderate_reply(p_target::bigint, case when p_action = 'remove' then 'remove' else 'restore' end);
    return;
  end if;

  -- Comunidades, comentários, reviews e perfis: só admin
  if not public.is_admin() then raise exception 'sem_acesso'; end if;
  if p_action = 'remove' then
    if p_type = 'community' then
      update public.communities set hidden_at = now() where id = p_target::uuid;
    elsif p_type = 'comment' then
      delete from public.event_comments where id = p_target::bigint;
    elsif p_type = 'review' then
      update public.logs set review = null, has_spoilers = false
       where user_id = split_part(p_target, ':', 1)::uuid and game_id = split_part(p_target, ':', 2)::integer;
    end if;
    -- perfil: a conta é tratada no admin do site (fase 6); aqui só registra a análise
  elsif p_type = 'community' then
    update public.communities set hidden_at = null where id = p_target::uuid;
  end if;

  update public.reports
     set status = case when p_action = 'remove' then 'resolved' else 'dismissed' end,
         resolved_by = auth.uid(), resolved_at = now()
   where target_type = p_type and target_id = p_target and status = 'open';
end;
$$;

-- Quem pode analisar denúncias e quantas estão abertas
create or replace function public.reports_summary()
returns table (can_review boolean, open integer)
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (select 1 from public.community_members m where m.user_id = auth.uid() and m.role in ('owner', 'mod')),
         (select count(distinct (r.target_type, r.target_id)) from public.reports r
           where r.status = 'open'
             and (public.is_admin() or (r.community_id is not null and private.can_moderate(r.community_id))))::integer;
$$;

-- ---------------------------------------------------------------
-- Notificações (agora com tópicos e comunidades)
-- ---------------------------------------------------------------
drop function if exists public.my_notifications(integer);
create or replace function public.my_notifications(p_limit integer default 50)
returns table (
  id bigint, type text, created_at timestamptz, read boolean,
  actor_username text, actor_avatar_url text,
  event_id bigint, event_type text, group_id uuid, group_name text, game_id integer, game_name text,
  post_id bigint, post_title text, community_slug text, community_name text
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.type, n.created_at, n.read_at is not null,
         a.username, a.avatar_url,
         n.event_id, e.type, n.group_id, gr.name, n.game_id, g.name,
         n.post_id, cp.title, c.slug, c.name
    from public.notifications n
    left join public.profiles a on a.id = n.actor_id
    left join public.events e on e.id = n.event_id
    left join public.groups gr on gr.id = n.group_id
    left join public.games g on g.igdb_id = n.game_id
    left join public.community_posts cp on cp.id = n.post_id
    left join public.communities c on c.id = n.community_id
   where n.user_id = auth.uid()
     and (n.actor_id is null or not private.blocked_between(auth.uid(), n.actor_id))
   order by n.id desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- ---------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------
revoke all on function
  public.create_community(text, text, text, text),
  public.update_community(uuid, text, text, text),
  public.delete_community(uuid),
  public.join_community(uuid),
  public.leave_community(uuid),
  public.mark_community_seen(uuid),
  public.set_moderator(uuid, uuid, boolean),
  public.ban_member(uuid, uuid, text),
  public.unban_member(uuid, uuid),
  public.community_view(text),
  public.search_communities(text),
  public.trending_communities(integer),
  public.my_communities(),
  public.community_members_list(uuid),
  public.community_bans_list(uuid),
  public.create_post(uuid, text, text, text, integer[]),
  public.edit_post(bigint, text, text, text, integer[]),
  public.delete_post(bigint),
  public.create_reply(bigint, text, integer[]),
  public.edit_reply(bigint, text, integer[]),
  public.delete_reply(bigint),
  public.toggle_post_like(bigint),
  public.toggle_reply_like(bigint),
  public.community_posts_list(uuid, text, integer, integer),
  public.post_view(bigint),
  public.post_replies(bigint),
  public.moderate_post(bigint, text),
  public.moderate_reply(bigint, text),
  public.report_content(text, text, text, text),
  public.reports_queue(text),
  public.resolve_report(text, text, text),
  public.reports_summary(),
  public.my_notifications(integer)
from public, anon;

grant execute on function
  public.create_community(text, text, text, text),
  public.update_community(uuid, text, text, text),
  public.delete_community(uuid),
  public.join_community(uuid),
  public.leave_community(uuid),
  public.mark_community_seen(uuid),
  public.set_moderator(uuid, uuid, boolean),
  public.ban_member(uuid, uuid, text),
  public.unban_member(uuid, uuid),
  public.community_view(text),
  public.search_communities(text),
  public.trending_communities(integer),
  public.my_communities(),
  public.community_members_list(uuid),
  public.community_bans_list(uuid),
  public.create_post(uuid, text, text, text, integer[]),
  public.edit_post(bigint, text, text, text, integer[]),
  public.delete_post(bigint),
  public.create_reply(bigint, text, integer[]),
  public.edit_reply(bigint, text, integer[]),
  public.delete_reply(bigint),
  public.toggle_post_like(bigint),
  public.toggle_reply_like(bigint),
  public.community_posts_list(uuid, text, integer, integer),
  public.post_view(bigint),
  public.post_replies(bigint),
  public.moderate_post(bigint, text),
  public.moderate_reply(bigint, text),
  public.report_content(text, text, text, text),
  public.reports_queue(text),
  public.resolve_report(text, text, text),
  public.reports_summary(),
  public.my_notifications(integer)
to authenticated;
