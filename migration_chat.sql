-- Chat history storage
CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role        text NOT NULL,      -- 'user' | 'bot'
  text        text NOT NULL,
  context     text DEFAULT 'default', -- 'meals' | 'program' | 'progress' | 'default'
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own messages" ON chat_messages;
CREATE POLICY "Users manage own messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- Admin can read all
DROP POLICY IF EXISTS "Admin reads all messages" ON chat_messages;
CREATE POLICY "Admin reads all messages" ON chat_messages FOR SELECT USING (true);
