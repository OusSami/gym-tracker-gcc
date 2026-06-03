import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userId, programId, dayNumber, status, energyLevel, actual_logs, warmup_data, cooldown_data } = req.body
  if (!userId || !programId || !dayNumber || !status) return res.status(400).json({ error: 'Missing fields' })

  const sb = supabaseAdmin()

  // Get day record — includes existing session_id if already saved
  const { data: dayRec } = await sb
    .from('program_days')
    .select('planned_date, roadmap_target, session_id, checkin_status')
    .eq('program_id', programId)
    .eq('day_number', dayNumber)
    .single()

  const sessionDate = dayRec?.planned_date || new Date().toISOString().split('T')[0]
  const target = dayRec?.roadmap_target || {}
  let sessionId = dayRec?.session_id || null  // reuse if exists

  // Create session ONLY if: workout done + has logs + no session yet
  if ((status === 'completed' || status === 'partial') && actual_logs?.length > 0 && !sessionId) {
    const muscles = [...new Set(actual_logs.map(ex => ex.muscle).filter(Boolean))]

    const { data: session, error: sessErr } = await sb.from('sessions').insert({
      user_id:          userId,
      muscles_trained:  muscles,
      session_date:             sessionDate,
      duration_seconds:         (target.estimated_duration_min || 30) * 60,
      image_url:                null,
      warmup_exercises:         warmup_data || [],
      warmup_duration_seconds:  (warmup_data||[]).reduce((a,w)=>a+(w.duration_seconds||w.dur||30),0),
      stretch_exercises:        cooldown_data || [],
      stretch_duration_seconds: (cooldown_data||[]).reduce((a,c)=>a+(c.duration_seconds||c.dur||30),0),
    }).select('id').single()

    if (!sessErr && session) {
      sessionId = session.id
      for (const ex of actual_logs) {
        if (!ex.sets?.length) continue
        const { data: exRow, error: exErr } = await sb.from('exercises').insert({
          session_id:       session.id,
          name:             ex.name || 'تمرين',
          muscle:           ex.muscle || 'عام',
          duration_seconds: 0,
        }).select('id').single()
        if (exErr || !exRow) continue
        await sb.from('sets').insert(
          ex.sets.map((s, i) => ({
            exercise_id:      exRow.id,
            set_number:       i + 1,
            weight_kg:        0,
            reps:             s.reps || 0,
            duration_seconds: 0,
          }))
        )
      }
    }
  }

  // Update program_days
  await sb.from('program_days').update({
    checkin_status: status,
    energy_level:   energyLevel || 'normal',
    actual_logs:    actual_logs || null,
    completed_at:   ['completed','partial'].includes(status) ? new Date().toISOString() : null,
    meal_date:      sessionDate,
    ...(sessionId ? { session_id: sessionId } : {}),
  }).eq('program_id', programId).eq('day_number', dayNumber)

  // Advance current_day (only if this day >= current)
  const { data: prog } = await sb.from('user_programs')
    .select('current_day, total_days')
    .eq('id', programId).single()

  if (prog && dayNumber >= prog.current_day) {
    const nextDay    = Math.min(dayNumber + 1, prog.total_days + 1)
    const isComplete = nextDay > prog.total_days
    await sb.from('user_programs').update({
      current_day: nextDay,
      status:      isComplete ? 'completed' : 'active',
    }).eq('id', programId)
  }

  return res.json({ success: true, sessionId })
}
