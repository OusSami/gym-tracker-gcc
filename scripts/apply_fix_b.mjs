/**
 * apply_fix_b.mjs — Fix B: mark 45 incomplete/sauce-only recipes as 'component'
 *
 * PREREQUISITE: Run migrations/migration_recipe_type.sql in the Supabase SQL
 * editor first. This script will exit with a clear error if the column doesn't
 * exist yet.
 *
 * What it does:
 *   UPDATE public.recipes SET recipe_type = 'component' WHERE id IN (...)
 *   for 45 confirmed sauce/marinade/incomplete recipes (46 flagged − 1 on hold).
 *
 * Recipes marked for future full-dish restoration (AI-regen or manual patch):
 *   - مجبوس الدجاج الكويتي   (Kuwaiti chicken majboos)
 *   - طريقة عمل البخاري بالدجاج ورز البسمتي
 *   - مدفون لحم
 *   - مظبي لحم
 *   - مجبوس لحم
 *   These are famous full dishes with genuinely incomplete scraped data,
 *   not actual sauces. Flagged now to keep them out of meal recs; should be
 *   restored (not permanently labelled as components) in a future data pass.
 *
 * Excluded from this run (still on hold):
 *   - جيب التاجر بالتونة  (id: 64f41d6c-5595-4c86-9f34-a9e92f65e5b9)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY   || envLocal['SUPABASE_SERVICE_ROLE_KEY']
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(SB_URL, SB_KEY)

// ── Verify column exists before proceeding ────────────────────────────────────
const { error: colCheck } = await sb.from('recipes').select('recipe_type').limit(1)
if (colCheck) {
  console.error('ERROR: recipe_type column not found.')
  console.error('Run migrations/migration_recipe_type.sql in the Supabase SQL editor first.')
  process.exit(1)
}

// ── 45 recipe IDs to flag as 'component' ─────────────────────────────────────
// (جيب التاجر بالتونة excluded — on hold)
const COMPONENT_IDS = [
  // layalina (3)
  '9f419eb6-7c7b-4bcd-8ebb-3eb6d4be5082', // البشاميل للمكرونة بخطوات سهلة
  '46eb0ea7-2f6b-4b1f-89f3-aba67dcf08d1', // برياني الدجاج
  'd70f3f81-2115-42d4-9ea5-d1dba46695d6', // كباب ميرو السعودي

  // sayidaty (42)
  '56a06178-98ac-4d73-b90d-6d8707c38016', // أرز مديني
  '111fba07-e50a-40d1-8236-314236298d35', // الرقش باللحم
  '54670be8-fe8f-42d5-9a67-f13133dd7222', // مكبوس الأرز مع سمك الشعري
  '4d62cac7-ef40-4112-85bd-cc9c7d74479b', // مجبوس الدجاج الكويتي  ← future restoration
  '1ec3c4ad-579a-4cc0-bfc6-af6f66584afb', // طريقة عمل البخاري بالدجاج ورز البسمتي  ← future restoration
  '4696647e-d976-46dd-a6d2-e811cba39f2b', // لبنية اللحم على الطريقة الشامية
  '497c9f57-1ee2-4d7e-936b-cfeaad4dfe88', // قرصان باللحم
  'f1260866-414e-444b-b88e-73e1f9eafb23', // فخارة فيليه السمك بصلصة الطحينة
  '2183553b-9cbc-47a2-9fe3-23bbd85bc89e', // سلمون مشوي بالزبدة والليمون
  'e8a9a6f0-9d1c-4b15-a3f4-0e3b848a8887', // سمك مشوي على الفحم مع صلصة الطحينة
  '43acd27c-36b8-4fe4-b80c-843bdc58b7f6', // حمص باللحم لفطور العيد
  '2b56afa8-389e-4388-b866-7529b8c35e75', // دجاج بالليمون والثوم بالفرن
  '8337817c-9e72-41ba-b9b7-253c0dacffc1', // فيليه السمك الأبيض بصوص البيستو والبرتقال
  'c103d690-6b06-4750-b34e-b8d1132d5717', // دجاج مشوي بنكهة المطاعم
  '5c94e639-6b6f-4900-9853-35a79c9289fd', // رز أبيض مع صوص الدقوس
  '275b4f90-8e96-452d-b557-4540f55441f6', // مطبق سمك هامور
  'e689fc19-c2dd-4b07-894d-6c871c016588', // فخارة لحم بطريقة المطاعم
  '30d4ce8c-6caa-41a3-8528-1b7017b979c5', // فيليه سمك بالطحينة
  '38b3f323-02e4-4f54-9672-3564f9f16b40', // دجاج بالكريمة والفطر بطريقة المطاعم
  'e1bc968e-ac27-4169-abff-46a14c2d4dd7', // دجاج بالكريمة والمشروم
  '2160ba04-2973-4c79-b9dd-012139e3fa3a', // كفتة الرز الخفيفة
  'bed22f2a-b4bf-4f1c-8ff7-890db125ecac', // سمك بالصوص الأبيض الخفيف
  'f7fab760-90f8-4e48-b774-ce6bf1f915a1', // جمبري سوتيه بالخضار للرجيم
  'b30c07c4-ce2b-4159-9fa6-ba3946ca0a2a', // ستيك اللحم بزبادي الأعشاب المدخنة
  'caf332b2-7783-42b2-bc04-eec036ef8fdb', // صينية كفتة بالفرن بدون قلي
  'f9060c01-d5bc-45ff-a8e7-7183cc649630', // لفائف الدجاج بالصوص الأبيض
  '635f6370-537b-4684-9f4b-bb7bd7701687', // بوفالو وينجز الدجاج الحار
  '3098fb9f-2e40-4c85-896d-64f23c214475', // الجلاش باللحمة
  'ed8cd402-0331-42c5-875b-6b36931080d2', // سمك فيليه مقرمش بصوص الليمون
  '32bd4702-4452-40cc-a47b-29d027df0fbb', // ترياكي السلمون المشوي
  'd9e3b919-3f69-4306-b071-6f16474e8974', // دجاج كريسبي بصوص العسل
  '24dff83d-b63d-4c80-a089-58e777d75324', // مدفون لحم  ← future restoration
  'c0f7c5c0-e6c0-4a6a-9bf5-f8913fca4d10', // مرقوقة الدجاج من الإمارات
  '06298b7a-ba61-4eab-9879-4eb49e022bb2', // مظبي لحم  ← future restoration
  '9d0830d4-dd79-4ce4-b8c3-00edc51090b6', // مجبوس لحم  ← future restoration
  'c66cf3d5-e5d4-41db-a3d8-348bf05f5293', // سمك بالطحينة بدون فرن
  'bbf92349-2b39-4e66-b6ce-19cf4c158828', // فيليه سمك بالصوص الحار
  '6a36d296-8569-43db-ae22-766913e7fc67', // المسخن بالدجاج والسماق
  '617f1fb6-27ef-420c-a884-9803aaf7d59c', // كفتة الرز بالصلصة
  'a8e16ef9-4071-4c65-bc5e-2a36c791e882', // بخاري اللحم مثل المطاعم
  '058b55fb-9cff-410c-80fe-77bf40b646fb', // صينية شاورما اللحم بالطحينية
  '0cfd98b7-4a2c-4ad6-958a-0da5a1d1ec62', // كباب الميرو على الطريقة السعودية مع رز الزعفران
]

console.log(`Updating ${COMPONENT_IDS.length} recipes to recipe_type = 'component'...`)

const { data, error } = await sb
  .from('recipes')
  .update({ recipe_type: 'component' })
  .in('id', COMPONENT_IDS)
  .select('id, name, recipe_type')

if (error) {
  console.error('UPDATE failed:', error.message)
  process.exit(1)
}

console.log(`Done. Updated ${data?.length ?? '?'} rows.`)
if (data?.length && data.length !== COMPONENT_IDS.length) {
  console.warn(`WARNING: Expected ${COMPONENT_IDS.length} updates, got ${data.length}. Check for missing IDs.`)
}

// Verify
const { data: check } = await sb
  .from('recipes')
  .select('id, name, recipe_type')
  .in('id', COMPONENT_IDS)
  .neq('recipe_type', 'component')
if (check?.length) {
  console.error(`VERIFICATION FAILED: ${check.length} rows still not 'component':`)
  check.forEach(r => console.error(`  ${r.name} → ${r.recipe_type}`))
} else {
  console.log('Verification passed: all 45 rows are recipe_type = component.')
}
