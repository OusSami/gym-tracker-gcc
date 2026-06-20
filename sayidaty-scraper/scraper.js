/**
 * Sayidaty Kitchen — طبخات خليجية Scraper v4
 * ─────────────────────────────────────────────
 * Run:    node scraper.js
 * Output: data/recipes.json  +  data/images/{recipe-name}.jpg
 */

const puppeteer = require('puppeteer-core');
const fetch     = require('node-fetch');
const fs        = require('fs');
const path      = require('path');

const BASE_URL   = 'https://kitchen.sayidaty.net';
const TAG_URL    = `${BASE_URL}/taxonomy/tag/%D8%B7%D8%A8%D8%AE%D8%A7%D8%AA-%D8%AE%D9%84%D9%8A%D8%AC%D9%8A%D8%A9`;
const IMAGES_DIR = path.join(__dirname, 'data', 'images');
const JSON_PATH  = path.join(__dirname, 'data', 'recipes.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function sanitizeFilename(name) {
  return name.trim()
    .replace(/\s+/g, '-')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 120);
}

async function downloadImage(imageUrl, recipeName) {
  if (!imageUrl) return null;
  try {
    const ext      = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = sanitizeFilename(recipeName) + ext;
    const dest     = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(dest)) return `data/images/${filename}`;
    const res = await fetch(imageUrl, { headers: { 'Referer': BASE_URL, 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(dest, await res.buffer());
    return `data/images/${filename}`;
  } catch { return null; }
}

// ─── Step 1: Collect all recipe URLs across all pages ─────────────────────────
async function getRecipeLinks(page) {
  const links = new Set();
  let pageNum = 0;

  while (true) {
    const url = pageNum === 0 ? TAG_URL : `${TAG_URL}?page=${pageNum}`;
    console.log(`📄 Listing page ${pageNum + 1}: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const { newLinks, maxPage } = await page.evaluate((baseUrl) => {
      const links = new Set();
      document.querySelectorAll('a[href*="/node/"]').forEach(el => {
        const href = el.getAttribute('href') || '';
        if (/\/node\/\d+\/.+/.test(href))
          links.add(href.startsWith('http') ? href : `${baseUrl}${href}`);
      });
      let maxPage = 0;
      document.querySelectorAll('a[href*="?page="]').forEach(el => {
        const m = (el.getAttribute('href') || '').match(/\?page=(\d+)/);
        if (m) maxPage = Math.max(maxPage, parseInt(m[1]));
      });
      return { newLinks: [...links], maxPage };
    }, BASE_URL);

    const before = links.size;
    newLinks.forEach(l => links.add(l));
    console.log(`   +${links.size - before} new (total: ${links.size}), max page: ${maxPage}`);

    if (pageNum >= maxPage) { console.log('   Reached last page.'); break; }
    pageNum++;
    if (pageNum > 50) break;
    await sleep(700);
  }

  return [...links];
}

// ─── Step 2: Scrape one recipe page ───────────────────────────────────────────
async function scrapeRecipe(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(600);

  return page.evaluate(() => {
    // Name
    const name = document.querySelector('h1')?.innerText?.trim() || '';

    // Image
    const imageUrl = document.querySelector('meta[property="og:image"]')?.content || '';

    // ── Ingredients ──
    // Container: <div class="ingredients-area"> → contains <li> items
    const ingredients = [];
    const ingredientsArea = document.querySelector('.ingredients-area');
    if (ingredientsArea) {
      ingredientsArea.querySelectorAll('li').forEach(li => {
        const t = li.innerText?.trim();
        if (t && t.length > 1) ingredients.push(t);
      });
      // Fallback: if no <li>, grab <p> tags
      if (ingredients.length === 0) {
        ingredientsArea.querySelectorAll('p').forEach(p => {
          const t = p.innerText?.trim();
          if (t && t.length > 1) {
            t.split('\n').forEach(line => {
              const clean = line.replace(/^[\s\-–•]+/, '').trim();
              if (clean.length > 1) ingredients.push(clean);
            });
          }
        });
      }
    }

    // ── Steps ──
    // Container: <div class="preparation-area"> → contains <li> items
    const steps = [];
    const prepArea = document.querySelector('.preparation-area');
    if (prepArea) {
      prepArea.querySelectorAll('li').forEach(li => {
        const t = li.innerText?.trim();
        if (t && t.length > 5) steps.push(t);
      });
      // Fallback: <p> tags
      if (steps.length === 0) {
        prepArea.querySelectorAll('p').forEach(p => {
          const t = p.innerText?.trim();
          if (t && t.length > 5) steps.push(t);
        });
      }
    }

    // Extra metadata while we're here
    const cookTime = document.querySelector('.recipe-meta-field .recipe-meta-data-info')?.innerText?.trim() || '';
    const servings = document.querySelectorAll('.recipe-meta-field .recipe-meta-data-info')[1]?.innerText?.trim() || '';

    return { name, imageUrl, ingredients, steps, cookTime, servings };
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log('🍳 Sayidaty — طبخات خليجية Scraper v4');
  console.log('=========================================\n');

  const browser = await puppeteer.launch({
    executablePath : CHROME_PATH,
    headless        : true,
    args            : ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ar'],
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  try {
    const links = await getRecipeLinks(page);
    console.log(`\n🔗 Total unique recipes: ${links.length}\n`);

    if (links.length === 0) {
      console.error('❌ No links found.');
      await browser.close(); process.exit(1);
    }

    // Resume support — DELETE data/recipes.json to start fresh
    let existing = [];
    if (fs.existsSync(JSON_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')).recipes || [];
        console.log(`♻️  Resuming — ${existing.length} already saved\n`);
      } catch {}
    }
    const doneUrls = new Set(existing.map(r => r.url));
    const recipes  = [...existing];
    const errors   = [];

    for (let i = 0; i < links.length; i++) {
      const url = links[i];

      if (doneUrls.has(url)) {
        console.log(`[${i+1}/${links.length}] ⏭  Already done`);
        continue;
      }

      const label = decodeURIComponent(url.split('/node/')[1]?.split('/')[1] || '').substring(0, 50);
      process.stdout.write(`[${i+1}/${links.length}] ${label}\n             `);

      try {
        const data      = await scrapeRecipe(page, url);
        process.stdout.write(`scraping ✓  image... `);
        const imagePath = await downloadImage(data.imageUrl, data.name);

        recipes.push({
          name        : data.name,
          url,
          image_url   : data.imageUrl,
          image_local : imagePath,
          cook_time   : data.cookTime,
          servings    : data.servings,
          ingredients : data.ingredients,
          steps       : data.steps,
        });

        console.log(`✅ (${data.ingredients.length} ingredients, ${data.steps.length} steps)`);

      } catch (err) {
        console.log(`❌ ${err.message}`);
        errors.push({ url, error: err.message });
      }

      fs.writeFileSync(JSON_PATH, JSON.stringify({
        scraped_at : new Date().toISOString(),
        source     : TAG_URL,
        total      : recipes.length,
        failed     : errors.length,
        recipes,
        errors,
      }, null, 2), 'utf8');

      await sleep(1000 + Math.random() * 400);
    }

    console.log('\n══════════════════════════════════════');
    console.log(`✅  ${recipes.length} recipes → data/recipes.json`);
    console.log(`🖼   Images → data/images/`);
    if (errors.length) console.log(`⚠️   ${errors.length} errors in recipes.json`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
