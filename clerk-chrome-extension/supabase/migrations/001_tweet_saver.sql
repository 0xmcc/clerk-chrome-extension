-- Tweet Saver: evolve tweets table with new columns
-- Preserves existing data (tweet_id, tweet_text, author_handle, timestamp, media_urls, created_at)

-- New columns
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS author_display_name text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS author_avatar_url text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS media jsonb DEFAULT '[]';
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS link_cards jsonb DEFAULT '[]';
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS quoted_tweet_id text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS in_reply_to_tweet_id text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS raw_json jsonb;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS saved_at timestamptz DEFAULT now();
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS user_id text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tweets_user_id ON public.tweets (user_id);
CREATE INDEX IF NOT EXISTS idx_tweets_conversation_id ON public.tweets (conversation_id);

-- Enable RLS
ALTER TABLE public.tweets ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see/insert/update their own tweets
-- Uses auth.jwt()->>'sub' which maps to the Clerk user ID

-- Drop existing policies if re-running migration
DROP POLICY IF EXISTS "Users can view their own tweets" ON public.tweets;
DROP POLICY IF EXISTS "Users can insert their own tweets" ON public.tweets;
DROP POLICY IF EXISTS "Users can update their own tweets" ON public.tweets;

CREATE POLICY "Users can view their own tweets"
  ON public.tweets
  FOR SELECT
  USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can insert their own tweets"
  ON public.tweets
  FOR INSERT
  WITH CHECK (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can update their own tweets"
  ON public.tweets
  FOR UPDATE
  USING (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');
