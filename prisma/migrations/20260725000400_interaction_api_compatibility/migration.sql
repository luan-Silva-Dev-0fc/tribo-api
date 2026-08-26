-- Compatibility fields for the API contract over the pre-existing Supabase schema.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE CASCADE;

UPDATE comments
SET author_id = user_id
WHERE author_id IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS comments_author_id_idx ON comments(author_id);

ALTER TABLE likes
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS likes_comment_id_user_id_key
  ON likes(comment_id, user_id)
  WHERE comment_id IS NOT NULL;
