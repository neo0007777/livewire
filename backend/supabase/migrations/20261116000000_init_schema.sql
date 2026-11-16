-- Block A — extensions, private schema, config
create extension if not exists pg_net with schema extensions;   -- provides net.http_post
create extension if not exists pg_cron;                         -- provides cron.schedule

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key   text primary key,
  value text not null
);

insert into private.app_config (key, value) values
  ('n8n_base_url', ''),                    -- e.g. https://myname.app.n8n.cloud (no trailing slash)
  ('n8n_webhook_secret', ''),              -- shared secret header
  ('viewer_milestones', '2,10,50,100,500') -- 2 is the demo threshold
on conflict (key) do nothing;

-- Block B — tables and indexes
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  created_at   timestamptz not null default now()
);

create table if not exists public.push_tokens (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  updated_at      timestamptz not null default now()
);

create table if not exists public.streams (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references public.profiles(id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 80),
  status            text not null default 'live' check (status in ('live', 'ended')),
  room_name         text not null unique,
  current_viewers   int  not null default 0 check (current_viewers >= 0),
  peak_viewers      int  not null default 0 check (peak_viewers >= 0),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  last_heartbeat_at timestamptz not null default now()
);

create unique index if not exists streams_one_live_per_creator on public.streams (creator_id) where status = 'live';
create index if not exists streams_status_started_idx on public.streams (status, started_at desc);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);
create index if not exists follows_creator_idx on public.follows (creator_id);

create table if not exists public.chat_messages (
  id          uuid primary key,
  seq         bigint generated always as identity unique,
  stream_id   uuid not null references public.streams(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  content     text not null check (char_length(trim(content)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_stream_seq_idx on public.chat_messages (stream_id, seq);
create index if not exists chat_messages_user_time_idx  on public.chat_messages (user_id, created_at desc);

create table if not exists public.stream_milestones (
  stream_id    uuid not null references public.streams(id) on delete cascade,
  milestone    int  not null,
  viewer_count int  not null,
  reached_at   timestamptz not null default now(),
  primary key (stream_id, milestone)
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('stream_live', 'viewer_milestone', 'highlights_ready', 'daily_digest')),
  title      text not null,
  body       text not null default '',
  data       jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notifications_user_time_idx on public.notifications (user_id, created_at desc);

create table if not exists public.stream_highlights (
  stream_id        uuid primary key references public.streams(id) on delete cascade,
  peak_viewers     int  not null default 0,
  total_messages   int  not null default 0,
  duration_seconds int  not null default 0,
  moments          jsonb not null default '[]'::jsonb,
  summary          text not null default '',
  summary_source   text not null default 'rule' check (summary_source in ('ai', 'rule')),
  created_at       timestamptz not null default now()
);

create table if not exists public.daily_digests (
  id          uuid primary key default gen_random_uuid(),
  digest_date date not null unique,
  top_streams jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- Block C — signup trigger and chat trigger
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 30)
  )
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.chat_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recent int;
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select p.display_name into new.author_name from public.profiles p where p.id = new.user_id;

  select count(*) into recent
  from public.chat_messages m
  where m.user_id = new.user_id and m.created_at > now() - interval '5 seconds';
  if recent >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  new.content := trim(new.content);
  new.created_at := now();
  return new;
end $$;

drop trigger if exists chat_messages_before_insert on public.chat_messages;
create trigger chat_messages_before_insert
  before insert on public.chat_messages
  for each row execute function private.chat_before_insert();

-- Block D — RPC functions called by the app
create or replace function public.start_stream(p_title text)
returns public.streams language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid := auth.uid();
  new_id uuid := gen_random_uuid();
  result public.streams;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  update public.streams
     set status = 'ended', ended_at = now(), current_viewers = 0
   where creator_id = uid and status = 'live';

  insert into public.streams (id, creator_id, title, room_name)
  values (new_id, uid, trim(p_title), 'stream_' || replace(new_id::text, '-', ''))
  returning * into result;

  return result;
end $$;

create or replace function public.end_stream(p_stream_id uuid)
returns public.streams language plpgsql security definer set search_path = '' as $$
declare
  result public.streams;
begin
  update public.streams
     set status = 'ended', ended_at = now(), current_viewers = 0
   where id = p_stream_id and creator_id = auth.uid() and status = 'live'
  returning * into result;

  if result.id is null then
    select * into result from public.streams where id = p_stream_id and creator_id = auth.uid();
    if result.id is null then raise exception 'not_found_or_not_owner' using errcode = 'P0001'; end if;
  end if;
  return result;
end $$;

create or replace function public.report_viewer_count(p_stream_id uuid, p_count int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_count    int := greatest(coalesce(p_count, 0), 0);
  thresholds int[];
begin
  update public.streams
     set current_viewers   = v_count,
         peak_viewers      = greatest(peak_viewers, v_count),
         last_heartbeat_at = now()
   where id = p_stream_id and creator_id = auth.uid() and status = 'live';

  if not found then return; end if;

  select string_to_array(value, ',')::int[] into thresholds
  from private.app_config where key = 'viewer_milestones';

  insert into public.stream_milestones (stream_id, milestone, viewer_count)
  select p_stream_id, m, v_count
  from unnest(coalesce(thresholds, '{}'::int[])) as m
  where v_count >= m
  on conflict (stream_id, milestone) do nothing;
end $$;

revoke execute on function public.start_stream(text)              from public, anon;
revoke execute on function public.end_stream(uuid)                from public, anon;
revoke execute on function public.report_viewer_count(uuid, int)  from public, anon;
grant  execute on function public.start_stream(text)              to authenticated;
grant  execute on function public.end_stream(uuid)                to authenticated;
grant  execute on function public.report_viewer_count(uuid, int)  to authenticated;

-- Block E — Row Level Security
alter table public.profiles          enable row level security;
alter table public.push_tokens       enable row level security;
alter table public.streams           enable row level security;
alter table public.follows           enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.stream_milestones enable row level security;
alter table public.notifications     enable row level security;
alter table public.stream_highlights enable row level security;
alter table public.daily_digests     enable row level security;

-- profiles
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- push_tokens
drop policy if exists "push_tokens own select" on public.push_tokens;
create policy "push_tokens own select" on public.push_tokens for select to authenticated using (user_id = auth.uid());
drop policy if exists "push_tokens own insert" on public.push_tokens;
create policy "push_tokens own insert" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "push_tokens own update" on public.push_tokens;
create policy "push_tokens own update" on public.push_tokens for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "push_tokens own delete" on public.push_tokens;
create policy "push_tokens own delete" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

-- streams
drop policy if exists "streams read" on public.streams;
create policy "streams read" on public.streams for select to authenticated using (true);

-- follows
drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select to authenticated using (true);
drop policy if exists "follows insert" on public.follows;
create policy "follows insert" on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "follows delete" on public.follows;
create policy "follows delete" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- chat
drop policy if exists "chat read" on public.chat_messages;
create policy "chat read" on public.chat_messages for select to authenticated using (true);
drop policy if exists "chat insert" on public.chat_messages;
create policy "chat insert" on public.chat_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.streams s where s.id = stream_id and s.status = 'live')
  );

-- milestones
drop policy if exists "milestones creator read" on public.stream_milestones;
create policy "milestones creator read" on public.stream_milestones for select to authenticated
  using (exists (select 1 from public.streams s where s.id = stream_id and s.creator_id = auth.uid()));

-- notifications
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- highlights + digests
drop policy if exists "highlights read" on public.stream_highlights;
create policy "highlights read" on public.stream_highlights for select to authenticated using (true);
drop policy if exists "digests read" on public.daily_digests;
create policy "digests read" on public.daily_digests for select to authenticated using (true);

-- Block F — n8n event triggers (pg_net) and stale-stream cron
create or replace function private.notify_n8n(p_path text, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_base   text;
  v_secret text;
begin
  select value into v_base   from private.app_config where key = 'n8n_base_url';
  select value into v_secret from private.app_config where key = 'n8n_webhook_secret';
  if coalesce(v_base, '') = '' then return; end if;

  perform net.http_post(
    url     := v_base || p_path,
    body    := p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
end $$;

create or replace function private.streams_after_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    perform private.notify_n8n('/webhook/stream-live', jsonb_build_object(
      'event', 'stream.live', 'stream_id', new.id, 'creator_id', new.creator_id,
      'title', new.title, 'started_at', new.started_at));
  elsif tg_op = 'UPDATE' and new.status = 'ended' and old.status = 'live' then
    perform private.notify_n8n('/webhook/stream-ended', jsonb_build_object(
      'event', 'stream.ended', 'stream_id', new.id, 'creator_id', new.creator_id,
      'title', new.title, 'started_at', new.started_at, 'ended_at', new.ended_at,
      'peak_viewers', new.peak_viewers));
  end if;
  return new;
end $$;

drop trigger if exists streams_notify_n8n on public.streams;
create trigger streams_notify_n8n
  after insert or update of status on public.streams
  for each row execute function private.streams_after_change();

create or replace function private.milestones_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.streams;
begin
  select * into s from public.streams where id = new.stream_id;
  perform private.notify_n8n('/webhook/viewer-milestone', jsonb_build_object(
    'event', 'stream.milestone', 'stream_id', new.stream_id, 'creator_id', s.creator_id,
    'title', s.title, 'milestone', new.milestone, 'viewer_count', new.viewer_count,
    'reached_at', new.reached_at));
  return new;
end $$;

drop trigger if exists stream_milestones_notify_n8n on public.stream_milestones;
create trigger stream_milestones_notify_n8n
  after insert on public.stream_milestones
  for each row execute function private.milestones_after_insert();

create or replace function private.end_stale_streams()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.streams
     set status = 'ended', ended_at = last_heartbeat_at, current_viewers = 0
   where status = 'live' and last_heartbeat_at < now() - interval '90 seconds';
  get diagnostics n = row_count;
  return n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('end-stale-streams');
    perform cron.schedule('end-stale-streams', '* * * * *', 'select private.end_stale_streams();');
  end if;
exception when others then
  null;
end $$;

-- Block G — functions n8n calls
create or replace function private.n8n_on_stream_live(p_stream_id uuid)
returns table (expo_push_token text, title text, body text, data jsonb)
language sql security definer set search_path = '' as $$
  with s as (
    select st.id, st.creator_id, st.title, p.display_name
    from public.streams st join public.profiles p on p.id = st.creator_id
    where st.id = p_stream_id and st.status = 'live'
  ),
  ins as (
    insert into public.notifications (user_id, type, title, body, data, dedupe_key)
    select f.follower_id, 'stream_live',
           s.display_name || ' is live', s.title,
           jsonb_build_object('stream_id', s.id),
           'live:' || s.id
    from s join public.follows f on f.creator_id = s.creator_id
    on conflict (user_id, dedupe_key) do nothing
    returning user_id, title, body, data
  )
  select pt.expo_push_token, ins.title, ins.body, ins.data
  from ins join public.push_tokens pt on pt.user_id = ins.user_id;
$$;

create or replace function private.n8n_on_milestone(p_stream_id uuid, p_milestone int)
returns table (expo_push_token text, title text, body text, data jsonb)
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.notifications (user_id, type, title, body, data, dedupe_key)
    select st.creator_id, 'viewer_milestone',
           p_milestone || '+ viewers watching!',
           '"' || st.title || '" just reached ' || p_milestone || ' viewers.',
           jsonb_build_object('stream_id', st.id, 'milestone', p_milestone),
           'milestone:' || st.id || ':' || p_milestone
    from public.streams st where st.id = p_stream_id
    on conflict (user_id, dedupe_key) do nothing
    returning user_id, title, body, data
  )
  select pt.expo_push_token, ins.title, ins.body, ins.data
  from ins join public.push_tokens pt on pt.user_id = ins.user_id;
$$;

create or replace function private.n8n_highlight_input(p_stream_id uuid)
returns table (
  stream_id uuid, title text, creator_id uuid, peak_viewers int,
  duration_seconds int, total_messages int, messages jsonb
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.title, s.creator_id, s.peak_viewers,
         greatest(0, extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int),
         (select count(*)::int from public.chat_messages m where m.stream_id = s.id),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'offset_seconds', greatest(0, extract(epoch from (x.created_at - s.started_at))::int),
                    'author_name', x.author_name,
                    'content', x.content) order by x.seq)
           from (select * from public.chat_messages m
                 where m.stream_id = s.id order by m.seq desc limit 2000) x
         ), '[]'::jsonb)
  from public.streams s where s.id = p_stream_id;
$$;

create or replace function private.n8n_save_highlight(
  p_stream_id uuid, p_moments_json text, p_summary text, p_source text)
returns void language sql security definer set search_path = '' as $$
  insert into public.stream_highlights
    (stream_id, peak_viewers, total_messages, duration_seconds, moments, summary, summary_source)
  select s.id, s.peak_viewers,
         (select count(*)::int from public.chat_messages m where m.stream_id = s.id),
         greatest(0, extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int),
         p_moments_json::jsonb, p_summary, p_source
  from public.streams s where s.id = p_stream_id
  on conflict (stream_id) do update
    set moments = excluded.moments, summary = excluded.summary,
        summary_source = excluded.summary_source, total_messages = excluded.total_messages,
        peak_viewers = excluded.peak_viewers, duration_seconds = excluded.duration_seconds,
        created_at = now();
$$;

create or replace function private.n8n_on_highlights_ready(p_stream_id uuid)
returns table (expo_push_token text, title text, body text, data jsonb)
language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.notifications (user_id, type, title, body, data, dedupe_key)
    select st.creator_id, 'highlights_ready', 'Your stream recap is ready',
           '"' || st.title || '" — peak ' || st.peak_viewers || ' viewers',
           jsonb_build_object('stream_id', st.id),
           'highlights:' || st.id
    from public.streams st where st.id = p_stream_id
    on conflict (user_id, dedupe_key) do nothing
    returning user_id, title, body, data
  )
  select pt.expo_push_token, ins.title, ins.body, ins.data
  from ins join public.push_tokens pt on pt.user_id = ins.user_id;
$$;

create or replace function private.n8n_daily_digest()
returns table (expo_push_token text, title text, body text, data jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  v_top   jsonb;
  v_date  date := current_date;
  v_body  text;
begin
  select coalesce(jsonb_agg(t order by t.peak_viewers desc, t.total_messages desc), '[]'::jsonb)
  into v_top
  from (
    select s.id as stream_id, s.title, p.display_name as creator_name, s.peak_viewers,
           (select count(*)::int from public.chat_messages m where m.stream_id = s.id) as total_messages,
           s.started_at
    from public.streams s join public.profiles p on p.id = s.creator_id
    where s.started_at > now() - interval '24 hours'
    order by s.peak_viewers desc, total_messages desc
    limit 5
  ) t;

  insert into public.daily_digests (digest_date, top_streams) values (v_date, v_top)
  on conflict (digest_date) do update set top_streams = excluded.top_streams, created_at = now();

  if jsonb_array_length(v_top) = 0 then
    v_body := 'No streams yesterday. Be the first to go live today!';
  else
    v_body := 'Top stream: "' || (v_top -> 0 ->> 'title') || '" by ' || (v_top -> 0 ->> 'creator_name')
              || ' (' || (v_top -> 0 ->> 'peak_viewers') || ' peak viewers)';
  end if;

  return query
  with ins as (
    insert into public.notifications (user_id, type, title, body, data, dedupe_key)
    select p.id, 'daily_digest', 'Your daily LiveWire digest', v_body,
           jsonb_build_object('digest_date', v_date), 'digest:' || v_date
    from public.profiles p
    on conflict (user_id, dedupe_key) do nothing
    returning user_id, notifications.title, notifications.body, notifications.data
  )
  select pt.expo_push_token, ins.title, ins.body, ins.data
  from ins join public.push_tokens pt on pt.user_id = ins.user_id;
end $$;

revoke execute on all functions in schema private from public, anon, authenticated;

-- Block H — Realtime publication
do $$
begin
  alter publication supabase_realtime add table
    public.chat_messages, public.streams, public.notifications, public.stream_highlights;
exception when others then
  null;
end $$;

