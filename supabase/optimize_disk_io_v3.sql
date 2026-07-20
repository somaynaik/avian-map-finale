-- ==============================================================
-- Disk IO Optimization v3
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ==============================================================

-- ---------------------------------------------------------------
-- 1. INCREASE shared_buffers cache hit rate
--    (Run these in the Supabase Dashboard > Database > Settings)
--    These cannot be set via SQL on managed instances but are 
--    listed here for reference when upgrading compute tier.
-- 
--    ALTER SYSTEM SET shared_buffers = '128MB';   -- default is low on Nano
--    ALTER SYSTEM SET effective_cache_size = '256MB';
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 2. Diagnose which queries are causing highest disk reads RIGHT NOW
--    Uncomment and run to find top offenders:
-- ---------------------------------------------------------------
-- SELECT
--   LEFT(query, 120) AS query_preview,
--   calls,
--   ROUND(total_exec_time::numeric, 2) AS total_ms,
--   ROUND((total_exec_time / calls)::numeric, 2) AS avg_ms,
--   shared_blks_read AS disk_reads,
--   shared_blks_hit AS cache_hits,
--   ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct
-- FROM pg_stat_statements
-- ORDER BY shared_blks_read DESC
-- LIMIT 15;

-- ---------------------------------------------------------------
-- 3. Partial index for notifications query
--    listNotifications filters by recipient_user_id and orders by created_at DESC
--    A partial+composite index avoids full table scans
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_recent
  ON public.email_notifications (recipient_user_id, created_at DESC);

-- ---------------------------------------------------------------
-- 4. Composite index for feed query (listFeedPosts)
--    Typically joins follows -> posts filtered by author_id and sorted by created_at
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_author_created
  ON public.posts (author_id, created_at DESC);

-- ---------------------------------------------------------------
-- 5. Partial index: only index posts that have geo coordinates
--    (community map posts query filters WHERE latitude IS NOT NULL)
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_geo_created
  ON public.posts (created_at DESC)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ---------------------------------------------------------------
-- 6. Composite index on messages for conversation view
--    ChatPage fetches messages WHERE conversation_id = X ORDER BY created_at ASC
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at ASC);

-- ---------------------------------------------------------------
-- 7. Index for listConversations — joins conversation_participants
--    then looks up latest message per conversation
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_conv
  ON public.conversation_participants (user_id, conversation_id);

-- ---------------------------------------------------------------
-- 8. Reset pg_stat_statements so you get fresh data after deploying
--    (run after applying all the above)
-- ---------------------------------------------------------------
-- SELECT pg_stat_statements_reset();
