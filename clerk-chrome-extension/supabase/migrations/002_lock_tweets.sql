-- Lock the tweets tables. They had RLS off, and the anon key is public (it is
-- shared with other apps on this project), so anyone could read and rewrite them.
--
-- The extension sends a private token as the x-tweets-token header; only its
-- SHA-256 is stored here. service_role (reels-publisher) bypasses RLS.
-- To rotate: change the token in 1Password (dev-cli/Supabase-tweets-token) and
-- .env.development, replace the hash below, re-run this, then build:personal.
--
-- Rollback:
--   DROP POLICY tweets_with_token ON public.tweets;
--   ALTER TABLE public.tweets DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.tweet_bookmark_folders DISABLE ROW LEVEL SECURITY;
--   GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tweets, public.tweet_bookmark_folders TO anon, authenticated;
--   DROP FUNCTION public.tweets_token_ok();

BEGIN;

CREATE OR REPLACE FUNCTION public.tweets_token_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT encode(
    sha256(convert_to(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-tweets-token', ''), 'UTF8')),
    'hex'
  ) = '5cfff789f11551d92f2d8389e9bb568b639aafca408b3b780478ceb7aad86d8b'
$$;

REVOKE ALL ON FUNCTION public.tweets_token_ok() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tweets_token_ok() TO anon, authenticated, service_role;

ALTER TABLE public.tweets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tweets_with_token ON public.tweets;
CREATE POLICY tweets_with_token ON public.tweets
  FOR ALL TO anon
  USING (public.tweets_token_ok())
  WITH CHECK (public.tweets_token_ok());

-- The extension never deletes, so a leaked token still cannot wipe the table.
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tweets FROM anon, authenticated;

-- Empty and unused by any client: closed outright, no policy.
ALTER TABLE public.tweet_bookmark_folders ENABLE ROW LEVEL SECURITY;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tweet_bookmark_folders FROM anon, authenticated;

COMMIT;
