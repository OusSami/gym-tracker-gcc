#!/usr/bin/env node
/**
 * rescrape_empty.mjs
 * Re-scrape 24 layalina recipes that have empty ingredients and/or steps.
 * Uses the same HTML selectors as scraper.js.
 *
 * Run from gymapp/ directory:
 *   node layalina-scraper/rescrape_empty.mjs
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const fetch   = require('node-fetch')
const cheerio = require('cheerio')

const { createClient } = await import('@supabase/supabase-js')

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'
const supabase = createClient(SB_URL, SB_KEY)

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ar,en;q=0.9',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer'        : 'https://yummy.layalina.com/',
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Load URL map from raw recipes.json ───────────────────────────────────────
const rawJson   = JSON.parse(readFileSync(path.join(__dirname, 'data', 'recipes.json'), 'utf8'))
const urlByName = {}
for (const r of rawJson.recipes) {
  if (r.name && r.url) urlByName[r.name] = r.url
}

// ── Fetch empty recipes from Supabase ────────────────────────────────────────
const { data: allRecipes, error: fetchErr } = await supabase
  .from('recipes')
  .select('id, name, ingredients, steps')

if (fetchErr) { console.error('❌ Fetch error:', fetchErr.message); process.exit(1) }

const emptyRecipes = allRecipes.filter(r => {
  const noIng   = !r.ingredients || r.ingredients.length === 0
  const noSteps = !r.steps       || r.steps.length === 0
  return noIng || noSteps
})

console.log(`\n🍳  Rescrape empty layalina recipes`)
console.log(`====================================`)
console.log(`Found ${emptyRecipes.length} recipes needing re-scrape\n`)

// ── Scrape a single recipe URL ────────────────────────────────────────────────
async function scrapeRecipe(url) {
  const res = await fetch(url, { headers: HEADERS, timeout: 30000 })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = res.text ? await res.text() : ''
  const $    = cheerio.load(html)

  // ── Ingredients ──
  const ingredients = []
  const ingredientSelectors = [
    '.ingredients-section li',
    '.recipe-ingredients li',
    '[class*="ingredient"] li',
    '.field-name-field-ingredients li',
  ]
  for (const sel of ingredientSelectors) {
    $(sel).each((_, el) => {
      const t = $(el).text().trim()
      if (t && t.length > 1) ingredients.push(t)
    })
    if (ingredients.length > 0) break
  }

  // Fallback: find المقادير/المكونات heading
  if (ingredients.length === 0) {
    $('h2, h3, h4, strong, b, span, div').each((_, el) => {
      const text = $(el).text().trim()
      if (!text.includes('المقادير') && !text.includes('مقادير') && !text.includes('المكونات')) return
      $(el).nextAll('ul, ol').first().find('li').each((_, li) => {
        const t = $(li).text().trim()
        if (t.length > 1) ingredients.push(t)
      })
      $(el).parent().nextAll('ul, ol').first().find('li').each((_, li) => {
        const t = $(li).text().trim()
        if (t.length > 1 && !ingredients.includes(t)) ingredients.push(t)
      })
    })
  }

  // ── Steps ──
  const steps = []
  const stepSelectors = [
    '.list_methodList li',    // layalina yummy new structure
    '.steps-section li',
    '.recipe-steps li',
    '.recipe-steps p',
    '[class*="preparation"] li',
    '[class*="preparation"] p',
    '[class*="steps"] li',
    '.field-name-field-preparation li',
    '.field-name-field-preparation p',
  ]
  for (const sel of stepSelectors) {
    $(sel).each((_, el) => {
      const t = $(el).text().trim()
      if (t.length > 5) steps.push(t)
    })
    if (steps.length > 0) break
  }

  // Fallback: طريقة التحضير heading
  if (steps.length === 0) {
    $('h2, h3, h4, strong, b, span, div').each((_, el) => {
      const text = $(el).text().trim()
      if (!text.includes('طريقة') && !text.includes('التحضير') && !text.includes('الطهي')) return
      $(el).nextAll('ol, ul').first().find('li').each((_, li) => {
        const t = $(li).text().trim()
        if (t.length > 5) steps.push(t)
      })
      $(el).nextAll('p').each((_, p) => {
        const t = $(p).text().trim()
        if (t.length > 10 && !$(p).parents('nav,header,footer').length) steps.push(t)
      })
    })
  }

  return { ingredients, steps }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let updated = 0, noUrl = 0, failed = 0, noData = 0

for (let i = 0; i < emptyRecipes.length; i++) {
  const recipe = emptyRecipes[i]
  const noIng   = !recipe.ingredients || recipe.ingredients.length === 0
  const noSteps = !recipe.steps       || recipe.steps.length === 0

  const url = urlByName[recipe.name]
  const label = `[${i+1}/${emptyRecipes.length}] "${recipe.name.slice(0, 50)}"`

  if (!url) {
    console.log(`${label}`)
    console.log(`  ⚠️  No URL found in recipes.json — skipping`)
    noUrl++
    continue
  }

  console.log(`${label}`)
  console.log(`  URL: ${url}`)
  console.log(`  Needs: ${noIng ? 'ingredients' : ''}${noIng && noSteps ? '+' : ''}${noSteps ? 'steps' : ''}`)

  try {
    const { ingredients, steps } = await scrapeRecipe(url)
    console.log(`  Scraped: ${ingredients.length} ingredients, ${steps.length} steps`)

    // Build update payload — only update fields that are empty in DB
    const update = {}
    if (noIng   && ingredients.length > 0) update.ingredients = ingredients
    if (noSteps && steps.length > 0)       update.steps       = steps

    if (Object.keys(update).length === 0) {
      console.log(`  ⚠️  Scraper returned no data for missing fields — page may have changed`)
      noData++
      await sleep(1500 + Math.random() * 500)
      continue
    }

    const { error: upErr } = await supabase
      .from('recipes')
      .update(update)
      .eq('id', recipe.id)

    if (upErr) {
      console.log(`  ❌ Update failed: ${upErr.message}`)
      failed++
    } else {
      const parts = []
      if (update.ingredients) parts.push(`${update.ingredients.length} ingredients`)
      if (update.steps)       parts.push(`${update.steps.length} steps`)
      console.log(`  ✅ Updated: ${parts.join(', ')}`)
      updated++
    }
  } catch (err) {
    console.log(`  ❌ Scrape error: ${err.message}`)
    failed++
  }

  await sleep(1200 + Math.random() * 600)
  console.log()
}

console.log(`\n══════════════════════════════════`)
console.log(`✅  Updated:      ${updated}`)
console.log(`⚠️   No data:     ${noData}  (page structure changed)`)
console.log(`❌  Failed:       ${failed}  (network/HTTP error)`)
console.log(`⏭   No URL:      ${noUrl}  (not in recipes.json)`)
console.log(`📋  Total:        ${emptyRecipes.length}`)
