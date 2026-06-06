/**
 * POST /api/session-exercise
 * Creates an exercise row under a session immediately when workout starts.
 * Idempotent: if an exercise with the same name already exists for this session
 * (e.g. user re-opened the workout screen), returns the existing row ID to avoid duplicates.
 */
import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { sessionId, name, muscle } = req.body
  if (!sessionId || !name) return res.status(400).json({ error: 'Missing fields' })

  const sb = supabaseAdmin()

  // Return existing row if already created (prevents duplicates on re-open)
  const { data: existing } = await sb.from('exercises')
    .select('id')
    .eq('session_id', sessionId)
    .eq('name', name)
    .limit(1)
    .maybeSingle()

  if (existing) return res.json({ id: existing.id })

  const { data, error } = await sb.from('exercises').insert({
    session_id:       sessionId,
    name:             name,
    muscle:           muscle || 'عام',
    duration_seconds: 0,
  }).select('id').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ id: data.id })
}
