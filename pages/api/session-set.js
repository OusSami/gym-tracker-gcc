/**
 * POST /api/session-set
 * Saves a single set to DB immediately after the user logs it
 */
import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { exerciseId, setNumber, reps, duration_seconds } = req.body
  if (!exerciseId || !setNumber) return res.status(400).json({ error: 'Missing fields' })

  const sb = supabaseAdmin()
  const { error } = await sb.from('sets').insert({
    exercise_id:      exerciseId,
    set_number:       setNumber,
    weight_kg:        0,
    reps:             reps || 0,
    duration_seconds: duration_seconds || 0,
  })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true })
}
