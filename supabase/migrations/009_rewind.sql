-- Quicksave App · 009_rewind.sql
-- Rewind: retrospectiva anual (você publica) e mensal (automática, pelo pg_cron).
-- O cálculo usa o histórico (events) e fica salvo em "rewinds" quando o período é gerado.
-- Rodar no SQL Editor do projeto Supabase DO APP, depois do 008. Pode rodar de novo sem problema.
-- Para o mensal automático: ligue a extensão pg_cron ANTES (Database > Extensions) ou rode este arquivo de novo depois.

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------
create table if not exists public.rewind_periods (
  id text primary key check (id ~ '^\d{4}(-\d{2})?$'), -- "2026" (ano) ou "2026-11" (mês)
  kind text not null check (kind in ('year', 'month')),
  title text not null check (char_length(title) between 3 and 60),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  status text not null default 'draft' check (status in ('draft', 'published')),
  generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rewinds (
  period_id text not null references public.rewind_periods (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  data jsonb not null,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (period_id, user_id)
);
create index if not exists rewinds_user_idx on public.rewinds (user_id);

alter table public.rewind_periods enable row level security;
alter table public.rewinds enable row level security;
revoke all on public.rewind_periods, public.rewinds from anon, authenticated;

-- Aviso "Seu Rewind chegou" no sino
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'friend_request', 'friend_accepted', 'group_invite', 'reaction', 'comment', 'review_like', 'group_activity',
  'post_reply', 'mod_action', 'report', 'rewind'
));

-- ---------------------------------------------------------------
-- Cálculo de um Rewind (uma pessoa, um intervalo de datas)
-- Datas no fuso de São Paulo. Um jogo conta se teve atividade no período
-- (começou, zerou, largou, avaliou ou escreveu review).
-- ---------------------------------------------------------------
create or replace function private.rewind_compute(p_user uuid, p_start date, p_end date, p_kind text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ini timestamptz := p_start::timestamp at time zone 'America/Sao_Paulo';
  v_fim timestamptz := (p_end + 1)::timestamp at time zone 'America/Sao_Paulo';
  v_jogos integer[];
  v_zerados integer[];
  v_largados integer[];
  v_meus_zerados integer;
  v_percentil integer;
  v_total_jogadores integer;
begin
  v_jogos := array(select distinct e.game_id from public.events e
                    where e.user_id = p_user and e.type <> 'wishlisted' and e.created_at >= v_ini and e.created_at < v_fim);
  v_zerados := array(select distinct e.game_id from public.events e
                      where e.user_id = p_user and e.type = 'finished' and e.created_at >= v_ini and e.created_at < v_fim);
  v_largados := array(select distinct e.game_id from public.events e
                       where e.user_id = p_user and e.type = 'dropped' and e.created_at >= v_ini and e.created_at < v_fim);
  v_meus_zerados := cardinality(v_zerados);

  -- Comparação com quem jogou no mesmo período (só números)
  with por_pessoa as (
    select e.user_id, count(distinct e.game_id) filter (where e.type = 'finished') as z
      from public.events e
     where e.type <> 'wishlisted' and e.created_at >= v_ini and e.created_at < v_fim
     group by e.user_id
  )
  select count(*)::integer,
         case when count(*) > 0 then round(100.0 * count(*) filter (where z < v_meus_zerados) / count(*))::integer else 0 end
    into v_total_jogadores, v_percentil
    from por_pessoa;

  return jsonb_build_object(
    'jogos', cardinality(v_jogos),
    'zerados', v_meus_zerados,
    'largados', cardinality(v_largados),
    'horas', coalesce((select sum(l.hours_played) from public.logs l
                        where l.user_id = p_user and l.game_id = any(v_zerados || v_largados)), 0),
    'reviews', (select count(*) from public.logs l
                 where l.user_id = p_user and l.game_id = any(v_jogos) and l.review is not null
                   and exists (select 1 from public.events e
                                where e.user_id = p_user and e.game_id = l.game_id
                                  and (e.type = 'reviewed' or e.with_review)
                                  and e.created_at >= v_ini and e.created_at < v_fim)),
    'media_notas', (select round(avg(l.rating), 1) from public.logs l
                     where l.user_id = p_user and l.game_id = any(v_jogos) and l.rating is not null),
    'top', coalesce((select jsonb_agg(x) from (
              select g.igdb_id as id, g.name, g.cover_image_id as cover, l.rating, l.status
                from public.logs l join public.games g on g.igdb_id = l.game_id
               where l.user_id = p_user and l.game_id = any(v_jogos) and l.rating is not null
               order by l.rating desc, l.updated_at desc
               limit 5) x), '[]'::jsonb),
    'genero_favorito', (select gen from public.logs l join public.games g on g.igdb_id = l.game_id, unnest(g.genres) as gen
                         where l.user_id = p_user and l.game_id = any(v_jogos)
                         group by gen order by count(*) desc, gen limit 1),
    'generos_distintos', (select count(distinct gen) from public.logs l join public.games g on g.igdb_id = l.game_id, unnest(g.genres) as gen
                           where l.user_id = p_user and l.game_id = any(v_jogos))::integer,
    'plataforma_favorita', (select l.platform from public.logs l
                             where l.user_id = p_user and l.game_id = any(v_jogos) and l.platform is not null
                             group by l.platform order by count(*) desc, l.platform limit 1),
    'meses', case when p_kind = 'year' then (
               select jsonb_agg(coalesce(c.n, 0) order by m.mes)
                 from generate_series(1, 12) as m(mes)
                 left join (
                   select extract(month from e.created_at at time zone 'America/Sao_Paulo')::integer as mes,
                          count(distinct e.game_id) as n
                     from public.events e
                    where e.user_id = p_user and e.type <> 'wishlisted' and e.created_at >= v_ini and e.created_at < v_fim
                    group by 1) c on c.mes = m.mes)
             end,
    'review_mais_curtida', (select jsonb_build_object('id', g.igdb_id, 'name', g.name, 'cover', g.cover_image_id,
                                                      'trecho', left(l.review, 160), 'spoiler', l.has_spoilers, 'curtidas', x.n)
                              from public.logs l
                              join public.games g on g.igdb_id = l.game_id
                              join lateral (select count(*) as n from public.review_likes rl
                                             where rl.owner_id = l.user_id and rl.game_id = l.game_id) x on true
                             where l.user_id = p_user and l.game_id = any(v_jogos) and l.review is not null and x.n > 0
                             order by x.n desc limit 1),
    'reacoes_recebidas', (select count(*) from public.event_reactions r join public.events e on e.id = r.event_id
                           where e.user_id = p_user and r.user_id <> p_user and r.created_at >= v_ini and r.created_at < v_fim)::integer,
    'comentarios_recebidos', (select count(*) from public.event_comments c join public.events e on e.id = c.event_id
                               where e.user_id = p_user and c.user_id <> p_user and c.created_at >= v_ini and c.created_at < v_fim)::integer,
    'curtidas_reviews', (select count(*) from public.review_likes rl
                          where rl.owner_id = p_user and rl.created_at >= v_ini and rl.created_at < v_fim)::integer,
    'topicos', (select count(*) from public.community_posts p
                 where p.user_id = p_user and p.removed_at is null and p.created_at >= v_ini and p.created_at < v_fim)::integer,
    'respostas', (select count(*) from public.community_replies r
                   where r.user_id = p_user and r.removed_at is null and r.created_at >= v_ini and r.created_at < v_fim)::integer,
    'novos_amigos', (select count(*) from public.friendships f
                      where f.status = 'accepted' and (f.requester = p_user or f.addressee = p_user)
                        and f.accepted_at >= v_ini and f.accepted_at < v_fim)::integer,
    'quero_jogar', (select count(distinct e.game_id) from public.events e
                     where e.user_id = p_user and e.type = 'wishlisted' and e.created_at >= v_ini and e.created_at < v_fim)::integer,
    'percentil_zerados', v_percentil,
    'total_jogadores', v_total_jogadores
  );
end;
$$;

-- Gera (ou atualiza) o Rewind de todo mundo que teve atividade no período
create or replace function private.rewind_generate(p_period text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.rewind_periods%rowtype;
  v_total integer;
begin
  select * into v_p from public.rewind_periods where id = p_period;
  if not found then raise exception 'periodo_nao_encontrado'; end if;

  insert into public.rewinds (period_id, user_id, data)
  select v_p.id, u.user_id, private.rewind_compute(u.user_id, v_p.starts_on, v_p.ends_on, v_p.kind)
    from (
      select distinct e.user_id
        from public.events e
        join public.profiles pr on pr.id = e.user_id and pr.username is not null
       where e.type <> 'wishlisted'
         and e.created_at >= (v_p.starts_on::timestamp at time zone 'America/Sao_Paulo')
         and e.created_at < ((v_p.ends_on + 1)::timestamp at time zone 'America/Sao_Paulo')
    ) u
  on conflict (period_id, user_id) do update set data = excluded.data, created_at = now();
  get diagnostics v_total = row_count;

  update public.rewind_periods set generated_at = now() where id = p_period;
  return v_total;
end;
$$;

create or replace function private.rewind_publish(p_period text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.rewind_periods set status = 'published', published_at = now() where id = p_period and status = 'draft';
  if not found then return; end if;
  insert into public.notifications (user_id, type)
  select r.user_id, 'rewind' from public.rewinds r where r.period_id = p_period;
end;
$$;

-- Mensal automático: cria o período do mês anterior, gera e publica (chamado pelo pg_cron no dia 1)
create or replace function private.rewind_auto_month()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ini date := date_trunc('month', (now() at time zone 'America/Sao_Paulo') - interval '1 month')::date;
  v_fim date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date - 1);
  v_id text := to_char(v_ini, 'YYYY-MM');
  v_meses text[] := array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                          'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
begin
  insert into public.rewind_periods (id, kind, title, starts_on, ends_on)
  values (v_id, 'month', 'Rewind de ' || v_meses[extract(month from v_ini)::integer] || ' de ' || extract(year from v_ini)::integer,
          v_ini, v_fim)
  on conflict (id) do nothing;
  perform private.rewind_generate(v_id);
  perform private.rewind_publish(v_id);
end;
$$;

revoke all on all functions in schema private from public, anon;

-- ---------------------------------------------------------------
-- Funções do admin (role = 'admin')
-- ---------------------------------------------------------------
create or replace function public.admin_rewind_periods()
returns table (id text, kind text, title text, starts_on date, ends_on date, status text,
               generated_at timestamptz, published_at timestamptz, people integer, seen integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.title, p.starts_on, p.ends_on, p.status, p.generated_at, p.published_at,
         (select count(*) from public.rewinds r where r.period_id = p.id)::integer,
         (select count(*) from public.rewinds r where r.period_id = p.id and r.seen_at is not null)::integer
    from public.rewind_periods p
   where public.is_admin()
   order by p.starts_on desc, p.kind;
$$;

create or replace function public.admin_create_rewind_period(p_id text, p_kind text, p_title text, p_start date, p_end date)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'sem_acesso'; end if;
  insert into public.rewind_periods (id, kind, title, starts_on, ends_on)
  values (p_id, p_kind, btrim(p_title), p_start, p_end)
  on conflict (id) do update set title = excluded.title, starts_on = excluded.starts_on, ends_on = excluded.ends_on;
end;
$$;

create or replace function public.admin_generate_rewind(p_period text)
returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'sem_acesso'; end if;
  return private.rewind_generate(p_period);
end;
$$;

create or replace function public.admin_publish_rewind(p_period text, p_publish boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'sem_acesso'; end if;
  if p_publish then
    perform private.rewind_publish(p_period);
  else
    update public.rewind_periods set status = 'draft', published_at = null where id = p_period;
  end if;
end;
$$;

create or replace function public.admin_delete_rewind_period(p_period text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'sem_acesso'; end if;
  delete from public.rewind_periods where id = p_period;
end;
$$;

-- ---------------------------------------------------------------
-- Para cada pessoa
-- ---------------------------------------------------------------

-- Seus Rewinds publicados (o admin também vê os rascunhos, para conferir antes)
create or replace function public.my_rewinds()
returns table (id text, kind text, title text, starts_on date, ends_on date, status text, seen boolean, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.title, p.starts_on, p.ends_on, p.status, r.seen_at is not null, p.published_at
    from public.rewinds r
    join public.rewind_periods p on p.id = r.period_id
   where r.user_id = auth.uid()
     and (p.status = 'published' or public.is_admin())
   order by p.ends_on desc, p.kind desc;
$$;

-- Abre um Rewind (e marca como visto)
create or replace function public.rewind_view(p_period text)
returns table (id text, kind text, title text, starts_on date, ends_on date, status text, username text, data jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  update public.rewinds r set seen_at = coalesce(r.seen_at, now())
   where r.period_id = p_period and r.user_id = auth.uid()
     and exists (select 1 from public.rewind_periods p where p.id = p_period and p.status = 'published');

  return query
  select p.id, p.kind, p.title, p.starts_on, p.ends_on, p.status, u.username, r.data
    from public.rewinds r
    join public.rewind_periods p on p.id = r.period_id
    join public.profiles u on u.id = r.user_id
   where r.period_id = p_period and r.user_id = auth.uid()
     and (p.status = 'published' or public.is_admin());
end;
$$;

-- ---------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------
revoke all on function
  public.admin_rewind_periods(),
  public.admin_create_rewind_period(text, text, text, date, date),
  public.admin_generate_rewind(text),
  public.admin_publish_rewind(text, boolean),
  public.admin_delete_rewind_period(text),
  public.my_rewinds(),
  public.rewind_view(text)
from public, anon;

grant execute on function
  public.admin_rewind_periods(),
  public.admin_create_rewind_period(text, text, text, date, date),
  public.admin_generate_rewind(text),
  public.admin_publish_rewind(text, boolean),
  public.admin_delete_rewind_period(text),
  public.my_rewinds(),
  public.rewind_view(text)
to authenticated;

-- ---------------------------------------------------------------
-- Mensal automático: dia 1, às 6h de Brasília (9h UTC). Só se o pg_cron estiver ligado.
-- ---------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'rewind-mensal';
    perform cron.schedule('rewind-mensal', '0 9 1 * *', 'select private.rewind_auto_month()');
  end if;
end;
$$;
