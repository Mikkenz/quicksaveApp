-- Quicksave App · 007_busca_topicos.sql
-- Busca de tópicos pelo título ou texto: em todas as comunidades ou só em uma.
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 006. Pode rodar de novo sem problema.

create or replace function public.search_posts(p_q text, p_community uuid default null, p_limit integer default 30)
returns table (
  id bigint, kind text, title text, excerpt text, games jsonb,
  user_id uuid, username text, avatar_url text,
  pinned boolean, locked boolean, removed boolean, hidden boolean,
  reply_count integer, like_count integer, last_activity_at timestamptz, created_at timestamptz,
  community_slug text, community_name text
)
language sql stable security definer set search_path = '' as $$
  with q as (
    select replace(replace(replace(lower(btrim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select p.id, p.kind, p.title, left(p.body, 220), private.games_json(p.games),
         u.id, u.username, u.avatar_url,
         p.pinned, p.locked, false, false,
         p.reply_count, p.like_count, p.last_activity_at, p.created_at,
         c.slug, c.name
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

revoke all on function public.search_posts(text, uuid, integer) from public, anon;
grant execute on function public.search_posts(text, uuid, integer) to authenticated;
