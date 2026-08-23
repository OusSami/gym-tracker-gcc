import { supabaseAdmin } from './supabase'

// Gemini 2.5 Flash pricing (per million tokens)
const PRICING = {
  input:  0.075 / 1_000_000,   // $0.075 per 1M input tokens
  output: 0.30  / 1_000_000,   // $0.30 per 1M output tokens
}

/**
 * Log an AI API call for cost tracking and rate limiting.
 * @param {string} userId
 * @param {string} endpoint - 'analyze' | 'report' | 'coach' | 'meal' | 'body' | 'weekly'
 * @param {number} inputTokens
 * @param {number} outputTokens
 */
export async function logApiUsage(userId, endpoint, inputTokens = 0, outputTokens = 0) {
  if (!userId) return
  const cost_usd = (inputTokens * PRICING.input) + (outputTokens * PRICING.output)
  try {
    const sb = supabaseAdmin()
    await sb.from('api_usage').insert({
      user_id: userId,
      endpoint,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: parseFloat(cost_usd.toFixed(6)),
    })
  } catch(e) {
    // Non-critical — never block the user experience
    console.error('logApiUsage error:', e.message)
  }
}

/**
 * Check if user has exceeded rate limit for an endpoint.
 * Returns {allowed: bool, remaining: int}
 */
export async function checkRateLimit(userId, endpoint, dailyLimit = 20) {
  if (!userId) return { allowed: true, remaining: dailyLimit }
  try {
    const sb = supabaseAdmin()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await sb
      .from('api_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('created_at', since)
    const used = count || 0
    return { allowed: used < dailyLimit, remaining: Math.max(0, dailyLimit - used), used }
  } catch(e) {
    return { allowed: true, remaining: dailyLimit } // fail open
  }
}

// Daily limits per endpoint
export const RATE_LIMITS = {
  analyze:     50,   // exercise identification
  report:      10,   // session reports
  coach:       20,   // AI coach chat
  meal:        30,   // meal analysis
  body:         5,   // body analysis (expensive)
  weekly:       7,   // weekly summary
  meal_report: 10,   // daily nutrition report (POST only; GET reads cache)
  analysis:    10,   // analytics period report (POST only; GET reads cache)
  reason:      10,   // program missed-day reason analysis
}
