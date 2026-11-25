-- Quicksave App · 005_atividade_perfil.sql
-- A função do feed passa a buscar também as atividades de uma pessoa (aba "Atividade" do perfil).
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 004. Pode rodar de novo sem problema.

drop function if exists public.activity_feed(text, uuid, bigint, integer, bigint);

create or replace function public.activity_feed(
  p_scope text,                 -- 'friends', 'group', 'user' ou 'event'
  p_group uuid default null,
  p_before bigint default null, -- para carregar mais: id da última atividade mostrada
  p_limit integer default 20,
  p_event bigint default null,
  p_user uuid default null
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
       when 'user' then e.user_id = p_user and private.can_see_log(e.user_id, e.visibility)
       when 'event' then e.id = p_event and private.can_see_log(e.user_id, e.visibility)
       else false
     end
   order by e.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.activity_feed(text, uuid, bigint, integer, bigint, uuid) from public, anon;
grant execute on function public.activity_feed(text, uuid, bigint, integer, bigint, uuid) to authenticated;
