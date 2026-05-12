-- Create missing indexes for foreign keys to prevent sequential scans
-- This will drastically reduce Disk IO by optimizing queries

-- Posts
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);

-- Post Likes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes (user_id);

-- Follows
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);

-- Conversation Participants
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv_id ON public.conversation_participants (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants (user_id);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);

-- Email Notifications
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient_id ON public.email_notifications (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_actor_id ON public.email_notifications (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_processed_at ON public.email_notifications (processed_at);

-- Add to our main schema file for future deployments
