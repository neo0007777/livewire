-- Master Fix: Multi-Stream + Follow System + Activity Notifications
-- Run this in Supabase SQL Editor

-- 1. Allow 'new_follower' in notifications constraint
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('stream_live', 'viewer_milestone', 'highlights_ready', 'daily_digest', 'new_follower'));

-- 2. Grant INSERT permission on notifications to authenticated users
drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications for insert to authenticated with check (true);

-- 3. Atomic toggle_follow RPC function (handles follow + activity notification)
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

  -- Ensure profile exists
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

-- 4. Automatic database trigger when any follow is created
create or replace function public.on_follow_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_follower_name text;
begin
  select display_name into v_follower_name from public.profiles where id = new.follower_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    dedupe_key
  ) values (
    new.creator_id,
    'new_follower',
    'New Follower!',
    coalesce(v_follower_name, 'Someone') || ' started following you.',
    jsonb_build_object('follower_id', new.follower_id),
    'follow:' || new.follower_id || ':' || new.creator_id || ':' || extract(epoch from now())::text
  ) on conflict (user_id, dedupe_key) do nothing;

  return new;
end $$;

drop trigger if exists on_follow_created_trigger on public.follows;
create trigger on_follow_created_trigger
  after insert on public.follows
  for each row execute function public.on_follow_created();

-- 5. Multi-stream support (prevents auto-ending active broadcasts)
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

  -- Only auto-end streams that are completely abandoned (> 2 hours without heartbeat)
  update public.streams
     set status = 'ended', ended_at = now(), current_viewers = 0
   where creator_id = uid and status = 'live' and last_heartbeat_at < now() - interval '2 hours';

  -- Insert new live stream
  insert into public.streams (id, creator_id, title, room_name)
  values (new_id, uid, trim(p_title), 'stream_' || replace(new_id::text, '-', ''))
  returning * into result;

  -- Immediately notify all followers that this creator went live
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
