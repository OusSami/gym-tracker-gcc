/**
 * POST /api/track  { userId, page, duration_seconds }
 * Records page-level visit duration in api_usage (cost=0, input_tokens=duration).
 * Used by admin to show per-feature time breakdown.
 */
import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { userId, page, duration_seconds } = req.body
  if (!userId || !page) return res.status(400).end()
  const dur = Math.min(parseInt(duration_seconds) || 0, 7200) // cap at 2h
  if (dur < 5) return res.status(200).json({ ok: true }) // ignore < 5s visits
  try {
    const sb = supabaseAdmin()
    await sb.from('api_usage').insert({
      user_id: userId,
      endpoint: 'page:' + page,
      input_tokens: dur,
      output_tokens: 0,
      cost_usd: 0,
    })
  } catch (_) {}
  res.status(200).json({ ok: true })
}
