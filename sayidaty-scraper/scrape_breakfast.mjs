#!/usr/bin/env node
/**
 * scrape_breakfast.mjs
 * Scrapes all URLs in sayidaty-scraper/breakfast_urls.txt
 * Output: data/new_batch_recipes.json  +  data/new_batch_images/
 *
 * Resume-safe: skips URLs already in the output JSON.
 * Usage: node scrape_breakfast.mjs
 */

import puppeteer from 'puppeteer-core'
import fs        from 'node:fs'
import path      from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const CHROME     = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE_URL   = 'https://kitchen.sayidaty.net'
const URLS_FILE  = path.join(__dirname, 'breakfast_urls.txt')
const IMAGES_DIR = path.join(__dirname, 'data', 'new_batch_images')
const JSON_PATH  = path.join(__dirname, 'data', 'new_batch_recipes.json')

fs.mkdirSync(IMAGES_DIR, { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))

function sanitizeFilename(name) {
  return name.trim()
    .replace(/\s+/g, '-')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 120)
}

async function downloadImage(imageUrl, recipeName) {
  if (!imageUrl) return null
  try {
    const ext      = path.extname(new URL(imageUrl).pathname) || '.jpg'
    const filename = sanitizeFilename(recipeName) + ext
    const dest     = path.join(IMAGES_DIR, filename)
    if (fs.existsSync(dest)) return `data/new_batch_images/${filename}`
    const res = await fetch(imageUrl, {
      headers: { 'Referer': BASE_URL, 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(dest, buf)
    return `data/new_batch_images/${filename}`
  } catch { return null }
}

async function scrapeRecipe(browser, url) {
  // Fresh page per recipe — prevents detached-frame cascade failures
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' })
  await page.setViewport({ width: 1280, height: 900 })

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await sleep(600)

    return await page.evaluate(() => {
      const name     = document.querySelector('h1')?.innerText?.trim() || ''
      const imageUrl = document.querySelector('meta[property="og:image"]')?.content || ''

      // ── Ingredients ───────────────────────────────────────────────────────
      // Supports three layouts used across Sayidaty pages:
      //   1. .ingredients-area  li  (step-by-step pages)
      //   2. .ingredients-area  p   (alternate layout)
      //   3. .ingredients-area  BR-separated plaintext (وصفات pages)
      const ingredients = []
      const ingArea = document.querySelector('.ingredients-area')
      if (ingArea) {
        // Layout 1: <li> items
        ingArea.querySelectorAll('li').forEach(li => {
          const t = li.innerText?.trim()
          if (t && t.length > 1) ingredients.push(t)
        })
        // Layout 2: <p> items
        if (ingredients.length === 0) {
          ingArea.querySelectorAll('p').forEach(p => {
            const t = p.innerText?.trim()
            if (t && t.length > 1) {
              t.split('\n').forEach(line => {
                const clean = line.replace(/^[\s\-–•]+/, '').trim()
                if (clean.length > 1) ingredients.push(clean)
              })
            }
          })
        }
        // Layout 3: plain innerText with BR separators (most وصفات pages)
        if (ingredients.length === 0) {
          const raw = ingArea.innerText || ''
          raw.split('\n').forEach(line => {
            const clean = line.replace(/^[\s\-–•]+/, '').trim()
            if (clean.length > 2 && !clean.startsWith('مقادير')) ingredients.push(clean)
          })
        }
      }

      // ── Steps ─────────────────────────────────────────────────────────────
      const steps = []
      const prepArea = document.querySelector('.preparation-area')
      if (prepArea) {
        prepArea.querySelectorAll('li').forEach(li => {
          const t = li.innerText?.trim()
          if (t && t.length > 5) steps.push(t)
        })
        if (steps.length === 0) {
          prepArea.querySelectorAll('p').forEach(p => {
            const t = p.innerText?.trim()
            if (t && t.length > 5) steps.push(t)
          })
        }
        if (steps.length === 0) {
          const raw = prepArea.innerText || ''
          raw.split('\n').forEach(line => {
            const clean = line.replace(/^[\d\.\-–•]+\s*/, '').trim()
            if (clean.length > 10) steps.push(clean)
          })
        }
      }

      const metaFields = document.querySelectorAll('.recipe-meta-field .recipe-meta-data-info')
      const cookTime   = metaFields[0]?.innerText?.trim() || ''
      const servings   = metaFields[1]?.innerText?.trim() || ''

      return { name, imageUrl, ingredients, steps, cookTime, servings }
    })
  } finally {
    await page.close().catch(() => {})
  }
}

async function main() {
  // Read URL list (skip blank lines)
  const urls = fs.readFileSync(URLS_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('http'))

  console.log(`\n🍳  Sayidaty Breakfast Scraper`)
  console.log(`📋  URLs to process: ${urls.length}`)
  console.log(`📂  Images → ${IMAGES_DIR}\n`)

  // Resume support: load existing data
  let data = { scraped_at: new Date().toISOString(), total: 0, failed: 0, recipes: [], errors: [] }
  if (fs.existsSync(JSON_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
      console.log(`♻️   Resuming — ${data.recipes.length} already scraped\n`)
    } catch {}
  }
  const doneUrls = new Set(data.recipes.map(r => r.url))

  const toScrape = urls.filter(u => !doneUrls.has(u))
  console.log(`✅  Already done: ${urls.length - toScrape.length}`)
  console.log(`🔧  To scrape:    ${toScrape.length}\n`)

  if (toScrape.length === 0) {
    console.log('All URLs already scraped!')
    return
  }

  let browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ar'],
  })

  let succeeded = 0, failed = 0

  try {
    for (let i = 0; i < toScrape.length; i++) {
      const url    = toScrape[i]
      const label  = decodeURIComponent(url.split('/node/')[1]?.split('/')[1] || '').substring(0, 45)
      const global = i + 1 + (urls.length - toScrape.length)

      process.stdout.write(`[${global}/${urls.length}] ${label}\n             `)

      // Restart browser every 80 recipes to prevent memory/frame issues
      if (i > 0 && i % 80 === 0) {
        await browser.close().catch(() => {})
        browser = await puppeteer.launch({
          executablePath: CHROME,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ar'],
        })
        console.log('  🔄 Browser restarted')
      }

      try {
        const recipe    = await scrapeRecipe(browser, url)
        process.stdout.write(`✓ scraped  image... `)
        const imagePath = await downloadImage(recipe.imageUrl, recipe.name)

        data.recipes.push({
          name:        recipe.name,
          url,
          image_url:   recipe.imageUrl,
          image_local: imagePath,
          cook_time:   recipe.cookTime,
          servings:    recipe.servings,
          ingredients: recipe.ingredients,
          steps:       recipe.steps,
        })
        succeeded++
        console.log(`✅  (${recipe.ingredients.length} ing, ${recipe.steps.length} steps)`)
      } catch (err) {
        console.log(`❌  ${err.message}`)
        data.errors.push({ url, error: err.message })
        failed++
      }

      // Persist after every recipe
      data.total  = data.recipes.length
      data.failed = data.errors.length
      data.scraped_at = new Date().toISOString()
      fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8')

      if (i < toScrape.length - 1) await sleep(1800 + Math.random() * 600)
    }
  } finally {
    await browser.close().catch(() => {})
  }

  console.log('\n═══════════════════════════════════════')
  console.log(`✅  Total recipes: ${data.recipes.length} → ${JSON_PATH}`)
  console.log(`🖼   Images       → ${IMAGES_DIR}`)
  console.log(`✓   This run:    ${succeeded} scraped`)
  console.log(`❌  This run:    ${failed} failed`)
  if (data.errors.length) {
    console.log(`\n⚠️   Errors:`)
    data.errors.slice(-5).forEach(e => console.log(`  ${e.url.slice(-60)}: ${e.error}`))
  }
  console.log()
}

main().catch(console.error)
