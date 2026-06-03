/**
 * GET /api/packages/status?userId=xxx
 * Returns current active program + today's day info
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const sb = supabaseAdmin()

  const { data: program } = await sb
    .from('user_programs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!program) return res.json({ program: null })

  // Get today's day record
  const { data: todayDay } = await sb
    .from('program_days')
    .select('*')
    .eq('program_id', program.id)
    .eq('day_number', program.current_day)
    .single()

  // Get completed days count
  const { count: completedCount } = await sb
    .from('program_days')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', program.id)
    .in('checkin_status', ['completed', 'partial'])

  return res.json({ program, todayDay, completedDays: completedCount || 0 })
}
