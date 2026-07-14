-- Optimize Disk IO v2: Additional Indexes and Diagnostics

-- 1. Index for Map Page query (getRecentGeoTaggedPosts)
-- The query filters by latitude IS NOT NULL and sorts by created_at DESC.
-- A partial index drastically reduces the number of rows scanned.
CREATE INDEX IF NOT EXISTS idx_posts_geo_recent 
ON public.posts (created_at DESC) 
WHERE latitude IS NOT NULL;

-- 2. If you want to identify EXACTLY which queries are causing high Disk IO,
-- you can run this query in your Supabase SQL Editor:
-- (Uncomment to run)

-- SELECT 
--   query, 
--   calls, 
--   total_exec_time, 
--   rows, 
--   100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS cache_hit_percent,
--   shared_blks_read AS disk_blocks_read
-- FROM pg_stat_statements 
-- ORDER BY shared_blks_read DESC 
-- LIMIT 10;

-- Ensure you have run the indexes from the previous optimization script as well:
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv_id ON public.conversation_participants (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient_id ON public.email_notifications (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_actor_id ON public.email_notifications (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_processed_at ON public.email_notifications (processed_at);
