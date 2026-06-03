import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const sb = supabaseAdmin()
  const { q, category, limit = 20 } = req.query

  let query = sb.from('gcc_foods')
    .select('id,name_ar,name_en,category,serving_size_g,serving_desc_ar,calories,protein_g,carbs_g,fat_g,fiber_g,tags')
    .order('name_ar')
    .limit(parseInt(limit))

  if (q && q.trim()) {
    // Search by Arabic name — simple contains match
    query = query.ilike('name_ar', `%${q.trim()}%`)
  }

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ foods: data || [] })
}
