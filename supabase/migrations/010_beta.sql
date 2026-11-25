-- Quicksave App · 010_beta.sql
-- Para o beta: suspensão de contas, autorização do responsável por e-mail, "baixar meus dados"
-- e as funções que a aba App do admin do site usa (só pela chave secreta, no servidor do site).
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 009. Pode rodar de novo sem problema.

-- ---------------------------------------------------------------
-- Suspensão
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_reason text check (char_length(suspended_reason) <= 300);

create or replace function private.is_suspended(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_user and suspended_at is not null);
$$;

-- Conta suspensa não comenta, não reage, não posta, não faz amizades nem cria grupos/comunidades.
-- O diário continua funcionando.
create or replace function private.block_suspended()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and private.is_suspended(auth.uid()) then
    raise exception 'conta_suspensa';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['event_comments', 'event_reactions', 'review_likes', 'friendships', 'groups', 'group_members',
                           'communities', 'community_posts', 'community_replies', 'post_likes', 'reply_likes'] loop
    execute format('drop trigger if exists block_suspended on public.%I', t);
    execute format('create trigger block_suspended before insert on public.%I for each row execute function private.block_suspended()', t);
  end loop;
end;
$$;

-- Suspenso também não publica reviews para todos: o registro fica só para amigos
create or replace function public.logs_before_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_minor(new.user_id) or private.is_suspended(new.user_id) then
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

-- ---------------------------------------------------------------
-- Autorização do responsável (menores de 12)
-- A Edge Function "responsavel" cria o pedido, manda o e-mail e confirma o link.
-- ---------------------------------------------------------------
create table if not exists public.guardian_requests (
  token uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles (id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);
create index if not exists guardian_requests_child_idx on public.guardian_requests (child_id, created_at desc);
alter table public.guardian_requests enable row level security;
revoke all on public.guardian_requests from anon, authenticated;
grant select, insert, update, delete on public.guardian_requests to service_role;
grant select, update on public.profile_private to service_role;

-- Confirma o link do e-mail (chamada pela Edge Function, com a chave secreta)
create or replace function public.confirm_guardian(p_token uuid)
returns text -- 'ok', 'usado', 'expirado' ou 'invalido'
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.guardian_requests%rowtype;
begin
  select * into v_req from public.guardian_requests where token = p_token;
  if not found then return 'invalido'; end if;
  if v_req.used_at is not null then return 'usado'; end if;
  if v_req.expires_at < now() then return 'expirado'; end if;
  update public.guardian_requests set used_at = now() where token = p_token;
  update public.profile_private set guardian_consent_at = now() where id = v_req.child_id;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------
-- Baixar meus dados (LGPD)
-- ---------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'perfil', (select to_jsonb(p) - 'role' from public.profiles p where p.id = auth.uid()),
    'dados_privados', (select jsonb_build_object('nascimento', pp.birth_date, 'email_responsavel', pp.guardian_email,
                                                 'autorizacao_responsavel', pp.guardian_consent_at,
                                                 'versao_termos', pp.terms_version, 'aceite_termos', pp.terms_accepted_at)
                         from public.profile_private pp where pp.id = auth.uid()),
    'email', (select u.email from auth.users u where u.id = auth.uid()),
    'registros', coalesce((select jsonb_agg(jsonb_build_object(
                    'jogo', g.name, 'igdb_id', l.game_id, 'status', l.status, 'plataforma', l.platform, 'nota', l.rating,
                    'horas', l.hours_played, 'review', l.review, 'spoiler', l.has_spoilers, 'visibilidade', l.visibility,
                    'inicio', l.started_at, 'fim', l.finished_at, 'criado', l.created_at, 'atualizado', l.updated_at)
                    order by l.updated_at desc)
                  from public.logs l join public.games g on g.igdb_id = l.game_id where l.user_id = auth.uid()), '[]'::jsonb),
    'favoritos', coalesce((select jsonb_agg(jsonb_build_object('posicao', f.position, 'jogo', g.name) order by f.position)
                  from public.favorites f join public.games g on g.igdb_id = f.game_id where f.user_id = auth.uid()), '[]'::jsonb),
    'amigos', coalesce((select jsonb_agg(p.username)
                  from public.friendships f
                  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
                 where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())), '[]'::jsonb),
    'grupos', coalesce((select jsonb_agg(jsonb_build_object('grupo', gr.name, 'situacao', m.status))
                  from public.group_members m join public.groups gr on gr.id = m.group_id where m.user_id = auth.uid()), '[]'::jsonb),
    'comentarios', coalesce((select jsonb_agg(jsonb_build_object('texto', c.body, 'spoiler', c.has_spoilers, 'em', c.created_at) order by c.id)
                  from public.event_comments c where c.user_id = auth.uid()), '[]'::jsonb),
    'comunidades', coalesce((select jsonb_agg(jsonb_build_object('comunidade', c.name, 'papel', m.role))
                  from public.community_members m join public.communities c on c.id = m.community_id where m.user_id = auth.uid()), '[]'::jsonb),
    'topicos', coalesce((select jsonb_agg(jsonb_build_object('titulo', p.title, 'texto', p.body, 'em', p.created_at) order by p.id)
                  from public.community_posts p where p.user_id = auth.uid()), '[]'::jsonb),
    'respostas', coalesce((select jsonb_agg(jsonb_build_object('texto', r.body, 'em', r.created_at) order by r.id)
                  from public.community_replies r where r.user_id = auth.uid()), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
revoke all on function public.confirm_guardian(uuid) from public, anon, authenticated;
grant execute on function public.confirm_guardian(uuid) to service_role;

-- ---------------------------------------------------------------
-- Denúncias: a mesma fila e as mesmas ações, também para o admin do site
-- ---------------------------------------------------------------
create or replace function private.reports_queue_rows(p_status text, p_todas boolean)
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
       and (p_todas or (r.community_id is not null and private.can_moderate(r.community_id)))
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

create or replace function public.reports_queue(p_status text default 'open')
returns table (
  target_type text, target_id text, total integer, reasons text[], details text[], last_at timestamptz,
  community_slug text, community_name text, preview text, author_username text,
  post_id bigint, event_id bigint, game_id integer, profile_username text
)
language sql stable security definer set search_path = '' as $$
  select * from private.reports_queue_rows(p_status, public.is_admin());
$$;

-- Ação sobre a denúncia, sem checar permissão (quem chama confere antes)
create or replace function private.resolve_report_core(p_type text, p_target text, p_action text, p_actor uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid;
  v_post bigint;
  v_comm uuid;
begin
  if p_action not in ('dismiss', 'remove') then raise exception 'acao_invalida'; end if;

  if p_type = 'post' then
    select user_id, community_id into v_autor, v_comm from public.community_posts where id = p_target::bigint;
    if p_action = 'remove' then
      update public.community_posts set removed_at = now(), removed_by = p_actor, hidden_at = null where id = p_target::bigint;
      if v_autor is not null and v_autor is distinct from p_actor then
        insert into public.notifications (user_id, type, post_id, community_id) values (v_autor, 'mod_action', p_target::bigint, v_comm);
      end if;
    else
      update public.community_posts set removed_at = null, removed_by = null, hidden_at = null where id = p_target::bigint;
    end if;
  elsif p_type = 'reply' then
    select r.user_id, r.post_id, p.community_id into v_autor, v_post, v_comm
      from public.community_replies r join public.community_posts p on p.id = r.post_id where r.id = p_target::bigint;
    if p_action = 'remove' then
      update public.community_replies set removed_at = now(), removed_by = p_actor, hidden_at = null where id = p_target::bigint;
      if v_autor is not null and v_autor is distinct from p_actor then
        insert into public.notifications (user_id, type, post_id, community_id) values (v_autor, 'mod_action', v_post, v_comm);
      end if;
    else
      update public.community_replies set removed_at = null, removed_by = null, hidden_at = null where id = p_target::bigint;
    end if;
  elsif p_type = 'community' then
    update public.communities set hidden_at = case when p_action = 'remove' then now() else null end where id = p_target::uuid;
  elsif p_type = 'comment' and p_action = 'remove' then
    delete from public.event_comments where id = p_target::bigint;
  elsif p_type = 'review' and p_action = 'remove' then
    update public.logs set review = null, has_spoilers = false
     where user_id = split_part(p_target, ':', 1)::uuid and game_id = split_part(p_target, ':', 2)::integer;
  end if;
  -- perfil: a conta é tratada na tela de usuários (suspender/excluir)

  update public.reports
     set status = case when p_action = 'remove' then 'resolved' else 'dismissed' end,
         resolved_by = p_actor, resolved_at = now()
   where target_type = p_type and target_id = p_target and status = 'open';
end;
$$;

create or replace function public.resolve_report(p_type text, p_target text, p_action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_comm uuid;
begin
  if p_type = 'post' then
    select community_id into v_comm from public.community_posts where id = p_target::bigint;
  elsif p_type = 'reply' then
    select p.community_id into v_comm from public.community_replies r join public.community_posts p on p.id = r.post_id where r.id = p_target::bigint;
  end if;
  if not (public.is_admin() or (p_type in ('post', 'reply') and v_comm is not null and private.can_moderate(v_comm))) then
    raise exception 'sem_acesso';
  end if;
  perform private.resolve_report_core(p_type, p_target, p_action, auth.uid());
end;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.can_see_log(uuid, text) to authenticated;
grant execute on function private.can_see_profile(uuid) to authenticated;
grant execute on function private.can_see_favorites(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Admin do site (só com a chave secreta: papel service_role)
-- ---------------------------------------------------------------
create or replace function public.admin_app_overview()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with ativos as (
    select user_id, created_at from public.events
    union all select user_id, created_at from public.event_comments
    union all select user_id, created_at from public.community_posts
    union all select user_id, created_at from public.community_replies
  ), contas as (
    select p.id, p.created_at, pp.birth_date
      from public.profiles p left join public.profile_private pp on pp.id = p.id
     where p.username is not null
  )
  select jsonb_build_object(
    'contas', (select count(*) from contas),
    'contas_7d', (select count(*) from contas where created_at > now() - interval '7 days'),
    'contas_30d', (select count(*) from contas where created_at > now() - interval '30 days'),
    'contas_por_semana', (select jsonb_agg(jsonb_build_object('semana', s.ini::date, 'n', (select count(*) from contas c where c.created_at >= s.ini and c.created_at < s.ini + interval '7 days')) order by s.ini)
                            from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as s(ini)),
    'ativos_7d', (select count(distinct user_id) from ativos where created_at > now() - interval '7 days'),
    'ativos_30d', (select count(distinct user_id) from ativos where created_at > now() - interval '30 days'),
    'menores_18', (select count(*) from contas where birth_date > current_date - interval '18 years'),
    'menores_12', (select count(*) from contas where birth_date > current_date - interval '12 years'),
    'registros', (select count(*) from public.logs),
    'reviews', (select count(*) from public.logs where review is not null),
    'comentarios', (select count(*) from public.event_comments),
    'grupos', (select count(*) from public.groups),
    'comunidades', (select count(*) from public.communities where hidden_at is null),
    'topicos', (select count(*) from public.community_posts where removed_at is null),
    'respostas', (select count(*) from public.community_replies where removed_at is null),
    'denuncias_abertas', (select count(distinct (target_type, target_id)) from public.reports where status = 'open'),
    'suspensos', (select count(*) from public.profiles where suspended_at is not null),
    'top_jogos', coalesce((select jsonb_agg(x) from (
                    select g.igdb_id as id, g.name, count(distinct e.user_id) as pessoas
                      from public.events e join public.games g on g.igdb_id = e.game_id
                     where e.created_at > now() - interval '30 days' and e.type <> 'wishlisted'
                     group by g.igdb_id order by 3 desc, g.name limit 10) x), '[]'::jsonb),
    'rewinds', coalesce((select jsonb_agg(x) from (
                    select p.id, p.title, p.status,
                           (select count(*) from public.rewinds r where r.period_id = p.id) as pessoas,
                           (select count(*) from public.rewinds r where r.period_id = p.id and r.seen_at is not null) as vistos
                      from public.rewind_periods p order by p.ends_on desc limit 6) x), '[]'::jsonb)
  );
$$;

create or replace function public.admin_app_users(p_q text default '', p_limit integer default 50)
returns table (
  id uuid, username text, display_name text, email text, created_at timestamptz, last_sign_in_at timestamptz,
  faixa text, registros integer, denuncias integer, suspended_at timestamptz, suspended_reason text
)
language sql stable security definer set search_path = '' as $$
  with q as (
    select replace(replace(replace(lower(btrim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select p.id, p.username, p.display_name, u.email, p.created_at, u.last_sign_in_at,
         case
           when pp.birth_date is null then 'sem data'
           when pp.birth_date > current_date - interval '12 years' then 'menos de 12'
           when pp.birth_date > current_date - interval '18 years' then '12 a 17'
           else '18 ou mais'
         end,
         (select count(*) from public.logs l where l.user_id = p.id)::integer,
         ((select count(*) from public.reports r where r.status = 'open' and r.target_type = 'profile' and r.target_id = p.id::text)
          + (select count(*) from public.reports r where r.status = 'open' and r.target_type = 'review' and r.target_id like p.id::text || ':%')
          + (select count(*) from public.reports r join public.community_posts x on r.target_type = 'post' and r.target_id = x.id::text
              where r.status = 'open' and x.user_id = p.id)
          + (select count(*) from public.reports r join public.community_replies x on r.target_type = 'reply' and r.target_id = x.id::text
              where r.status = 'open' and x.user_id = p.id)
          + (select count(*) from public.reports r join public.event_comments x on r.target_type = 'comment' and r.target_id = x.id::text
              where r.status = 'open' and x.user_id = p.id))::integer,
         p.suspended_at, p.suspended_reason
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.profile_private pp on pp.id = p.id
    cross join q
   where q.t = '' or p.username like '%' || q.t || '%' or lower(coalesce(p.display_name, '')) like '%' || q.t || '%'
         or lower(u.email) like '%' || q.t || '%'
   order by p.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create or replace function public.admin_suspend_user(p_user uuid, p_on boolean, p_reason text default null)
returns void
language sql security definer set search_path = '' as $$
  update public.profiles
     set suspended_at = case when p_on then now() else null end,
         suspended_reason = case when p_on then nullif(btrim(coalesce(p_reason, '')), '') else null end
   where id = p_user;
$$;

create or replace function public.admin_reports_queue()
returns table (
  target_type text, target_id text, total integer, reasons text[], details text[], last_at timestamptz,
  community_slug text, community_name text, preview text, author_username text,
  post_id bigint, event_id bigint, game_id integer, profile_username text
)
language sql stable security definer set search_path = '' as $$
  select * from private.reports_queue_rows('open', true);
$$;

create or replace function public.admin_resolve_report(p_type text, p_target text, p_action text)
returns void
language sql security definer set search_path = '' as $$
  select private.resolve_report_core(p_type, p_target, p_action, null);
$$;

revoke all on function
  public.admin_app_overview(),
  public.admin_app_users(text, integer),
  public.admin_suspend_user(uuid, boolean, text),
  public.admin_reports_queue(),
  public.admin_resolve_report(text, text, text)
from public, anon, authenticated;

grant execute on function
  public.admin_app_overview(),
  public.admin_app_users(text, integer),
  public.admin_suspend_user(uuid, boolean, text),
  public.admin_reports_queue(),
  public.admin_resolve_report(text, text, text)
to service_role;
