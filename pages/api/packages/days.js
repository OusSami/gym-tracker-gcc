import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { programId } = req.query
  if (!programId) return res.status(400).json({ error: 'Missing programId' })

  const sb = supabaseAdmin()
  const { data: days, error } = await sb
    .from('program_days')
    .select('day_number,checkin_status,energy_level,planned_date,roadmap_target')
    .eq('program_id', programId)
    .order('day_number', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ days: days || [] })
}
