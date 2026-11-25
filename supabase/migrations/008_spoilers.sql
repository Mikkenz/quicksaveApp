-- Quicksave App · 008_spoilers.sql
-- Marcação "Contém spoilers" em comentários de atividade, tópicos e respostas das comunidades.
-- Quem lê precisa tocar no aviso para ver o texto (o app cuida disso).
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 007. Pode rodar de novo sem problema.

alter table public.event_comments add column if not exists has_spoilers boolean not null default false;
alter table public.community_posts add column if not exists has_spoilers boolean not null default false;
alter table public.community_replies add column if not exists has_spoilers boolean not null default false;

-- ---------------------------------------------------------------
-- Comentários de atividade
-- ---------------------------------------------------------------
drop function if exists public.add_comment(bigint, text);
create or replace function public.add_comment(p_event bigint, p_body text, p_spoiler boolean default false)
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
  insert into public.event_comments (event_id, user_id, body, has_spoilers)
  values (p_event, v_uid, btrim(p_body), coalesce(p_spoiler, false))
  returning id into v_id;

  select e.user_id into v_dono from public.events e where e.id = p_event;
  if v_dono <> v_uid then
    insert into public.notifications (user_id, actor_id, type, event_id, game_id)
    select v_dono, v_uid, 'comment', p_event, e.game_id from public.events e where e.id = p_event;
  end if;
  return v_id;
end;
$$;

drop function if exists public.event_comments_list(bigint);
create or replace function public.event_comments_list(p_event bigint)
returns table (id bigint, user_id uuid, username text, avatar_url text, body text, has_spoilers boolean, created_at timestamptz, can_delete boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, p.id, p.username, p.avatar_url, c.body, c.has_spoilers, c.created_at,
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
-- Tópicos
-- ---------------------------------------------------------------
drop function if exists public.create_post(uuid, text, text, text, integer[]);
create or replace function public.create_post(p_community uuid, p_kind text, p_title text, p_body text, p_games integer[], p_spoiler boolean default false)
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
  insert into public.community_posts (community_id, user_id, kind, title, body, games, has_spoilers)
  values (p_community, v_uid, coalesce(p_kind, 'discussao'), btrim(p_title), btrim(coalesce(p_body, '')),
          (private.valid_games(p_games, 5))[1:5], coalesce(p_spoiler, false))
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.edit_post(bigint, text, text, text, integer[]);
create or replace function public.edit_post(p_id bigint, p_kind text, p_title text, p_body text, p_games integer[], p_spoiler boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_posts
     set kind = coalesce(p_kind, kind), title = btrim(p_title), body = btrim(coalesce(p_body, '')),
         games = (private.valid_games(p_games, 5))[1:5], has_spoilers = coalesce(p_spoiler, false), edited_at = now()
   where id = p_id and user_id = auth.uid() and removed_at is null;
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

drop function if exists public.community_posts_list(uuid, text, integer, integer);
create or replace function public.community_posts_list(p_community uuid, p_kind text default null, p_offset integer default 0, p_limit integer default 20)
returns table (
  id bigint, kind text, title text, excerpt text, games jsonb,
  user_id uuid, username text, avatar_url text,
  pinned boolean, locked boolean, removed boolean, hidden boolean,
  reply_count integer, like_count integer, last_activity_at timestamptz, created_at timestamptz,
  has_spoilers boolean
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.title, left(p.body, 220), private.games_json(p.games),
         u.id, u.username, u.avatar_url,
         p.pinned, p.locked, p.removed_at is not null, p.hidden_at is not null,
         p.reply_count, p.like_count, p.last_activity_at, p.created_at,
         p.has_spoilers
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

drop function if exists public.post_view(bigint);
create or replace function public.post_view(p_id bigint)
returns table (
  id bigint, community_id uuid, community_slug text, community_name text,
  kind text, title text, body text, games jsonb,
  user_id uuid, username text, avatar_url text,
  pinned boolean, locked boolean, removed boolean, removed_by_author boolean, hidden boolean,
  edited boolean, reply_count integer, like_count integer, liked boolean, created_at timestamptz,
  is_author boolean, can_moderate boolean, can_reply boolean, has_spoilers boolean
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
         private.can_post(c.id) and p.removed_at is null and p.hidden_at is null and (not p.locked or private.can_moderate(c.id)),
         p.has_spoilers
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

drop function if exists public.search_posts(text, uuid, integer);
create or replace function public.search_posts(p_q text, p_community uuid default null, p_limit integer default 30)
returns table (
  id bigint, kind text, title text, excerpt text, games jsonb,
  user_id uuid, username text, avatar_url text,
  pinned boolean, locked boolean, removed boolean, hidden boolean,
  reply_count integer, like_count integer, last_activity_at timestamptz, created_at timestamptz,
  community_slug text, community_name text, has_spoilers boolean
)
language sql stable security definer set search_path = '' as $$
  with q as (
    select replace(replace(replace(lower(btrim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select p.id, p.kind, p.title, left(p.body, 220), private.games_json(p.games),
         u.id, u.username, u.avatar_url,
         p.pinned, p.locked, false, false,
         p.reply_count, p.like_count, p.last_activity_at, p.created_at,
         c.slug, c.name, p.has_spoilers
    from public.community_posts p
    join public.communities c on c.id = p.community_id
    join public.profiles u on u.id = p.user_id
    cross join q
   where auth.uid() is not null
     and not private.needs_guardian(auth.uid())
     and char_length(q.t) >= 2
     and c.hidden_at is null
     and p.removed_at is null
     and p.hidden_at is null
     and (p_community is null or p.community_id = p_community)
     and not private.blocked_between(auth.uid(), p.user_id)
     and (lower(p.title) like '%' || q.t || '%' or lower(p.body) like '%' || q.t || '%')
   order by (lower(p.title) like '%' || q.t || '%') desc, p.last_activity_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

-- ---------------------------------------------------------------
-- Respostas
-- ---------------------------------------------------------------
drop function if exists public.create_reply(bigint, text, integer[]);
create or replace function public.create_reply(p_post bigint, p_body text, p_games integer[], p_spoiler boolean default false)
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

  insert into public.community_replies (post_id, user_id, body, games, has_spoilers)
  values (p_post, v_uid, btrim(p_body), (private.valid_games(p_games, 3))[1:3], coalesce(p_spoiler, false))
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

drop function if exists public.edit_reply(bigint, text, integer[]);
create or replace function public.edit_reply(p_id bigint, p_body text, p_games integer[], p_spoiler boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_replies
     set body = btrim(p_body), games = (private.valid_games(p_games, 3))[1:3], has_spoilers = coalesce(p_spoiler, false), edited_at = now()
   where id = p_id and user_id = auth.uid() and removed_at is null;
  if not found then raise exception 'sem_acesso'; end if;
end;
$$;

drop function if exists public.post_replies(bigint);
create or replace function public.post_replies(p_post bigint)
returns table (
  id bigint, body text, games jsonb, user_id uuid, username text, avatar_url text,
  removed boolean, removed_by_author boolean, hidden boolean, edited boolean,
  like_count integer, liked boolean, created_at timestamptz, is_author boolean, has_spoilers boolean
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
         r.user_id = auth.uid(),
         r.has_spoilers
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
-- Permissões
-- ---------------------------------------------------------------
revoke all on function
  public.add_comment(bigint, text, boolean),
  public.event_comments_list(bigint),
  public.create_post(uuid, text, text, text, integer[], boolean),
  public.edit_post(bigint, text, text, text, integer[], boolean),
  public.community_posts_list(uuid, text, integer, integer),
  public.post_view(bigint),
  public.search_posts(text, uuid, integer),
  public.create_reply(bigint, text, integer[], boolean),
  public.edit_reply(bigint, text, integer[], boolean),
  public.post_replies(bigint)
from public, anon;

grant execute on function
  public.add_comment(bigint, text, boolean),
  public.event_comments_list(bigint),
  public.create_post(uuid, text, text, text, integer[], boolean),
  public.edit_post(bigint, text, text, text, integer[], boolean),
  public.community_posts_list(uuid, text, integer, integer),
  public.post_view(bigint),
  public.search_posts(text, uuid, integer),
  public.create_reply(bigint, text, integer[], boolean),
  public.edit_reply(bigint, text, integer[], boolean),
  public.post_replies(bigint)
to authenticated;
