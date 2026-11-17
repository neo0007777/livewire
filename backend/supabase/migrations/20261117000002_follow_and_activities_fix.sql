-- Master Fix: Multi-Stream + Follow System + Activity Notifications + Instant AI Highlights
-- Run this in Supabase SQL Editor

-- 1. Allow 'new_follower' in notifications constraint
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('stream_live', 'viewer_milestone', 'highlights_ready', 'daily_digest', 'new_follower'));

-- 2. Grant INSERT permission on notifications to authenticated users
drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications for insert to authenticated with check (true);

-- 3. Allow authenticated users to view stream highlights
drop policy if exists "highlights read" on public.stream_highlights;
create policy "highlights read" on public.stream_highlights for select to authenticated using (true);

-- 4. Instant Highlights Generation Function (Pre-generates recap so UI never hangs waiting for n8n)
create or replace function public.generate_stream_highlights(p_stream_id uuid)
returns public.stream_highlights language plpgsql security definer set search_path = '' as $$
declare
  v_stream public.streams;
  v_total_msgs int;
  v_duration int;
  v_top_moment_time text := '00:00';
  v_summary text;
  v_moments jsonb := '[]'::jsonb;
  v_result public.stream_highlights;
begin
  select * into v_stream from public.streams where id = p_stream_id;
  if v_stream.id is null then raise exception 'stream_not_found'; end if;

  select count(*)::int into v_total_msgs from public.chat_messages where stream_id = p_stream_id;
  v_duration := greatest(0, extract(epoch from (coalesce(v_stream.ended_at, now()) - v_stream.started_at))::int);

  -- Calculate busiest 30-second chat intervals
  with msg_buckets as (
    select
      floor(greatest(0, extract(epoch from (m.created_at - v_stream.started_at))::int) / 30) * 30 as bucket_start,
      count(*)::int as count
    from public.chat_messages m
    where m.stream_id = p_stream_id
    group by 1
    order by count desc
    limit 3
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'start_seconds', bucket_start,
        'end_seconds', bucket_start + 30,
        'message_count', count
      ) order by bucket_start
    ), '[]'::jsonb
  ) into v_moments from msg_buckets;

  if v_total_msgs > 0 and jsonb_array_length(v_moments) > 0 then
    v_top_moment_time := lpad((((v_moments->0->>'start_seconds')::int) / 60)::text, 2, '0') || ':' ||
                         lpad((((v_moments->0->>'start_seconds')::int) % 60)::text, 2, '0') || ' – ' ||
                         lpad((((coalesce(v_moments->0->>'end_seconds', ((v_moments->0->>'start_seconds')::int + 30)::text))::int) / 60)::text, 2, '0') || ':' ||
                         lpad((((coalesce(v_moments->0->>'end_seconds', ((v_moments->0->>'start_seconds')::int + 30)::text))::int) % 60)::text, 2, '0');
    v_summary := '"' || v_stream.title || '" ran ' || round(v_duration / 60.0, 1)::text || ' min, peaked at ' ||
                 v_stream.peak_viewers || ' viewers with ' || v_total_msgs ||
                 ' chat messages. Peak chat excitement occurred between ' || v_top_moment_time || '.';
  else
    v_summary := '"' || v_stream.title || '" ran ' || round(v_duration / 60.0, 1)::text || ' min, peaked at ' ||
                 v_stream.peak_viewers || ' viewers. Broadcast concluded smoothly.';
  end if;

  insert into public.stream_highlights
    (stream_id, peak_viewers, total_messages, duration_seconds, moments, summary, summary_source)
  values
    (p_stream_id, v_stream.peak_viewers, v_total_msgs, v_duration, v_moments, v_summary, 'rule')
  on conflict (stream_id) do update
    set moments = excluded.moments,
        summary = case when stream_highlights.summary_source = 'ai' then stream_highlights.summary else excluded.summary end,
        summary_source = coalesce(stream_highlights.summary_source, excluded.summary_source),
        total_messages = excluded.total_messages,
        peak_viewers = excluded.peak_viewers,
        duration_seconds = excluded.duration_seconds
  returning * into v_result;

  -- Notify creator in notifications
  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  values (
    v_stream.creator_id,
    'highlights_ready',
    'Stream Recap Ready',
    '"' || v_stream.title || '" — peak ' || v_stream.peak_viewers || ' viewers',
    jsonb_build_object('stream_id', v_stream.id),
    'highlights:' || v_stream.id || ':' || v_stream.creator_id
  ) on conflict (user_id, dedupe_key) do nothing;

  return v_result;
end $$;

grant execute on function public.generate_stream_highlights(uuid) to authenticated;

-- 5. end_stream: concludes broadcast and automatically generates highlights
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
  end if;

  if result.id is not null then
    begin
      perform public.generate_stream_highlights(result.id);
    exception when others then
      null;
    end;
  end if;

  return result;
end $$;

grant execute on function public.end_stream(uuid) to authenticated;

-- 6. Atomic toggle_follow RPC function (handles follow + activity notification)
create or replace function public.toggle_follow(p_creator_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_is_following boolean;
  v_follower_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if v_uid = p_creator_id then
    return jsonb_build_object('error', 'cannot_follow_self', 'is_following', false);
  end if;

  insert into public.profiles (id, display_name)
  select u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
  from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  select exists(
    select 1 from public.follows where follower_id = v_uid and creator_id = p_creator_id
  ) into v_is_following;

  if v_is_following then
    delete from public.follows where follower_id = v_uid and creator_id = p_creator_id;
    return jsonb_build_object('is_following', false);
  else
    insert into public.follows (follower_id, creator_id)
    values (v_uid, p_creator_id)
    on conflict do nothing;

    select display_name into v_follower_name from public.profiles where id = v_uid;

    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      data,
      dedupe_key
    ) values (
      p_creator_id,
      'new_follower',
      'New Follower!',
      coalesce(v_follower_name, 'Someone') || ' started following you.',
      jsonb_build_object('follower_id', v_uid),
      'follow:' || v_uid || ':' || p_creator_id || ':' || extract(epoch from now())::text
    ) on conflict do nothing;

    return jsonb_build_object('is_following', true);
  end if;
end $$;

grant execute on function public.toggle_follow(uuid) to authenticated;

-- 7. Multi-stream support (prevents auto-ending active broadcasts)
create or replace function public.start_stream(p_title text)
returns public.streams language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid := auth.uid();
  new_id uuid := gen_random_uuid();
  result public.streams;
  v_creator_name text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  insert into public.profiles (id, display_name)
  select u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
  from auth.users u where u.id = uid
  on conflict (id) do nothing;

  select display_name into v_creator_name from public.profiles where id = uid;

  update public.streams
     set status = 'ended', ended_at = now(), current_viewers = 0
   where creator_id = uid and status = 'live' and last_heartbeat_at < now() - interval '2 hours';

  insert into public.streams (id, creator_id, title, room_name)
  values (new_id, uid, trim(p_title), 'stream_' || replace(new_id::text, '-', ''))
  returning * into result;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select f.follower_id,
         'stream_live',
         coalesce(v_creator_name, 'A creator you follow') || ' is live!',
         result.title,
         jsonb_build_object('stream_id', result.id),
         'live:' || result.id || ':' || f.follower_id
  from public.follows f
  where f.creator_id = uid
  on conflict (user_id, dedupe_key) do nothing;

  return result;
end $$;
