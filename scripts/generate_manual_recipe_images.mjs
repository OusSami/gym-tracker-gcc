#!/usr/bin/env node
/**
 * Generate images for manually-added recipes that have no image_url.
 * Pipeline: Gemini image generation → sharp WebP conversion → Supabase Storage upload → DB update
 */
import fs   from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// ── Credentials ──────────────────────────────────────────────────────────────
const SB_URL  = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || (() => {
  const f = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f,'utf8').split('\n')) {
    const m = l.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)\s*$/)
    if (m) return m[1].trim().replace(/^["']|["']$/g,'')
  }
})()

function getGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  for (const file of ['.env', '.env.local']) {
    const f = path.join(process.cwd(), file)
    if (!fs.existsSync(f)) continue
    for (const l of fs.readFileSync(f,'utf8').split('\n')) {
      const m = l.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/)
      if (m) return m[1].trim().replace(/^["']|["']$/g,'')
    }
  }
  return null
}
const GEMINI_KEY = getGeminiKey()
if (!GEMINI_KEY) { console.error('No GEMINI_API_KEY found'); process.exit(1) }

const GEMINI_MODEL = 'gemini-3.1-flash-image'
const STORAGE_BUCKET = 'recipes'

const sb = createClient(SB_URL, SB_KEY)

// ── Output directory ─────────────────────────────────────────────────────────
const OUT_DIR = path.resolve('public/recipe-images')
fs.mkdirSync(OUT_DIR, { recursive: true })

// ── Category hints ───────────────────────────────────────────────────────────
const CAT_HINTS = {
  'فطور': 'authentic Gulf Arabic breakfast dish, morning warm light, beautifully plated on a traditional Arabic table',
  'شوربة': 'Gulf Arabic soup served in a ceramic bowl, steam rising, rustic warm background',
}

// ── Dish-specific visual prompts ─────────────────────────────────────────────
const DISH_PROMPTS = {
  'بيض بالقديد':
    'pan-fried scrambled eggs mixed with Gulf qadeed cured dried beef strips, dark caramelized meat bits in fluffy eggs in a cast iron skillet, steam rising',
  'بيض بالكبدة الخليجية':
    'scrambled eggs with tender diced lamb liver, caramelized golden onions, Gulf spices turmeric and cardamom, served in a copper skillet',
  'خبز التميس الإماراتي بالزبدة والعسل':
    'golden thick Emirati tameez flatbread fresh from the oven, sliced open, melted butter pooling inside, golden honey drizzle glistening',
  'كيشة القمح السعودية':
    'creamy Saudi keisha wheat porridge in a shallow clay bowl, warm beige texture, drizzled with clarified butter, dusted with cinnamon and cardamom',
  'شوفان بالتمر والحليب':
    'warm oatmeal in a rustic ceramic bowl topped with halved glossy Medjool dates, honey drizzle, saffron threads, crushed pistachios and almonds',
  'بيض مقلي بالطماطم والثوم':
    'Gulf-style eggs in spiced tomato garlic sauce, bright red sauce, runny yolks, fresh cilantro garnish, served in a rustic skillet',
  'جريش الإفطار بالحليب':
    'creamy Gulf jareesh crushed wheat porridge with milk, thick comforting texture in a white ceramic bowl, pool of golden ghee on top',
  'بيض بالسجق الخليجي':
    'scrambled eggs with sliced Gulf-spiced sujuk sausage, rich reddish oil, tender eggs, served in a dark cast iron pan',
  'خبز الرقاق الإماراتي بالجبنة':
    'Emirati paper-thin raqaq crispy flatbread folded with white cheese inside, golden and slightly charred edges on a flat griddle',
  'لقيمات الإفطار بالعسل':
    'pile of golden crispy Emirati luqaimat dumplings in a bowl, dark honey drizzled generously, sesame seeds scattered, Arabic coffee cup alongside',
  'عصيدة الإفطار بالزبدة والعسل':
    'smooth thick Gulf aseedah wheat porridge in a wide clay dish, deep crater in center filled with golden clarified ghee and drizzled honey, wooden spoon resting beside',
  'بيض مع المرتديلا والجبنة الخليجية':
    'fluffy scrambled eggs with sliced mortadella and melted processed cheese, served in a non-stick pan, colorful breakfast spread',
  'فطير الجبنة الخليجي':
    'flaky golden Gulf cheese fatteer pastry, baked golden with sesame seeds on top, cross-section revealing stretchy melted white cheese filling',
  'تميس بالدبس الكويتي':
    'Kuwaiti tamees bread generously spread with dark rich date molasses dibs and swirled tahini, served on a ceramic plate with Arabic coffee in background',
  'خبز الخمير الخليجي':
    'soft fluffy Gulf khameer yeasted bread rolls, deep golden brown, served in a rustic basket with cloth lining, sesame and nigella seeds on top',
  'بيض أومليت بالدجاج المفروم':
    'thick Gulf-style folded omelette filled with seasoned minced chicken and fresh herbs, golden exterior in a skillet, steam rising',
  'حليب بالتمر والزعفران':
    'warm saffron-infused golden milk in a decorative Arabic glass, topped with crushed pistachios, a few glossy Medjool dates arranged beside it',
  'شيرة حساء القمح الحلو':
    'sweet warm wheat sheera porridge in a bowl, soft golden color, garnished with saffron strands, cardamom pods, and a pool of honey',
  'هريس الإفطار الخليجي الخفيف':
    'smooth Gulf harees wheat and chicken porridge, creamy beige texture, served in a clay bowl, drizzled with melted ghee and dusted with cinnamon',
  'بيض بالقشدة والزعفران':
    'silky soft-scrambled eggs with heavy cream and saffron, pale golden color with saffron streaks, delicate custard-like texture in a white ceramic plate',
  'ثريد الإفطار الخفيف':
    'Gulf light thareed, thin flatbread layered in a wide plate, soaked with golden chicken broth, tender meat pieces on top, garnished with parsley',
  'بيض بالجبنة البيضاء والزعتر الخليجي':
    'flat omelette with crumbled white brined cheese and za\'atar herb mix, drizzled with extra virgin olive oil, fresh and vibrant on a round ceramic plate',
  'كليجا الإفطار الخليجي':
    'traditional round Gulf klejia cookies, golden-brown baked, sesame seeds on top, served on a decorative ceramic plate with a cup of gahwa Arabic coffee',
  'بيض بالبطاطا والبصل':
    'home-style Gulf eggs scrambled with golden fried potato cubes and caramelized onions, fresh parsley on top, in a dark non-stick skillet',
  'حبوب القمح بالتمر والحليب - بليلة':
    'traditional Gulf baleela, tender whole wheat berries bathed in warm fresh milk, topped with chopped Medjool dates, drizzled with ghee, cardamom aroma, ceramic bowl',
  // Soups
  'شوربة العدس الخليجية بالكمون':
    'deep orange Gulf red lentil soup in a ceramic bowl, drizzled with olive oil, crispy fried onion rings on top, fresh cilantro, lemon wedge on the side',
  'شوربة الدجاج بالشعيرية الخليجية':
    'Gulf chicken vermicelli soup, clear golden amber broth with thin noodles, shredded white chicken, floating herbs, steam rising from a deep bowl',
  'شوربة الجريش الخليجية':
    'hearty thick Gulf jareesh crushed wheat soup with meat pieces, creamy warm beige color, garnished with fried crispy onions, a swirl of ghee',
  'شوربة المرق باللحم والخضار':
    'clear rich Gulf lamb broth soup with colorful diced vegetables, carrot cubes, potato, zucchini, deep amber broth, fresh parsley, served in a terracotta bowl',
  'شوربة الفريك بالدجاج':
    'smoky freekeh green roasted wheat soup with tender shredded chicken, rich dark broth, toasted almond slivers and fresh parsley garnish',
  'شوربة الذرة الخليجية':
    'creamy Gulf corn chowder in a white bowl, bright golden yellow, swirl of fresh cream on top, chopped green onions and paprika dust',
  'شوربة البطاطا بالكريمة':
    'velvety silky cream of potato soup, smooth pale golden color in an elegant bowl, swirl of heavy cream, fresh parsley sprig, golden croutons',
  'شوربة الطماطم الخليجية بالهيل':
    'rich Gulf tomato cardamom soup, deep vibrant red-orange color, silky smooth, swirl of cream, fresh basil leaf floating, white ceramic bowl',
  'شوربة الكوسا بالحليب':
    'elegant smooth zucchini milk cream soup, pale jade-green color, swirl of cream, dried mint flakes sprinkled on top, white ceramic bowl on a linen cloth',
  'شوربة المرق الخليجي بالحمص':
    'hearty Gulf chickpea broth soup, golden amber broth, plump whole chickpeas, tender shredded meat, garnished with fresh cilantro leaves and a lemon wedge',
}

// ── Build full prompt ────────────────────────────────────────────────────────
function buildPrompt(recipe) {
  const specific  = DISH_PROMPTS[recipe.name]
  const catHint   = CAT_HINTS[recipe.category] || 'authentic Gulf Arabic food'
  const dishDesc  = specific || `${recipe.name}, ${catHint}`
  return `Professional food photography of ${dishDesc}. Authentic Gulf Arabic cuisine. Warm appetizing lighting, beautiful plating, high resolution, photorealistic, no text, no watermark, close up shot.`
}

// ── Gemini image generation ──────────────────────────────────────────────────
async function generateImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Gemini API ${res.status}: ${txt}`)
  }
  const data   = await res.json()
  const cparts = data?.candidates?.[0]?.content?.parts ?? []
  const inline = cparts.find(p => p.inlineData || p.inline_data)
  const img    = inline?.inlineData || inline?.inline_data
  if (!img?.data) throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 300)}`)
  return Buffer.from(img.data, 'base64')
}

// ── Convert to WebP ──────────────────────────────────────────────────────────
async function toWebP(inputBuf) {
  return sharp(inputBuf).webp({ quality: 82 }).toBuffer()
}

// ── Upload to Supabase Storage ───────────────────────────────────────────────
async function uploadToStorage(webpBuf, filename) {
  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(filename, webpBuf, {
      contentType: 'image/webp',
      upsert: true,
    })
  if (error) throw new Error(`Storage upload: ${error.message}`)
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filename)
  return data.publicUrl
}

// ── Sleep helper ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // STEP 1 — fetch recipes without images
  const { data: recipes, error } = await sb
    .from('recipes')
    .select('id, name, category')
    .eq('source', 'manual')
    .is('image_url', null)
    .order('category')

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  if (!recipes.length) { console.log('All manual recipes already have images!'); return }

  console.log(`\nFound ${recipes.length} manual recipes without images\n`)

  let generated = 0, uploaded = 0, updated = 0
  const errors  = []

  for (let i = 0; i < recipes.length; i++) {
    const recipe   = recipes[i]
    const label    = `[${i + 1}/${recipes.length}]`
    const filename = `manual-${recipe.id}.webp`
    const outPath  = path.join(OUT_DIR, filename)

    process.stdout.write(`${label} ${recipe.name} ... `)

    try {
      // STEP 2 — generate image
      const prompt   = buildPrompt(recipe)
      const rawBuf   = await generateImage(prompt)
      generated++

      // STEP 3 — convert to WebP and save locally
      const webpBuf  = await toWebP(rawBuf)
      fs.writeFileSync(outPath, webpBuf)

      // STEP 4 — upload to Supabase Storage
      const publicUrl = await uploadToStorage(webpBuf, filename)
      uploaded++

      // STEP 5 — update DB
      const { error: upErr } = await sb
        .from('recipes')
        .update({ image_url: publicUrl })
        .eq('id', recipe.id)
      if (upErr) throw new Error(`DB update: ${upErr.message}`)
      updated++

      console.log(`✅ uploaded → DB updated`)
    } catch (e) {
      console.log(`❌ ${e.message.slice(0, 120)}`)
      errors.push({ name: recipe.name, error: e.message })
    }

    // 2-second delay between requests
    if (i < recipes.length - 1) await sleep(2000)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total recipes processed: ${recipes.length}
Images generated:        ${generated}
Uploaded to Storage:     ${uploaded}
DB rows updated:         ${updated}
Errors:                  ${errors.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  if (errors.length) {
    console.log('\nFailed recipes:')
    errors.forEach(e => console.log(`  ✗ ${e.name}: ${e.error.slice(0, 100)}`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
