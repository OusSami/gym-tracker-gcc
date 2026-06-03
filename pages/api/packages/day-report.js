import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { programId, dayNumber, userId } = req.query
  if (!programId || !dayNumber || !userId) return res.status(400).json({ error: 'Missing fields' })

  const sb = supabaseAdmin()
  const dayNum = parseInt(dayNumber)

  const { data: dayRecord } = await sb
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .eq('day_number', dayNum)
    .single()

  if (!dayRecord) return res.json({ dayRecord: null })

  const sessionDate = dayRecord.planned_date || dayRecord.meal_date

  // ── Try 3 ways to find session ──────────────────────────────────
  let sessionRow = null

  // 1. By session_id (if migration ran)
  if (dayRecord.session_id) {
    const { data } = await sb
      .from('sessions')
      .select('id, session_date, duration_seconds, muscles_trained, exercises(id, name, muscle, sets(set_number, reps, weight_kg))')
      .eq('id', dayRecord.session_id)
      .single()
    if (data) sessionRow = data
  }

  // 2. By date (fallback)
  if (!sessionRow && sessionDate) {
    const { data } = await sb
      .from('sessions')
      .select('id, session_date, duration_seconds, muscles_trained, exercises(id, name, muscle, sets(set_number, reps, weight_kg))')
      .eq('user_id', userId)
      .eq('session_date', sessionDate)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.length) sessionRow = data[0]
  }

  // ── Build session summary ────────────────────────────────────────
  let session = null

  if (sessionRow) {
    // From sessions table (relational)
    const exList = (sessionRow.exercises || []).map(ex => ({
      id:     ex.id,
      name:   ex.name,
      muscle: ex.muscle,
      sets:   ex.sets?.length || 0,
      reps:   ex.sets?.reduce((a, s) => a + (s.reps || 0), 0) || 0,
    }))
    const totalSets = exList.reduce((a, e) => a + e.sets, 0)
    const totalReps = exList.reduce((a, e) => a + e.reps, 0)

    // Target from actual_logs if available
    const actualLogs = dayRecord.actual_logs || []
    const totalTarget = actualLogs.reduce((a, l) => {
      const t = parseInt(l.targetReps?.split('-')[0] || 10)
      return a + t * (l.targetSets || 3)
    }, 0)

    session = {
      id:                 sessionRow.id,
      session_date:       sessionRow.session_date,
      duration_seconds:   sessionRow.duration_seconds,
      muscles_trained:    sessionRow.muscles_trained,
      exercises:          exList,
      total_sets:         totalSets,
      total_actual_reps:  totalReps,
      total_target_reps:  totalTarget,
      compliance_pct:     totalTarget > 0 ? Math.round((totalReps / totalTarget) * 100) : null,
      from_sessions_table: true,
    }
  } else if (dayRecord.actual_logs?.length > 0) {
    // 3. Fallback: build from actual_logs jsonb (always available after workout)
    const logs = dayRecord.actual_logs
    const exList = logs.map(ex => ({
      name:   ex.name,
      muscle: ex.muscle,
      sets:   ex.sets?.length || 0,
      reps:   ex.sets?.reduce((a, s) => a + (s.reps || 0), 0) || 0,
    }))
    const totalSets = exList.reduce((a, e) => a + e.sets, 0)
    const totalReps = exList.reduce((a, e) => a + e.reps, 0)
    const totalTarget = logs.reduce((a, l) => {
      const t = parseInt(l.targetReps?.split('-')[0] || 10)
      return a + t * (l.targetSets || 3)
    }, 0)

    session = {
      id:                 null,  // no DB id
      exercises:          exList,
      total_sets:         totalSets,
      total_actual_reps:  totalReps,
      total_target_reps:  totalTarget,
      compliance_pct:     totalTarget > 0 ? Math.round((totalReps / totalTarget) * 100) : null,
      from_actual_logs:   true,
    }
  }

  // ── Meals ────────────────────────────────────────────────────────
  let meals = []
  if (sessionDate) {
    const { data: mealData } = await sb
      .from('meals')
      .select('meal_type, meal_name, total_calories, protein_g, carbs_g, fat_g, logged_at')
      .eq('user_id', userId)
      .eq('meal_date', sessionDate)
      .order('logged_at', { ascending: true })
    meals = mealData || []
  }

  const nutrition = {
    totalCals:    Math.round(meals.reduce((a, m) => a + (m.total_calories || 0), 0)),
    totalProtein: Math.round(meals.reduce((a, m) => a + (m.protein_g || 0), 0)),
    totalCarbs:   Math.round(meals.reduce((a, m) => a + (m.carbs_g || 0), 0)),
    totalFat:     Math.round(meals.reduce((a, m) => a + (m.fat_g || 0), 0)),
  }

  return res.json({
    dayRecord,
    sessionDate,
    session,
    meals,
    nutrition,
    summary: buildSummary(dayRecord.checkin_status, session?.compliance_pct, nutrition.totalCals, meals.length),
    incomplete_reason: dayRecord.incomplete_reason,
  })
}

function buildSummary(status, compliance, totalCals, mealCount) {
  if (!status) return null
  if (status === 'rest')    return { icon:'😴', text:'يوم راحة',                                               color:'#3b82f6' }
  if (status === 'missed')  return { icon:'❌', text:'يوم غياب',                                               color:'#ef4444' }
  if (status === 'partial') return { icon:'🔶', text:`جزئي${compliance?' · '+compliance+'%':''}${mealCount>0?' · '+totalCals+' سعرة':''}`, color:'#f97316' }
  if (status === 'completed') return { icon:'✅', text:`مكتمل${compliance?' · '+compliance+'% أداء':''}${mealCount>0?' · '+totalCals+' سعرة':''}`, color:'#22c55e' }
  return null
}
