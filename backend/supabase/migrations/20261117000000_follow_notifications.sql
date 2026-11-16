-- Migration: 20261117000000_follow_notifications.sql
-- Description: Enable new_follower notifications, automatic follow triggers, and live stream notifications for followers

-- 1. Update notifications type check to include 'new_follower'
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('stream_live', 'viewer_milestone', 'highlights_ready', 'daily_digest', 'new_follower'));

-- 2. Allow authenticated clients to insert notifications
drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications for insert to authenticated with check (true);

-- 3. Automatic trigger when a user follows a creator
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

-- 4. Update start_stream RPC to immediately notify all followers in their inbox
create or replace function public.start_stream(p_title text)
returns public.streams language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid := auth.uid();
  new_id uuid := gen_random_uuid();
  result public.streams;
  v_creator_name text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  -- Ensure profile row exists in public.profiles for the creator
  insert into public.profiles (id, display_name)
  select u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
  from auth.users u where u.id = uid
  on conflict (id) do nothing;

  select display_name into v_creator_name from public.profiles where id = uid;

  -- End previous active stream for creator
  update public.streams
     set status = 'ended', ended_at = now(), current_viewers = 0
   where creator_id = uid and status = 'live';

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

