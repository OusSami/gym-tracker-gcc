#!/usr/bin/env node
/**
 * estimate_nutrition.mjs
 *
 * Estimates per-serving macros for every recipe where calories IS NULL
 * using a built-in Arabic/Gulf cuisine nutrition knowledge base.
 * No external API — runs entirely offline.
 *
 * Usage:
 *   node scripts/estimate_nutrition.mjs
 *   node scripts/estimate_nutrition.mjs --dry-run   (show estimates, skip DB write)
 *   node scripts/estimate_nutrition.mjs --limit 20  (process at most N recipes)
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')
const LIMIT_IDX = process.argv.indexOf('--limit')
const LIMIT     = LIMIT_IDX !== -1 ? parseInt(process.argv[LIMIT_IDX + 1], 10) : null

// ── Credentials ───────────────────────────────────────────────────────────
function readEnvFile(f) {
  const env = {}
  if (!fs.existsSync(f)) return env
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const envLocal = readEnvFile(path.join(__dirname, '..', '.env.local'))
const SB_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL  || envLocal['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal['SUPABASE_SERVICE_ROLE_KEY']
if (!SB_URL || !SB_KEY) { console.error('❌  Missing Supabase credentials'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ═══════════════════════════════════════════════════════════════════════════
//  NUTRITION KNOWLEDGE BASE
//  All values are per single serving (typical Gulf household portion).
//  Structure: { calories, protein_g, carbs_g, fat_g, fiber_g }
// ═══════════════════════════════════════════════════════════════════════════

// ── Tier 1: Specific dish fingerprints (name keyword → exact values) ───────
// Each entry: [keywords_to_match (OR), nutrition]
const DISH_FINGERPRINTS = [
  // ── Rice & grain ─────────────────────────────────────────────────────────
  { kw:['كبسة دجاج','كبسة الدجاج'],         n:{calories:520,protein_g:35,carbs_g:58,fat_g:14,fiber_g:3} },
  { kw:['كبسة لحم','كبسة اللحم'],            n:{calories:580,protein_g:38,carbs_g:58,fat_g:18,fiber_g:3} },
  { kw:['كبسة','كبسه'],                      n:{calories:540,protein_g:35,carbs_g:58,fat_g:15,fiber_g:3} },
  { kw:['مجبوس دجاج','مجبوس الدجاج'],        n:{calories:510,protein_g:34,carbs_g:56,fat_g:14,fiber_g:3} },
  { kw:['مجبوس لحم','مجبوس اللحم'],          n:{calories:570,protein_g:37,carbs_g:58,fat_g:17,fiber_g:3} },
  { kw:['مجبوس ربيان','مجبوس الربيان'],      n:{calories:490,protein_g:30,carbs_g:58,fat_g:12,fiber_g:3} },
  { kw:['مجبوس'],                            n:{calories:530,protein_g:34,carbs_g:57,fat_g:15,fiber_g:3} },
  { kw:['برياني دجاج','برياني الدجاج'],      n:{calories:550,protein_g:34,carbs_g:62,fat_g:14,fiber_g:3} },
  { kw:['برياني لحم','برياني اللحم'],        n:{calories:600,protein_g:37,carbs_g:62,fat_g:18,fiber_g:3} },
  { kw:['برياني'],                           n:{calories:560,protein_g:34,carbs_g:62,fat_g:15,fiber_g:3} },
  { kw:['مندي دجاج','مندي الدجاج'],          n:{calories:530,protein_g:38,carbs_g:55,fat_g:13,fiber_g:2} },
  { kw:['مندي لحم','مندي اللحم'],            n:{calories:590,protein_g:40,carbs_g:55,fat_g:18,fiber_g:2} },
  { kw:['مندي'],                             n:{calories:555,protein_g:38,carbs_g:55,fat_g:15,fiber_g:2} },
  { kw:['بخاري','بخاري اللحم','بخاري الدجاج'],n:{calories:545,protein_g:34,carbs_g:60,fat_g:15,fiber_g:3} },
  { kw:['مقلوبة','مقلوبه'],                  n:{calories:500,protein_g:28,carbs_g:58,fat_g:14,fiber_g:4} },
  { kw:['زربيان','زرب'],                     n:{calories:580,protein_g:36,carbs_g:60,fat_g:16,fiber_g:3} },
  { kw:['قبولي','قابلي'],                    n:{calories:520,protein_g:28,carbs_g:62,fat_g:14,fiber_g:4} },
  { kw:['مدغوس'],                            n:{calories:480,protein_g:30,carbs_g:55,fat_g:13,fiber_g:4} },
  { kw:['ملوخية'],                           n:{calories:380,protein_g:26,carbs_g:42,fat_g:10,fiber_g:5} },
  { kw:['رز بالحليب','أرز بالحليب'],         n:{calories:320,protein_g:8,carbs_g:55,fat_g:7,fiber_g:1} },
  { kw:['أرز أبيض','رز أبيض','أرز مسلوق'],  n:{calories:210,protein_g:4,carbs_g:46,fat_g:1,fiber_g:1} },
  // ── Pasta ────────────────────────────────────────────────────────────────
  { kw:['لازانيا','لازانيه'],                n:{calories:480,protein_g:24,carbs_g:42,fat_g:22,fiber_g:3} },
  { kw:['باستا','معكرونة','مكرونة','سباغيتي'],n:{calories:420,protein_g:18,carbs_g:58,fat_g:12,fiber_g:3} },
  // ── Chicken ──────────────────────────────────────────────────────────────
  { kw:['دجاج مشوي','دجاجة مشوية','فراخ مشوية'], n:{calories:290,protein_g:38,carbs_g:2,fat_g:12,fiber_g:0} },
  { kw:['دجاج مقلي','دجاج مقرمش','فراخ مقلية'],  n:{calories:400,protein_g:32,carbs_g:20,fat_g:20,fiber_g:1} },
  { kw:['شاورما دجاج'],                      n:{calories:480,protein_g:30,carbs_g:42,fat_g:18,fiber_g:2} },
  { kw:['دجاج بالكريمة','دجاج كريمة'],       n:{calories:430,protein_g:32,carbs_g:8,fat_g:28,fiber_g:1} },
  { kw:['دجاج بالزبدة','دجاج بالثوم'],       n:{calories:380,protein_g:34,carbs_g:4,fat_g:22,fiber_g:1} },
  { kw:['دجاج تندوري'],                      n:{calories:310,protein_g:36,carbs_g:8,fat_g:14,fiber_g:1} },
  { kw:['صدر دجاج'],                         n:{calories:250,protein_g:40,carbs_g:3,fat_g:7,fiber_g:0} },
  { kw:['مسخن'],                             n:{calories:520,protein_g:32,carbs_g:40,fat_g:24,fiber_g:3} },
  { kw:['دجاج'],                             n:{calories:340,protein_g:34,carbs_g:8,fat_g:16,fiber_g:1} },
  // ── Meat ─────────────────────────────────────────────────────────────────
  { kw:['شاورما لحم'],                       n:{calories:510,protein_g:32,carbs_g:40,fat_g:22,fiber_g:2} },
  { kw:['كباب','كباب حلبي','كباب عراقي'],    n:{calories:370,protein_g:30,carbs_g:12,fat_g:22,fiber_g:1} },
  { kw:['كفتة','كفته'],                      n:{calories:350,protein_g:28,carbs_g:10,fat_g:22,fiber_g:1} },
  { kw:['شيش طاووق'],                        n:{calories:290,protein_g:32,carbs_g:6,fat_g:14,fiber_g:1} },
  { kw:['برغر','برقر'],                      n:{calories:520,protein_g:28,carbs_g:38,fat_g:26,fiber_g:2} },
  { kw:['ستيك'],                             n:{calories:420,protein_g:36,carbs_g:2,fat_g:28,fiber_g:0} },
  { kw:['قوزي'],                             n:{calories:620,protein_g:42,carbs_g:55,fat_g:22,fiber_g:3} },
  { kw:['مضبي','مظبي'],                      n:{calories:520,protein_g:40,carbs_g:48,fat_g:16,fiber_g:2} },
  { kw:['حنيذ'],                             n:{calories:540,protein_g:40,carbs_g:50,fat_g:16,fiber_g:2} },
  { kw:['لحم ضأن','لحم خروف'],               n:{calories:480,protein_g:36,carbs_g:8,fat_g:30,fiber_g:1} },
  { kw:['لحم مفروم','لحمة مفرومة'],          n:{calories:380,protein_g:28,carbs_g:10,fat_g:24,fiber_g:1} },
  { kw:['كبدة','كبد'],                       n:{calories:290,protein_g:28,carbs_g:8,fat_g:14,fiber_g:1} },
  { kw:['ضلع','اضلع','أضلع'],                n:{calories:480,protein_g:36,carbs_g:4,fat_g:32,fiber_g:0} },
  // ── Seafood ──────────────────────────────────────────────────────────────
  { kw:['سمك مشوي'],                         n:{calories:220,protein_g:32,carbs_g:2,fat_g:8,fiber_g:0} },
  { kw:['سمك مقلي','سمك مقرمش'],             n:{calories:340,protein_g:28,carbs_g:18,fat_g:16,fiber_g:1} },
  { kw:['ربيان مشوي','جمبري مشوي'],          n:{calories:190,protein_g:28,carbs_g:2,fat_g:6,fiber_g:0} },
  { kw:['ربيان مقلي','جمبري مقلي'],          n:{calories:310,protein_g:24,carbs_g:18,fat_g:14,fiber_g:1} },
  { kw:['ربيان بالثوم','جمبري بالثوم'],      n:{calories:240,protein_g:26,carbs_g:5,fat_g:12,fiber_g:0} },
  { kw:['ربيان','جمبري','قريدس'],            n:{calories:250,protein_g:26,carbs_g:8,fat_g:10,fiber_g:0} },
  { kw:['حبار'],                             n:{calories:220,protein_g:24,carbs_g:8,fat_g:8,fiber_g:0} },
  { kw:['هامور','ميرو','هاموور'],            n:{calories:200,protein_g:30,carbs_g:2,fat_g:7,fiber_g:0} },
  { kw:['تونة','تن'],                        n:{calories:180,protein_g:26,carbs_g:4,fat_g:6,fiber_g:0} },
  { kw:['سمك'],                              n:{calories:250,protein_g:28,carbs_g:8,fat_g:10,fiber_g:0} },
  // ── Gulf dishes ──────────────────────────────────────────────────────────
  { kw:['هريس','هريسة'],                     n:{calories:420,protein_g:28,carbs_g:48,fat_g:10,fiber_g:3} },
  { kw:['جريش'],                             n:{calories:380,protein_g:18,carbs_g:55,fat_g:10,fiber_g:4} },
  { kw:['بليلة'],                            n:{calories:280,protein_g:10,carbs_g:48,fat_g:5,fiber_g:6} },
  { kw:['مراصيع','مطازيز'],                  n:{calories:450,protein_g:26,carbs_g:52,fat_g:14,fiber_g:4} },
  { kw:['هنيني'],                            n:{calories:380,protein_g:12,carbs_g:58,fat_g:10,fiber_g:3} },
  { kw:['عصيد','عصيده'],                     n:{calories:350,protein_g:12,carbs_g:55,fat_g:8,fiber_g:3} },
  { kw:['سليق'],                             n:{calories:440,protein_g:28,carbs_g:50,fat_g:12,fiber_g:2} },
  { kw:['مرقوق','مرق'],                      n:{calories:420,protein_g:24,carbs_g:46,fat_g:12,fiber_g:5} },
  { kw:['غيمش'],                             n:{calories:200,protein_g:14,carbs_g:10,fat_g:12,fiber_g:1} },
  { kw:['صالونة','سالونة'],                  n:{calories:350,protein_g:26,carbs_g:22,fat_g:14,fiber_g:4} },
  { kw:['مكبوس'],                            n:{calories:530,protein_g:34,carbs_g:57,fat_g:15,fiber_g:3} },
  { kw:['بلاليط','بلالیط'],                  n:{calories:460,protein_g:10,carbs_g:66,fat_g:16,fiber_g:2} },
  { kw:['فطيرة خليجية','رغيف'],              n:{calories:340,protein_g:10,carbs_g:50,fat_g:10,fiber_g:2} },
  // ── Soups ────────────────────────────────────────────────────────────────
  { kw:['شوربة عدس'],                        n:{calories:180,protein_g:10,carbs_g:30,fat_g:4,fiber_g:8} },
  { kw:['شوربة دجاج','حساء دجاج'],           n:{calories:200,protein_g:18,carbs_g:16,fat_g:8,fiber_g:2} },
  { kw:['شوربة لحم','حساء لحم'],             n:{calories:240,protein_g:22,carbs_g:18,fat_g:10,fiber_g:2} },
  { kw:['شوربة خضار','حساء خضار'],           n:{calories:120,protein_g:5,carbs_g:18,fat_g:4,fiber_g:4} },
  { kw:['شوربة طماطم','حساء طماطم'],         n:{calories:110,protein_g:3,carbs_g:16,fat_g:4,fiber_g:2} },
  { kw:['شوربة كريمة'],                      n:{calories:220,protein_g:5,carbs_g:14,fat_g:16,fiber_g:2} },
  { kw:['شوربة','حساء'],                     n:{calories:160,protein_g:10,carbs_g:18,fat_g:6,fiber_g:3} },
  // ── Salads ───────────────────────────────────────────────────────────────
  { kw:['سلطة زبادي','سلطة لبن'],            n:{calories:120,protein_g:6,carbs_g:10,fat_g:6,fiber_g:1} },
  { kw:['تبولة','تبولة','تبوله'],            n:{calories:150,protein_g:4,carbs_g:18,fat_g:7,fiber_g:4} },
  { kw:['فتوش'],                             n:{calories:170,protein_g:4,carbs_g:22,fat_g:8,fiber_g:3} },
  { kw:['سلطة يونانية'],                     n:{calories:200,protein_g:6,carbs_g:10,fat_g:16,fiber_g:2} },
  { kw:['كول سلو','كولسلو'],                 n:{calories:180,protein_g:2,carbs_g:14,fat_g:14,fiber_g:2} },
  { kw:['سلطة خضراء','سلطة خضار'],           n:{calories:100,protein_g:3,carbs_g:10,fat_g:6,fiber_g:3} },
  { kw:['سلطة'],                             n:{calories:140,protein_g:4,carbs_g:14,fat_g:7,fiber_g:3} },
  // ── Breakfast ────────────────────────────────────────────────────────────
  { kw:['فول'],                              n:{calories:300,protein_g:14,carbs_g:40,fat_g:8,fiber_g:10} },
  { kw:['فلافل'],                            n:{calories:350,protein_g:14,carbs_g:38,fat_g:16,fiber_g:6} },
  { kw:['شكشوكة'],                           n:{calories:280,protein_g:14,carbs_g:16,fat_g:18,fiber_g:4} },
  { kw:['أومليت','أوملت'],                   n:{calories:260,protein_g:16,carbs_g:4,fat_g:20,fiber_g:1} },
  { kw:['بيض بالطماطم','بيض مع طماطم'],     n:{calories:240,protein_g:14,carbs_g:10,fat_g:16,fiber_g:2} },
  { kw:['عجة','عجه'],                        n:{calories:250,protein_g:14,carbs_g:6,fat_g:18,fiber_g:1} },
  { kw:['بيض'],                              n:{calories:220,protein_g:14,carbs_g:4,fat_g:16,fiber_g:0} },
  { kw:['فتة'],                              n:{calories:380,protein_g:18,carbs_g:42,fat_g:14,fiber_g:4} },
  // ── Desserts ─────────────────────────────────────────────────────────────
  { kw:['لقيمات'],                           n:{calories:420,protein_g:6,carbs_g:58,fat_g:18,fiber_g:2} },
  { kw:['كنافة','كنافه'],                    n:{calories:480,protein_g:12,carbs_g:60,fat_g:22,fiber_g:2} },
  { kw:['بسبوسة'],                           n:{calories:350,protein_g:6,carbs_g:52,fat_g:14,fiber_g:2} },
  { kw:['مهلبية'],                           n:{calories:240,protein_g:5,carbs_g:40,fat_g:7,fiber_g:1} },
  { kw:['بقلاوة'],                           n:{calories:420,protein_g:7,carbs_g:50,fat_g:22,fiber_g:2} },
  { kw:['سحلب'],                             n:{calories:280,protein_g:5,carbs_g:48,fat_g:7,fiber_g:1} },
  { kw:['رقاق','رقائق'],                     n:{calories:300,protein_g:6,carbs_g:48,fat_g:10,fiber_g:2} },
  { kw:['خبيصة'],                            n:{calories:400,protein_g:5,carbs_g:62,fat_g:14,fiber_g:2} },
  { kw:['مثلوثة'],                           n:{calories:380,protein_g:8,carbs_g:54,fat_g:15,fiber_g:3} },
  { kw:['مصابيب'],                           n:{calories:340,protein_g:8,carbs_g:50,fat_g:12,fiber_g:2} },
  { kw:['كعك'],                              n:{calories:320,protein_g:6,carbs_g:48,fat_g:12,fiber_g:2} },
  { kw:['بسكويت','كوكيز'],                   n:{calories:380,protein_g:5,carbs_g:52,fat_g:18,fiber_g:1} },
  { kw:['براونيز','براوني'],                 n:{calories:440,protein_g:6,carbs_g:52,fat_g:24,fiber_g:2} },
  { kw:['تشيز كيك','تشيزكيك'],              n:{calories:460,protein_g:8,carbs_g:44,fat_g:28,fiber_g:1} },
  { kw:['كيك','كاتو'],                       n:{calories:400,protein_g:6,carbs_g:54,fat_g:18,fiber_g:1} },
  { kw:['وافل'],                             n:{calories:350,protein_g:8,carbs_g:48,fat_g:14,fiber_g:2} },
  { kw:['دونات'],                            n:{calories:380,protein_g:5,carbs_g:50,fat_g:18,fiber_g:1} },
  { kw:['كريب'],                             n:{calories:300,protein_g:8,carbs_g:40,fat_g:12,fiber_g:1} },
  { kw:['بان كيك','بانكيك'],                 n:{calories:340,protein_g:8,carbs_g:50,fat_g:12,fiber_g:2} },
  { kw:['موس شوكولا','موس'],                 n:{calories:360,protein_g:6,carbs_g:38,fat_g:22,fiber_g:2} },
  { kw:['بودينج'],                           n:{calories:280,protein_g:5,carbs_g:44,fat_g:9,fiber_g:1} },
  { kw:['تمر بالطحينة','تمر بالقشطة'],      n:{calories:380,protein_g:5,carbs_g:58,fat_g:15,fiber_g:6} },
  { kw:['تمر'],                              n:{calories:300,protein_g:3,carbs_g:65,fat_g:1,fiber_g:7} },
  { kw:['حلوى','حلا'],                       n:{calories:360,protein_g:5,carbs_g:52,fat_g:14,fiber_g:2} },
  // ── Appetizers ───────────────────────────────────────────────────────────
  { kw:['حمص'],                              n:{calories:200,protein_g:10,carbs_g:22,fat_g:9,fiber_g:6} },
  { kw:['متبل','بابا غنوج','بابا غنوج'],     n:{calories:160,protein_g:3,carbs_g:14,fat_g:10,fiber_g:3} },
  { kw:['دقوس'],                             n:{calories:80,protein_g:2,carbs_g:14,fat_g:2,fiber_g:3} },
  { kw:['محمرة'],                            n:{calories:180,protein_g:5,carbs_g:16,fat_g:12,fiber_g:3} },
  { kw:['سمبوسة','سمبوسه'],                 n:{calories:320,protein_g:12,carbs_g:36,fat_g:14,fiber_g:2} },
  { kw:['لبنة'],                             n:{calories:180,protein_g:10,carbs_g:8,fat_g:12,fiber_g:0} },
  { kw:['جبنة','جبن'],                       n:{calories:250,protein_g:14,carbs_g:6,fat_g:20,fiber_g:0} },
  { kw:['مقبلات'],                           n:{calories:180,protein_g:7,carbs_g:18,fat_g:9,fiber_g:3} },
  // ── Bread / Pastries ─────────────────────────────────────────────────────
  { kw:['خبز','خبيز'],                       n:{calories:220,protein_g:7,carbs_g:42,fat_g:3,fiber_g:2} },
  { kw:['فطيرة','فطائر'],                    n:{calories:320,protein_g:10,carbs_g:42,fat_g:12,fiber_g:2} },
  { kw:['معجنات'],                           n:{calories:350,protein_g:10,carbs_g:48,fat_g:14,fiber_g:2} },
  // ── Drinks ───────────────────────────────────────────────────────────────
  { kw:['عصير برتقال','عصير ليمون'],         n:{calories:100,protein_g:1,carbs_g:24,fat_g:0,fiber_g:0} },
  { kw:['عصير'],                             n:{calories:130,protein_g:1,carbs_g:30,fat_g:0,fiber_g:1} },
  { kw:['سموذي','سموذ'],                     n:{calories:250,protein_g:6,carbs_g:44,fat_g:5,fiber_g:4} },
  { kw:['ليموناضة','ليمون بالنعناع'],        n:{calories:90,protein_g:0,carbs_g:22,fat_g:0,fiber_g:0} },
  { kw:['شاي بالحليب'],                      n:{calories:120,protein_g:4,carbs_g:18,fat_g:4,fiber_g:0} },
  { kw:['شاي','قهوة'],                       n:{calories:40,protein_g:1,carbs_g:8,fat_g:1,fiber_g:0} },
  { kw:['مشروب','كوكتيل'],                   n:{calories:180,protein_g:2,carbs_g:38,fat_g:2,fiber_g:2} },
]

// ── Tier 2: Category-level defaults ───────────────────────────────────────
const CATEGORY_DEFAULTS = {
  'أرز ومجبوس':        {calories:530,protein_g:33,carbs_g:58,fat_g:15,fiber_g:3},
  'دجاج':             {calories:340,protein_g:34,carbs_g:8,fat_g:16,fiber_g:1},
  'لحم':              {calories:420,protein_g:32,carbs_g:12,fat_g:24,fiber_g:2},
  'سمك ومأكولات بحرية':{calories:260,protein_g:28,carbs_g:8,fat_g:10,fiber_g:1},
  'سمك':              {calories:260,protein_g:28,carbs_g:8,fat_g:10,fiber_g:1},
  'شوربة':            {calories:160,protein_g:10,carbs_g:18,fat_g:6,fiber_g:3},
  'سلطة':             {calories:140,protein_g:4,carbs_g:14,fat_g:7,fiber_g:3},
  'حلويات':           {calories:380,protein_g:5,carbs_g:54,fat_g:16,fiber_g:2},
  'فطور':             {calories:300,protein_g:14,carbs_g:30,fat_g:14,fiber_g:3},
  'أطباق خليجية':     {calories:440,protein_g:26,carbs_g:50,fat_g:14,fiber_g:3},
  'مقبلات':           {calories:180,protein_g:7,carbs_g:18,fat_g:9,fiber_g:3},
  'مشروبات':          {calories:140,protein_g:2,carbs_g:28,fat_g:2,fiber_g:1},
  'خبز ومعجنات':      {calories:300,protein_g:8,carbs_g:44,fat_g:10,fiber_g:2},
  'أخرى':             {calories:350,protein_g:18,carbs_g:35,fat_g:14,fiber_g:3},
}

// ── Ingredient modifiers ───────────────────────────────────────────────────
// Applied on top of fingerprint/category base — nudge values based on
// key ingredients being present
const INGREDIENT_MODIFIERS = [
  { kw:'زبدة',      delta:{calories:+30,fat_g:+3} },
  { kw:'سمنة',      delta:{calories:+30,fat_g:+3} },
  { kw:'كريمة',     delta:{calories:+40,fat_g:+4} },
  { kw:'جبنة',      delta:{calories:+25,protein_g:+3,fat_g:+2} },
  { kw:'تمر',       delta:{calories:+20,carbs_g:+5} },
  { kw:'عسل',       delta:{calories:+20,carbs_g:+5} },
  { kw:'زيت زيتون', delta:{calories:+15,fat_g:+2} },
  { kw:'حليب',      delta:{calories:+15,protein_g:+1,carbs_g:+2} },
  { kw:'سكر',       delta:{calories:+25,carbs_g:+6} },
  { kw:'خبز',       delta:{calories:+40,carbs_g:+8} },
  { kw:'بطاطس',     delta:{calories:+30,carbs_g:+7} },
  { kw:'جزر',       delta:{calories:+5,fiber_g:+1} },
  { kw:'خضار',      delta:{calories:+5,fiber_g:+1} },
  { kw:'عدس',       delta:{calories:+20,protein_g:+3,fiber_g:+3} },
  { kw:'حمص',       delta:{calories:+15,protein_g:+2,fiber_g:+2} },
]

// ── Core estimation function ───────────────────────────────────────────────
function estimateNutrition(recipe) {
  const name       = recipe.name       ?? ''
  const category   = recipe.category   ?? ''
  const ingredients= Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  const ingText    = ingredients.join(' ')

  // 1. Try dish fingerprint (longest keyword match wins)
  let matched = null
  let matchLen = 0
  for (const fp of DISH_FINGERPRINTS) {
    for (const kw of fp.kw) {
      if (name.includes(kw) && kw.length > matchLen) {
        matched = { ...fp.n }
        matchLen = kw.length
      }
    }
  }

  // 2. Fall back to category default
  if (!matched) {
    matched = { ...(CATEGORY_DEFAULTS[category] ?? CATEGORY_DEFAULTS['أخرى']) }
  }

  // 3. Apply ingredient modifiers (light adjustments only)
  for (const mod of INGREDIENT_MODIFIERS) {
    if (ingText.includes(mod.kw)) {
      for (const [key, delta] of Object.entries(mod.delta)) {
        matched[key] = (matched[key] || 0) + delta
      }
    }
  }

  // 4. Round to sensible precision
  return {
    calories:  Math.round(matched.calories),
    protein_g: Math.round(matched.protein_g * 10) / 10,
    carbs_g:   Math.round(matched.carbs_g   * 10) / 10,
    fat_g:     Math.round(matched.fat_g     * 10) / 10,
    fiber_g:   Math.round(matched.fiber_g   * 10) / 10,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN — fetch, estimate, update
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📥  Fetching recipes where calories IS NULL…')
let q = supabase
  .from('recipes')
  .select('id, name, servings, ingredients, category')
  .is('calories', null)
  .order('created_at')
if (LIMIT) q = q.limit(LIMIT)

const { data: recipes, error: fetchErr } = await q
if (fetchErr) { console.error('❌', fetchErr.message); process.exit(1) }

const total = recipes.length
console.log(`    ${total} recipes to process${DRY_RUN ? ' (DRY RUN)' : ''}${LIMIT ? ` (limited to ${LIMIT})` : ''}\n`)

let succeeded = 0
let failed    = 0

for (let i = 0; i < recipes.length; i++) {
  const recipe = recipes[i]
  const tag    = `[${String(i + 1).padStart(String(total).length)}/${total}]`

  try {
    const nutrition = estimateNutrition(recipe)

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('recipes')
        .update({
          calories:               nutrition.calories,
          protein_g:              nutrition.protein_g,
          carbs_g:                nutrition.carbs_g,
          fat_g:                  nutrition.fat_g,
          fiber_g:                nutrition.fiber_g,
          nutrition_estimated_at: new Date().toISOString(),
        })
        .eq('id', recipe.id)

      if (upErr) throw new Error('DB: ' + upErr.message)
    }

    const name40 = recipe.name.slice(0, 40).padEnd(40)
    console.log(
      `${tag} ✅  ${name40}  ` +
      `${String(nutrition.calories).padStart(4)} cal | ` +
      `P:${String(nutrition.protein_g).padStart(4)}g ` +
      `C:${String(nutrition.carbs_g).padStart(4)}g ` +
      `F:${String(nutrition.fat_g).padStart(4)}g`
    )
    succeeded++

  } catch (err) {
    console.log(`${tag} ❌  ${recipe.name.slice(0, 40)} — ${err.message}`)
    failed++
  }
}

console.log('\n── Summary ──────────────────────────────────────────────')
console.log(`   Total:     ${total}`)
console.log(`   Succeeded: ${succeeded}`)
console.log(`   Failed:    ${failed}`)
if (DRY_RUN) console.log('   DRY RUN — no DB writes made')
console.log()
