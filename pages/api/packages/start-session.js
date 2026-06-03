/**
 * POST /api/packages/start-session
 * Creates session row at workout START so data is saved progressively
 * Called when user taps "بسم الله — هيا نبدأ"
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userId, programId, dayNumber, muscles, durationMin } = req.body
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const sb = supabaseAdmin()

  // Get planned date
  const { data: dayRec } = await sb
    .from('program_days')
    .select('planned_date, session_id')
    .eq('program_id', programId)
    .eq('day_number', dayNumber)
    .single()

  // Don't create duplicate if session already started
  if (dayRec?.session_id) {
    return res.json({ sessionId: dayRec.session_id, existing: true })
  }

  const sessionDate = dayRec?.planned_date || new Date().toISOString().split('T')[0]

  const { data: session, error } = await sb.from('sessions').insert({
    user_id:          userId,
    muscles_trained:  muscles || [],
    session_date:     sessionDate,
    duration_seconds: (durationMin || 30) * 60,
    image_url:        null,
  }).select('id').single()

  if (error) return res.status(500).json({ error: error.message })

  // Link session to program_days immediately
  await sb.from('program_days')
    .update({ session_id: session.id })
    .eq('program_id', programId)
    .eq('day_number', dayNumber)

  return res.json({ sessionId: session.id })
}
