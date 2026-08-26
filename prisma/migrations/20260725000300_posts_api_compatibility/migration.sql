-- The existing Supabase table uses user_id/media_url/media_type, while the API
-- contract uses author_id/image_url/video_url. Keep both representations so
-- existing records remain available and new API writes succeed.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url TEXT;

UPDATE posts
SET author_id = user_id
WHERE author_id IS NULL AND user_id IS NOT NULL;

UPDATE posts
SET image_url = media_url
WHERE image_url IS NULL AND media_type = 'image';

UPDATE posts
SET video_url = media_url
WHERE video_url IS NULL AND media_type = 'video';

CREATE INDEX IF NOT EXISTS posts_author_id_idx ON posts(author_id);
