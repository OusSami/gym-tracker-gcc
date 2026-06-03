import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const sb = supabaseAdmin()

  // GET — load last 60 messages (30 exchanges)
  if (req.method === 'GET') {
    const { userId, context } = req.query
    if (!userId) return res.status(400).json({ error: 'Missing userId' })
    const q = sb.from('chat_messages')
      .select('role,text,context,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ messages: (data || []).reverse() })
  }

  // POST — save a message
  if (req.method === 'POST') {
    const { userId, role, text, context = 'default' } = req.body
    if (!userId || !role || !text) return res.status(400).json({ error: 'Missing fields' })
    const { error } = await sb.from('chat_messages').insert({ user_id: userId, role, text, context })
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  // DELETE — clear all messages for user
  if (req.method === 'DELETE') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'Missing userId' })
    await sb.from('chat_messages').delete().eq('user_id', userId)
    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
