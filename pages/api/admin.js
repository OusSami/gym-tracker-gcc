import { supabaseAdmin } from '../../lib/supabase'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function days(n) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d.toISOString()
}
function monthStart() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString()
}
function groupByDate(rows, dateField, valueField = null) {
  const map = {}
  rows.forEach(r => {
    const d = new Date(r[dateField]).toLocaleDateString('en-GB', {day:'2-digit',month:'short'})
    if (!map[d]) map[d] = 0
    map[d] += valueField ? (parseFloat(r[valueField]) || 0) : 1
  })
  return Object.entries(map).map(([date, count]) => valueField ? { date, cost: parseFloat(count.toFixed(4)) } : { date, count })
}

export default async function handler(req, res) {
  const sb = supabaseAdmin()
  const { action, userId } = req.method === 'GET' ? req.query : req.body

  // ── GET endpoints ────────────────────────────────────────────────
  if (req.method === 'GET') {

    // USERS LIST
    if (action === 'users') {
      const [{ data: profiles }, { data: sessions }, { data: usage }, authResult] = await Promise.all([
        sb.from('profiles').select('id,full_name,email,goal,status,created_at,unit_system,fitness_level,waist_cm,approved_at').order('created_at', { ascending: false }),
        sb.from('sessions').select('user_id,created_at').order('created_at', { ascending: false }),
        sb.from('api_usage').select('user_id,cost_usd').gte('created_at', monthStart()),
        sb.auth.admin.listUsers({ perPage: 1000 }),
      ])

      // Build email map from real auth users (profiles.email may be null)
      const authEmailMap = {}
      authResult?.data?.users?.forEach(u => { authEmailMap[u.id] = u.email })

      const sessionCount = {}, lastActive = {}, monthlyCost = {}
      sessions?.forEach(s => { sessionCount[s.user_id] = (sessionCount[s.user_id] || 0) + 1; if (!lastActive[s.user_id]) lastActive[s.user_id] = s.created_at })
      usage?.forEach(u => { monthlyCost[u.user_id] = ((monthlyCost[u.user_id] || 0) + (u.cost_usd || 0)) })

      return res.json({ users: (profiles || []).map(p => ({
        ...p,
        email: p.email || authEmailMap[p.id] || null,   // fall back to auth email
        session_count: sessionCount[p.id] || 0,
        last_active: lastActive[p.id] || null,
        monthly_cost: (monthlyCost[p.id] || 0).toFixed(4)
      })) })
    }

    // COSTS
    if (action === 'costs') {
      const [todayR, weekR, monthR, allR, byEpR, topR] = await Promise.all([
        sb.from('api_usage').select('cost_usd').gte('created_at', days(1)),
        sb.from('api_usage').select('cost_usd').gte('created_at', days(7)),
        sb.from('api_usage').select('cost_usd').gte('created_at', monthStart()),
        sb.from('api_usage').select('cost_usd'),
        sb.from('api_usage').select('endpoint,cost_usd,created_at').gte('created_at', monthStart()),
        sb.from('api_usage').select('user_id,cost_usd,profiles(email)').gte('created_at', monthStart()),
      ])
      const sum = rows => (rows?.reduce((a, r) => a + (r.cost_usd || 0), 0) || 0).toFixed(4)
      const epMap = {}, userMap = {}
      byEpR.data?.forEach(r => { if (!epMap[r.endpoint]) epMap[r.endpoint] = { endpoint: r.endpoint, calls: 0, total_cost: 0 }; epMap[r.endpoint].calls++; epMap[r.endpoint].total_cost += r.cost_usd || 0 })
      topR.data?.forEach(r => { if (!userMap[r.user_id]) userMap[r.user_id] = { user_id: r.user_id, email: r.profiles?.email, calls: 0, total_cost: 0 }; userMap[r.user_id].calls++; userMap[r.user_id].total_cost += r.cost_usd || 0 })
      const { count: uc } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved')

      return res.json({
        today: sum(todayR.data), week: sum(weekR.data), month: sum(monthR.data),
        avg_per_user: uc ? (parseFloat(sum(monthR.data)) / uc).toFixed(4) : '0.0000',
        by_endpoint: Object.values(epMap).map(e => ({ ...e, total_cost: e.total_cost.toFixed(4) })).sort((a, b) => b.total_cost - a.total_cost),
        top_users: Object.values(userMap).map(u => ({ ...u, total_cost: u.total_cost.toFixed(4) })).sort((a, b) => b.total_cost - a.total_cost).slice(0, 10),
      })
    }

    // STATS
    if (action === 'stats') {
      const [pAll, sAll, sToday, sWeek, mAll, pNew] = await Promise.all([
        sb.from('profiles').select('id,status'),
        sb.from('sessions').select('user_id'),
        sb.from('sessions').select('user_id').gte('created_at', days(1)),
        sb.from('sessions').select('user_id').gte('created_at', days(7)),
        sb.from('meals').select('id', { count: 'exact', head: true }),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart()),
      ])
      const profiles = pAll.data || []
      return res.json({
        total_users: profiles.length,
        approved: profiles.filter(p => p.status === 'approved').length,
        pending: profiles.filter(p => p.status === 'pending').length,
        suspended: profiles.filter(p => p.status === 'suspended').length,
        active_today: new Set(sToday.data?.map(s => s.user_id) || []).size,
        active_week: new Set(sWeek.data?.map(s => s.user_id) || []).size,
        total_sessions: sAll.data?.length || 0,
        sessions_this_week: sWeek.data?.length || 0,
        total_meals: mAll.count || 0,
        new_this_month: pNew.count || 0,
        avg_sessions: profiles.length ? Math.round((sAll.data?.length || 0) / profiles.length * 10) / 10 : 0,
      })
    }

    // CHARTS
    if (action === 'charts') {
      const [sessR, newUsersR, costR, costEpR, goalsR, levelsR, sessDay] = await Promise.all([
        sb.from('sessions').select('created_at').gte('created_at', days(30)),
        sb.from('profiles').select('created_at').gte('created_at', days(30)),
        sb.from('api_usage').select('created_at,cost_usd').gte('created_at', days(30)),
        sb.from('api_usage').select('created_at,endpoint,cost_usd').gte('created_at', days(30)),
        sb.from('profiles').select('goal'),
        sb.from('profiles').select('fitness_level'),
        sb.from('sessions').select('created_at').gte('created_at', days(90)),
      ])
      const dailySessions = groupByDate(sessR.data || [], 'created_at')
      const newUsers = groupByDate(newUsersR.data || [], 'created_at')
      const dailyCost = groupByDate(costR.data || [], 'created_at', 'cost_usd')

      // Daily cost by endpoint
      const epDayMap = {}
      costEpR.data?.forEach(r => {
        const d = new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        if (!epDayMap[d]) epDayMap[d] = { date: d }
        epDayMap[d][r.endpoint] = (epDayMap[d][r.endpoint] || 0) + (r.cost_usd || 0)
      })
      const dailyCostByEndpoint = Object.values(epDayMap).map(d => {
        const r = { ...d }
        ;['analyze', 'report', 'coach', 'meal', 'body', 'weekly'].forEach(ep => { if (r[ep]) r[ep] = parseFloat(r[ep].toFixed(4)) })
        return r
      })

      // Goals dist
      const goalMap = {}
      goalsR.data?.forEach(p => { const k = p.goal || 'general'; goalMap[k] = (goalMap[k] || 0) + 1 })
      const GOAL_AR = { muscle: 'بناء عضل', weight: 'خفض دهون', strength: 'قوة', endurance: 'تحمل', general: 'لياقة عامة' }
      const goalsDist = Object.entries(goalMap).map(([name, count]) => ({ name: GOAL_AR[name] || name, count }))

      // Levels dist
      const levMap = {}
      levelsR.data?.forEach(p => { const k = p.fitness_level || 'مبتدئ'; levMap[k] = (levMap[k] || 0) + 1 })
      const levelsDist = Object.entries(levMap).map(([level, count]) => ({ level, count }))

      // Sessions by day of week
      const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
      const dayCount = Array(7).fill(0)
      sessDay.data?.forEach(s => { dayCount[new Date(s.created_at).getDay()]++ })
      const sessionsByDay = DAYS_AR.map((day, i) => ({ day, count: dayCount[i] }))

      return res.json({ dailySessions, newUsers, dailyCost, dailyCostByEndpoint, goalsDist, levelsDist, sessionsByDay })
    }

    // FULL USER DETAIL
    if (action === 'user_full' && userId) {
      const mStart = monthStart()
      const [profR, sessR, weightR, mealsR, costR, costEpR, appSessR, bodyR, authResult2] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).single(),
        sb.from('sessions').select('*').eq('user_id', userId).order('session_date', { ascending: false }),
        sb.from('weight_history').select('weight_kg,recorded_at').eq('user_id', userId).order('recorded_at', { ascending: false }),
        sb.from('meals').select('calories,protein_g,carbs_g,fat_g,created_at').eq('user_id', userId).order('created_at', { ascending: true }),
        sb.from('api_usage').select('cost_usd,created_at').eq('user_id', userId),
        sb.from('api_usage').select('endpoint,cost_usd,created_at').eq('user_id', userId),
        sb.from('app_sessions').select('started_at,ended_at,duration_seconds').eq('user_id', userId).order('started_at', { ascending: false }).limit(50),
        sb.from('body_analyses').select('created_at,overall_score').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
        sb.auth.admin.getUserById(userId),
      ])

      const authEmail = authResult2?.data?.user?.email || null
      const profile = profR.data ? { ...profR.data, email: profR.data.email || authEmail } : null

      const sessions = sessR.data || []
      const weights = weightR.data || []
      const meals = mealsR.data || []
      const costs = costR.data || []
      const allCosts = costEpR.data || []
      const appSessions = appSessR.data || []

      // Stats
      const totalVol = sessions.reduce((a, s) => a + (s.total_volume_kg || 0), 0)
      const totalSets = sessions.reduce((a, s) => a + (s.exercises?.reduce((b, e) => b + (e.sets?.length || 0), 0) || 0), 0)
      const now = new Date(); now.setHours(0,0,0,0)
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
      const mAgo = new Date(now); mAgo.setDate(1)
      const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30)

      // Streak
      const sessionDays = new Set(sessions.map(s => { const d = new Date(s.session_date + 'T12:00:00'); d.setHours(0,0,0,0); return d.getTime() }))
      let streak = 0, chk = new Date(now)
      while (true) { if (sessionDays.has(chk.getTime())) { streak++; chk.setDate(chk.getDate() - 1) } else if (chk.getTime() === now.getTime()) { chk.setDate(chk.getDate() - 1); if (!sessionDays.has(chk.getTime())) break; chk.setDate(chk.getDate() - 1) } else break }

      // Weight change
      const latestW = weights[0]?.weight_kg
      const monthAgoW = weights.find(w => new Date(w.recorded_at) <= monthAgo)?.weight_kg
      const month_change = latestW && monthAgoW ? Math.round((latestW - monthAgoW) * 10) / 10 : undefined

      // App time
      const total_app_time = appSessions.reduce((a, s) => a + (s.duration_seconds || 0), 0)

      // Calories avg
      const mealDays = {}
      meals.forEach(m => { const d = m.created_at?.split('T')[0]; if (d) { if (!mealDays[d]) mealDays[d] = { calories: 0, protein: 0 }; mealDays[d].calories += m.calories || 0; mealDays[d].protein += m.protein_g || 0 } })
      const mealDayArr = Object.values(mealDays)
      const avg_calories = mealDayArr.length ? Math.round(mealDayArr.reduce((a, d) => a + d.calories, 0) / mealDayArr.length) : 0
      const avg_protein = mealDayArr.length ? Math.round(mealDayArr.reduce((a, d) => a + d.protein, 0) / mealDayArr.length) : 0

      // Costs
      const totalCost = costs.reduce((a, r) => a + (r.cost_usd || 0), 0)
      const monthlyCost = costs.filter(r => new Date(r.created_at) >= new Date(mStart)).reduce((a, r) => a + (r.cost_usd || 0), 0)
      const epMap = {}
      allCosts.forEach(r => { if (!epMap[r.endpoint]) epMap[r.endpoint] = { endpoint: r.endpoint, calls: 0, total_cost: 0 }; epMap[r.endpoint].calls++; epMap[r.endpoint].total_cost += r.cost_usd || 0 })
      const by_endpoint = Object.values(epMap).map(e => ({ ...e, total_cost: e.total_cost.toFixed(4) })).sort((a, b) => b.total_cost - a.total_cost)

      // User daily cost chart
      const userDailyCost = groupByDate(costs, 'created_at', 'cost_usd').slice(-30)

      // Volume by session chart
      const volumeBySession = sessions.slice(0, 30).reverse().map(s => ({
        date: new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        volume: Math.round(s.total_volume_kg || 0)
      }))

      // Weight history chart
      const weightHistory = weights.slice(0, 30).reverse().map(w => ({
        date: new Date(w.recorded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        weight: w.weight_kg
      }))

      // Calories history chart
      const caloriesHistory = Object.entries(mealDays).slice(-30).map(([date, v]) => ({
        date: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        calories: Math.round(v.calories)
      }))

      // Sessions per week chart
      const weekMap = {}
      sessions.forEach(s => { const d = new Date(s.session_date + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); const k = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); weekMap[k] = (weekMap[k] || 0) + 1 })
      const sessionsPerWeek = Object.entries(weekMap).slice(-12).map(([week, count]) => ({ week, count }))

      // Muscles distribution
      const muscMap = {}
      sessions.forEach(s => { (s.muscles_trained || []).forEach(m => { muscMap[m] = (muscMap[m] || 0) + 1 }) })
      const musclesDist = Object.entries(muscMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

      return res.json({
        profile,
        stats: {
          total_sessions: sessions.length,
          sessions_this_week: sessions.filter(s => new Date(s.session_date + 'T12:00:00') >= weekAgo).length,
          sessions_this_month: sessions.filter(s => new Date(s.session_date + 'T12:00:00') >= mAgo).length,
          total_volume_kg: Math.round(totalVol),
          total_sets: totalSets,
          avg_duration: sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0) / sessions.length) : 0,
          latest_weight: latestW || null,
          month_change,
          streak,
          body_analyses: bodyR.data?.length || 0,
          total_meals: meals.length,
          meal_log_days: mealDayArr.length,
          avg_calories,
          avg_protein,
          total_app_time,
          avg_daily_time: appSessions.length ? Math.round(total_app_time / Math.max(appSessions.length, 1)) : 0,
          last_app_session: appSessions[0]?.started_at || null,
        },
        costs: {
          total: totalCost.toFixed(4),
          monthly: monthlyCost.toFixed(4),
          total_calls: costs.length,
          by_endpoint,
        },
        charts: { volumeBySession, weightHistory, caloriesHistory, sessionsPerWeek, musclesDist, userDailyCost },
        recentSessions: sessions.slice(0, 20),
        appSessions,
      })
    }

    // PROGRAM STATUS — returns most recent program regardless of status
    if (action === 'program_status' && userId) {
      let { data: allPrograms, error: progError } = await sb
        .from('user_programs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (progError) return res.json({ program: null, allPrograms: [], error: progError.message })

      // If no programs found with profile ID, look up the real auth UID via email
      if (!allPrograms?.length) {
        const { data: profileRow } = await sb.from('profiles').select('email').eq('id', userId).single()
        if (profileRow?.email) {
          const { data: authData } = await sb.auth.admin.listUsers({ perPage: 1000 })
          const authUser = authData?.users?.find(u => u.email === profileRow.email)
          if (authUser && authUser.id !== userId) {
            const { data: prog2 } = await sb.from('user_programs').select('*')
              .eq('user_id', authUser.id).order('created_at', { ascending: false })
            if (prog2?.length) allPrograms = prog2
          }
        }
      }

      if (!allPrograms?.length) return res.json({ program: null, allPrograms: [] })

      // Prefer active, fall back to the most recent
      const program = allPrograms.find(p => p.status === 'active') || allPrograms[0]

      const { data: dayRows } = await sb
        .from('program_days')
        .select('day_number,checkin_status,daily_workout')
        .eq('program_id', program.id)
        .order('day_number', { ascending: true })

      const days = dayRows || []
      const completed = days.filter(d => ['completed','partial'].includes(d.checkin_status)).length
      const missed    = days.filter(d => d.checkin_status === 'missed').length
      const withWorkout = days.filter(d => d.daily_workout).length
      const compliance = completed + missed > 0
        ? Math.round((completed / (completed + missed)) * 100)
        : null

      return res.json({ program, days, allPrograms, stats: { completed, missed, withWorkout, compliance } })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  // ── POST endpoints ───────────────────────────────────────────────
  if (req.method === 'POST') {
    if (action === 'approve' && userId) {
      await sb.from('profiles').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', userId)
      return res.json({ success: true })
    }
    if (action === 'suspend' && userId) {
      await sb.from('profiles').update({ status: 'suspended' }).eq('id', userId)
      return res.json({ success: true })
    }

    // Helper: resolve program from explicit id or fallback to user's most recent
    const resolveProgram = async (programId, selectCols = 'id,total_days,current_day') => {
      if (programId) {
        const { data: r } = await sb.from('user_programs').select(selectCols).eq('id', programId).limit(1)
        return r?.[0] || null
      }
      const { data: r } = await sb.from('user_programs').select(selectCols)
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
      return r?.[0] || null
    }

    // PROGRAM: set to a specific day
    if (action === 'program_set_day' && userId) {
      const { targetDay, programId } = req.body
      const day = parseInt(targetDay)
      if (!day || day < 1) return res.status(400).json({ error: 'Invalid day' })

      const program = await resolveProgram(programId)
      if (!program) return res.status(404).json({ error: 'No program found' })
      if (day > program.total_days) return res.status(400).json({ error: 'Day exceeds program length' })

      await sb.from('user_programs').update({ current_day: day, status: 'active' }).eq('id', program.id)

      await sb.from('program_days')
        .update({ checkin_status: null, daily_workout: null, actual_logs: null, incomplete_reason: null, session_id: null })
        .eq('program_id', program.id).gte('day_number', day)

      const { data: futureDays } = await sb.from('program_days').select('id,day_number')
        .eq('program_id', program.id).gte('day_number', day).order('day_number', { ascending: true })

      if (futureDays?.length) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        for (let i = 0; i < futureDays.length; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i)
          await sb.from('program_days').update({ planned_date: d.toISOString().split('T')[0] }).eq('id', futureDays[i].id)
        }
      }
      return res.json({ success: true })
    }

    // PROGRAM: reset to day 1
    if (action === 'program_reset' && userId) {
      const { programId } = req.body
      const program = await resolveProgram(programId)
      if (!program) return res.status(404).json({ error: 'No program found' })

      await sb.from('user_programs').update({ current_day: 1, status: 'active' }).eq('id', program.id)

      await sb.from('program_days')
        .update({ checkin_status: null, daily_workout: null, actual_logs: null, incomplete_reason: null, session_id: null })
        .eq('program_id', program.id)

      const { data: allDays } = await sb.from('program_days').select('id,day_number')
        .eq('program_id', program.id).order('day_number', { ascending: true })

      if (allDays?.length) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        for (let i = 0; i < allDays.length; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i)
          await sb.from('program_days').update({ planned_date: d.toISOString().split('T')[0] }).eq('id', allDays[i].id)
        }
      }
      return res.json({ success: true })
    }

    // PROGRAM: regenerate today's workout
    if (action === 'program_regen_today' && userId) {
      const { programId } = req.body
      const program = await resolveProgram(programId)
      if (!program) return res.status(404).json({ error: 'No program found' })

      await sb.from('program_days').update({ daily_workout: null })
        .eq('program_id', program.id).eq('day_number', program.current_day)
      return res.json({ success: true })
    }

    // PROGRAM: end (pause) program
    if (action === 'program_end' && userId) {
      const { programId } = req.body
      const program = await resolveProgram(programId, 'id')
      if (!program) return res.status(404).json({ error: 'No program found' })

      await sb.from('user_programs').update({ status: 'paused' }).eq('id', program.id)
      return res.json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
