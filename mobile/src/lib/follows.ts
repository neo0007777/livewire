import { supabase } from './supabase';

/**
 * Check if followerId follows targetUserId
 */
export async function isUserFollowing(
  followerId: string,
  targetUserId: string
): Promise<boolean> {
  if (!followerId || !targetUserId) return false;
  try {
    const { data } = await supabase
      .from('follows')
      .select('creator_id')
      .eq('follower_id', followerId)
      .eq('creator_id', targetUserId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Toggle follow status:
 * - If following -> unfollows (deletes row)
 * - If not following -> follows (upserts row & sends notification)
 */
export async function toggleFollowUser(
  followerId: string,
  targetUserId: string,
  followerName?: string
): Promise<{ isFollowing: boolean }> {
  if (!followerId || !targetUserId || followerId === targetUserId) {
    return { isFollowing: false };
  }

  // 1. Try atomic database RPC first if available
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('toggle_follow', {
      p_creator_id: targetUserId,
    });
    if (!rpcErr && rpcData && typeof rpcData.is_following === 'boolean') {
      return { isFollowing: rpcData.is_following };
    }
  } catch {
    // Fall through to direct table operations
  }

  // 2. Direct table operations
  const isFollowing = await isUserFollowing(followerId, targetUserId);

  if (isFollowing) {
    // Unfollow: delete row
    const { error: delError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('creator_id', targetUserId);

    if (delError) {
      console.error('[Follows] Unfollow error:', delError);
      throw delError;
    }
    return { isFollowing: false };
  } else {
    // Follow: upsert row
    const { error: insError } = await supabase.from('follows').upsert(
      {
        follower_id: followerId,
        creator_id: targetUserId,
      },
      { onConflict: 'follower_id,creator_id' }
    );

    if (insError) {
      console.error('[Follows] Follow error:', insError);
      throw insError;
    }

    // Best-effort in-app activity notification
    try {
      const myName = followerName || 'Someone';
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        type: 'new_follower',
        title: 'New Follower!',
        body: `${myName} started following you.`,
        data: { follower_id: followerId },
        dedupe_key: `follow:${followerId}:${targetUserId}:${Date.now()}`,
      });
    } catch {
      // Best-effort delivery
    }

    return { isFollowing: true };
  }
}

