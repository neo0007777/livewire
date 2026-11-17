-- Migration: Allow multiple simultaneous live streams per creator
-- Prevents start_stream from forcibly killing a creator's active streams

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

