/**
 * Layalina Yummy — Recipe Scraper
 * ─────────────────────────────────
 * Scrapes a fixed list of URLs: name, image, ingredients, steps
 * Output: data/recipes.json + data/images/{recipe-name}.jpg
 *
 * Run:  npm install && node scraper.js
 */

const fetch   = require('node-fetch');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');
const URLS    = require('./urls');

const IMAGES_DIR = path.join(__dirname, 'data', 'images');
const JSON_PATH  = path.join(__dirname, 'data', 'recipes.json');

const HEADERS = {
  'User-Agent'      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language' : 'ar,en;q=0.9',
  'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer'         : 'https://yummy.layalina.com/',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function sanitizeFilename(name) {
  return name.trim()
    .replace(/\s+/g, '-')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 120);
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function downloadImage(imageUrl, recipeName) {
  if (!imageUrl) return null;
  try {
    const ext      = path.extname(new URL(imageUrl).pathname.split('?')[0]) || '.jpg';
    const filename = sanitizeFilename(recipeName) + ext;
    const dest     = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(dest)) return `data/images/${filename}`;
    const res = await fetch(imageUrl, { headers: { 'Referer': 'https://yummy.layalina.com/' } });
    if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
    fs.writeFileSync(dest, await res.buffer());
    return `data/images/${filename}`;
  } catch (e) {
    console.log(`     ⚠️  Image download failed: ${e.message}`);
    return null;
  }
}

async function scrapeRecipe(url) {
  const html = await fetchHtml(url);
  const $    = cheerio.load(html);

  // ── Name: from og:title (cleaner than h1 which may have site suffix) ──
  const rawName = $('meta[property="og:title"]').attr('content')?.trim()
               || $('h1').first().text().trim();

  // ── Hero image: og:image only (skip video thumbnails) ──
  // If the page has a video as primary content, og:image may be a video poster
  // We detect this by checking if there's a <video> tag or iframe before the image
  const ogImage  = $('meta[property="og:image"]').attr('content') || '';
  const hasVideo = $('video').length > 0 || $('iframe[src*="youtube"]').length > 0 || $('iframe[src*="vimeo"]').length > 0;
  const imageUrl = hasVideo && !ogImage ? null : ogImage;

  // ── Ingredients ──
  // Layalina uses structured sections — try multiple selectors
  const ingredients = [];

  const ingredientSelectors = [
    '.ingredients-section li',
    '.recipe-ingredients li',
    '[class*="ingredient"] li',
    '.field-name-field-ingredients li',
    // Generic: section containing مقادير/المكونات
  ];

  for (const sel of ingredientSelectors) {
    $(sel).each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length > 1) ingredients.push(t);
    });
    if (ingredients.length > 0) break;
  }

  // Fallback: find مقادير/المكونات heading then grab following list
  if (ingredients.length === 0) {
    $('h2, h3, h4, strong, b, span, div').each((_, el) => {
      const text = $(el).text().trim();
      if (!text.includes('المقادير') && !text.includes('مقادير') && !text.includes('المكونات')) return;
      // grab the next ul/ol sibling
      $(el).nextAll('ul, ol').first().find('li').each((_, li) => {
        const t = $(li).text().trim();
        if (t.length > 1) ingredients.push(t);
      });
      // or parent's following ul
      $(el).parent().nextAll('ul, ol').first().find('li').each((_, li) => {
        const t = $(li).text().trim();
        if (t.length > 1 && !ingredients.includes(t)) ingredients.push(t);
      });
    });
  }

  // ── Steps ──
  const steps = [];

  const stepSelectors = [
    '.steps-section li',
    '.recipe-steps li',
    '.recipe-steps p',
    '[class*="preparation"] li',
    '[class*="preparation"] p',
    '[class*="steps"] li',
    '.field-name-field-preparation li',
    '.field-name-field-preparation p',
  ];

  for (const sel of stepSelectors) {
    $(sel).each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 5) steps.push(t);
    });
    if (steps.length > 0) break;
  }

  // Fallback: طريقة التحضير heading
  if (steps.length === 0) {
    $('h2, h3, h4, strong, b, span, div').each((_, el) => {
      const text = $(el).text().trim();
      if (!text.includes('طريقة') && !text.includes('التحضير') && !text.includes('الطهي')) return;
      $(el).nextAll('ol, ul').first().find('li').each((_, li) => {
        const t = $(li).text().trim();
        if (t.length > 5) steps.push(t);
      });
      $(el).nextAll('p').each((_, p) => {
        const t = $(p).text().trim();
        if (t.length > 10 && !$(p).parents('nav,header,footer').length) steps.push(t);
      });
    });
  }

  // Extra: cook time & servings if available
  const cookTime = $('[class*="cook-time"], [class*="time"] .value, .recipe-time').first().text().trim() || '';
  const servings = $('[class*="servings"], [class*="yield"], .recipe-yield').first().text().trim() || '';

  return { rawName, imageUrl, hasVideo, ingredients, steps, cookTime, servings };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log('🍳 Layalina Yummy — Recipe Scraper');
  console.log('====================================\n');
  console.log(`📋 URLs to scrape: ${URLS.length}\n`);

  // Resume support
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

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];

    if (doneUrls.has(url)) {
      console.log(`[${i+1}/${URLS.length}] ⏭  Already done`);
      continue;
    }

    const slug = decodeURIComponent(url.split('/').pop().replace('.html', '')).substring(0, 50);
    process.stdout.write(`[${i+1}/${URLS.length}] ${slug}\n             `);

    try {
      const data = await scrapeRecipe(url);

      // Download hero image
      process.stdout.write(`scraping ✓  image... `);
      const imagePath = data.imageUrl ? await downloadImage(data.imageUrl, data.rawName) : null;

      if (data.hasVideo && !data.imageUrl) {
        console.log(`⏭  Skipped image (video-only page)`);
      }

      recipes.push({
        name        : data.rawName,   // raw — will be cleaned by AI later
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

    // Save after every recipe
    fs.writeFileSync(JSON_PATH, JSON.stringify({
      scraped_at : new Date().toISOString(),
      source     : 'https://yummy.layalina.com',
      total      : recipes.length,
      failed     : errors.length,
      recipes,
      errors,
    }, null, 2), 'utf8');

    await sleep(1000 + Math.random() * 500);
  }

  console.log('\n══════════════════════════════════════');
  console.log(`✅  ${recipes.length} recipes → data/recipes.json`);
  console.log(`🖼   Images → data/images/`);
  console.log(`⚠️   ${errors.length} errors`);
  console.log(`\n📝 Next step: run clean_titles.js to fix recipe names with AI`);
}

main().catch(console.error);
