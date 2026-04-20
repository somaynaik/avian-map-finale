import { type User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const MEDIA_BUCKET = "media";

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  species_name: string;
  location_name: string | null;
  note: string | null;
  image_url: string;
  created_at: string;
  updated_at: string;
};

export type FeedPost = Post & {
  author: Profile | null;
  likes_count: number;
  liked_by_me: boolean;
};

export type UserDirectoryEntry = Profile & {
  follower_count: number;
  following_count: number;
  post_count: number;
  is_following: boolean;
};

export type ConversationSummary = {
  id: string;
  other_user: Profile | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

export type MessageRecord = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ProfileStats = {
  post_count: number;
  follower_count: number;
  following_count: number;
};

type FollowRow = {
  follower_id: string;
  following_id: string;
};

function getDefaultUsername(user: User) {
  return (
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    `birder_${user.id.slice(0, 8)}`
  )
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || `birder_${user.id.slice(0, 8)}`;
}

function fileNameSafe(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function getInitials(profile?: Pick<Profile, "username" | "full_name"> | null) {
  const source = profile?.full_name || profile?.username || "User";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return date.toLocaleDateString();
}

export async function ensureProfile(user: User) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: getDefaultUsername(user),
      full_name: user.user_metadata?.full_name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    },
    {
      onConflict: "id",
      ignoreDuplicates: true,
    },
  );

  if (error && error.code !== "23505") throw error;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function getUserDirectoryEntry(currentUserId: string, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;

  const [stats, followingRows] = await Promise.all([
    getProfileStats(userId),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", userId),
  ]);

  if (followingRows.error) throw followingRows.error;

  return {
    ...(profile as Profile),
    follower_count: stats.follower_count,
    following_count: stats.following_count,
    post_count: stats.post_count,
    is_following: (followingRows.data || []).length > 0,
  } as UserDirectoryEntry;
}

export async function updateProfile(
  userId: string,
  updates: Pick<Profile, "username" | "full_name" | "bio" | "avatar_url">,
) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      username: updates.username.trim().toLowerCase(),
      full_name: updates.full_name?.trim() || null,
      bio: updates.bio?.trim() || null,
      avatar_url: updates.avatar_url || null,
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function uploadAvatar(userId: string, file: File) {
  const path = `${userId}/avatar-${Date.now()}-${fileNameSafe(file.name)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadPostImage(userId: string, file: File) {
  const path = `posts/${userId}/${Date.now()}-${fileNameSafe(file.name)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createPost(input: {
  author_id: string;
  species_name: string;
  location_name?: string;
  note?: string;
  image_url: string;
}) {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.author_id,
      species_name: input.species_name.trim(),
      location_name: input.location_name?.trim() || null,
      note: input.note?.trim() || null,
      image_url: input.image_url,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Post;
}

export async function listFeedPosts(currentUserId: string) {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!posts?.length) return [] as FeedPost[];

  const authorIds = [...new Set(posts.map((post) => post.author_id))];
  const postIds = posts.map((post) => post.id);

  const [{ data: profiles }, { data: likes }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", authorIds),
    supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds),
  ]);

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile as Profile]));
  const likesByPost = new Map<string, Array<{ user_id: string }>>();

  for (const like of (likes || []) as { post_id: string; user_id: string }[]) {
    const existing = likesByPost.get(like.post_id) || [];
    existing.push({ user_id: like.user_id });
    likesByPost.set(like.post_id, existing);
  }

  return posts.map((post) => {
    const postLikes = likesByPost.get(post.id) || [];
    return {
      ...(post as Post),
      author: profileById.get(post.author_id) || null,
      likes_count: postLikes.length,
      liked_by_me: postLikes.some((like) => like.user_id === currentUserId),
    };
  });
}

export async function togglePostLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  if (error) throw error;
}

export async function listUsers(currentUserId: string, search: string) {
  let query = supabase
    .from("profiles")
    .select("*")
    .neq("id", currentUserId)
    .order("username", { ascending: true })
    .limit(50);

  const trimmed = search.trim();
  if (trimmed) {
    query = query.or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`);
  }

  const { data: profiles, error } = await query;
  if (error) throw error;

  const profileIds = (profiles || []).map((profile) => profile.id);
  if (!profileIds.length) return [] as UserDirectoryEntry[];

  const [{ data: followingRows }, { data: followerRows }, { data: posts }] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", currentUserId),
    supabase.from("follows").select("follower_id,following_id").in("following_id", profileIds),
    supabase.from("posts").select("author_id").in("author_id", profileIds),
  ]);

  const followingSet = new Set((followingRows || []).map((row) => row.following_id));
  const followerCounts = new Map<string, number>();
  const postCounts = new Map<string, number>();

  for (const row of (followerRows || []) as FollowRow[]) {
    followerCounts.set(row.following_id, (followerCounts.get(row.following_id) || 0) + 1);
  }

  for (const post of (posts || []) as Pick<Post, "author_id">[]) {
    postCounts.set(post.author_id, (postCounts.get(post.author_id) || 0) + 1);
  }

  const { data: followingTotals } = await supabase
    .from("follows")
    .select("follower_id,following_id")
    .in("follower_id", profileIds);

  const followingCounts = new Map<string, number>();
  for (const row of (followingTotals || []) as FollowRow[]) {
    followingCounts.set(row.follower_id, (followingCounts.get(row.follower_id) || 0) + 1);
  }

  return (profiles || []).map((profile) => ({
    ...(profile as Profile),
    follower_count: followerCounts.get(profile.id) || 0,
    following_count: followingCounts.get(profile.id) || 0,
    post_count: postCounts.get(profile.id) || 0,
    is_following: followingSet.has(profile.id),
  }));
}

export async function followUser(currentUserId: string, otherUserId: string) {
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: currentUserId, following_id: otherUserId });
  if (error) throw error;
}

export async function unfollowUser(currentUserId: string, otherUserId: string) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", otherUserId);
  if (error) throw error;
}

export async function getProfileStats(userId: string) {
  const [{ count: postCount, error: postError }, { count: followerCount, error: followerError }, { count: followingCount, error: followingError }] =
    await Promise.all([
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    ]);

  if (postError) throw postError;
  if (followerError) throw followerError;
  if (followingError) throw followingError;

  return {
    post_count: postCount || 0,
    follower_count: followerCount || 0,
    following_count: followingCount || 0,
  } as ProfileStats;
}

export async function getRecentPostsForUser(userId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data || []) as Post[];
}

async function getExistingConversationId(currentUserId: string, otherUserId: string) {
  const { data: myRows, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  if (error) throw error;
  if (!myRows?.length) return null;

  const conversationIds = myRows.map((row) => row.conversation_id);
  const { data: otherRows, error: otherError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", otherUserId)
    .in("conversation_id", conversationIds);

  if (otherError) throw otherError;
  return otherRows?.[0]?.conversation_id || null;
}

export async function getOrCreateDirectConversation(currentUserId: string, otherUserId: string) {
  const existingId = await getExistingConversationId(currentUserId, otherUserId);
  if (existingId) return existingId;

  const conversationId = crypto.randomUUID();
  const { error: conversationError } = await supabase
    .from("conversations")
    .insert({ id: conversationId });

  if (conversationError) throw conversationError;

  const { error: participantsError } = await supabase.from("conversation_participants").insert([
    { conversation_id: conversationId, user_id: currentUserId },
    { conversation_id: conversationId, user_id: otherUserId },
  ]);

  if (participantsError) throw participantsError;
  return conversationId;
}

export async function listConversations(currentUserId: string) {
  const { data: participantRows, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id,last_read_at")
    .eq("user_id", currentUserId);

  if (error) throw error;
  if (!participantRows?.length) return [] as ConversationSummary[];

  const conversationIds = participantRows.map((row) => row.conversation_id);
  const lastReadByConversation = new Map(
    participantRows.map((row) => [row.conversation_id, row.last_read_at || "1970-01-01T00:00:00.000Z"]),
  );

  const [{ data: allParticipants }, { data: messages }] = await Promise.all([
    supabase.from("conversation_participants").select("conversation_id,user_id").in("conversation_id", conversationIds),
    supabase.from("messages").select("*").in("conversation_id", conversationIds).order("created_at", { ascending: false }),
  ]);

  const otherUserIds = [...new Set(
    (allParticipants || [])
      .filter((row) => row.user_id !== currentUserId)
      .map((row) => row.user_id),
  )];

  const { data: profiles } = otherUserIds.length
    ? await supabase.from("profiles").select("*").in("id", otherUserIds)
    : { data: [] };

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile as Profile]));
  const otherUserByConversation = new Map(
    (allParticipants || [])
      .filter((row) => row.user_id !== currentUserId)
      .map((row) => [row.conversation_id, row.user_id]),
  );

  const messagesByConversation = new Map<string, MessageRecord[]>();
  for (const message of (messages || []) as MessageRecord[]) {
    const existing = messagesByConversation.get(message.conversation_id) || [];
    existing.push(message);
    messagesByConversation.set(message.conversation_id, existing);
  }

  return conversationIds
    .map((conversationId) => {
      const items = messagesByConversation.get(conversationId) || [];
      const latest = items[0];
      const unreadCount = items.filter((message) => {
        const lastReadAt = new Date(lastReadByConversation.get(conversationId) || 0).getTime();
        return message.sender_id !== currentUserId && new Date(message.created_at).getTime() > lastReadAt;
      }).length;

      return {
        id: conversationId,
        other_user: profileById.get(otherUserByConversation.get(conversationId) || "") || null,
        last_message: latest?.body || "",
        last_message_at: latest?.created_at || "1970-01-01T00:00:00.000Z",
        unread_count: unreadCount,
      } satisfies ConversationSummary;
    })
    .sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
    );
}

export async function getUnreadConversationCount(currentUserId: string) {
  const conversations = await listConversations(currentUserId);
  return conversations.reduce(
    (count, conversation) => count + (conversation.unread_count > 0 ? 1 : 0),
    0,
  );
}

export async function getConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as MessageRecord[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: trimmed,
  });

  if (error) throw error;

  const now = new Date().toISOString();
  const { error: readError } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", senderId);

  if (readError) throw readError;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}
