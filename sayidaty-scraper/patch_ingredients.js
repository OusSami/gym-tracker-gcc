/**
 * Ingredient Patcher
 * ──────────────────
 * Reads existing recipes.json, finds recipes with 0 ingredients,
 * re-scrapes ONLY those, and patches the JSON in place.
 *
 * Run: node patch_ingredients.js
 */

const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

const JSON_PATH   = path.join(__dirname, 'data', 'recipes.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function scrapeIngredients(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(800);

  return page.evaluate(() => {
    const ingredients = [];

    // Strategy 1: .ingredients-area li (confirmed from debug)
    const area = document.querySelector('.ingredients-area');
    if (area) {
      area.querySelectorAll('li').forEach(li => {
        const t = li.innerText?.trim();
        if (t && t.length > 1) ingredients.push(t);
      });

      // Strategy 2: maybe they're in <p> inside .ingredients-area
      if (ingredients.length === 0) {
        area.querySelectorAll('p').forEach(p => {
          const t = p.innerText?.trim();
          if (t && t.length > 1) {
            t.split('\n').forEach(line => {
              const clean = line.replace(/^[\s\-–•]+/, '').trim();
              if (clean.length > 1) ingredients.push(clean);
            });
          }
        });
      }

      // Strategy 3: raw text of .ingredients-area, split by newline
      if (ingredients.length === 0) {
        const raw = area.innerText?.trim() || '';
        raw.split('\n').forEach(line => {
          const clean = line.replace(/^[\s\-–•]+/, '').trim();
          // Skip the section heading itself
          if (clean.length > 1 && !clean.includes('مقادير')) {
            ingredients.push(clean);
          }
        });
      }
    }

    // DEBUG: also return what .ingredients-area contains
    const areaHTML = area ? area.innerHTML.substring(0, 500) : 'NOT FOUND';
    const areaText = area ? area.innerText?.trim().substring(0, 300) : 'NOT FOUND';

    return { ingredients, areaHTML, areaText };
  });
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error('❌ data/recipes.json not found. Run scraper.js first.');
    process.exit(1);
  }

  const data    = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const missing = data.recipes.filter(r => r.ingredients.length === 0 && r.steps.length > 0);
  const skipped = data.recipes.filter(r => r.ingredients.length === 0 && r.steps.length === 0);

  console.log(`📊 Total recipes: ${data.recipes.length}`);
  console.log(`✅ With ingredients: ${data.recipes.filter(r => r.ingredients.length > 0).length}`);
  console.log(`🔧 Missing ingredients (has steps): ${missing.length}`);
  console.log(`⏭  Skipping (0 ingredients + 0 steps = listicles): ${skipped.length}\n`);

  if (missing.length === 0) {
    console.log('🎉 Nothing to patch!');
    return;
  }

  const browser = await puppeteer.launch({
    executablePath : CHROME_PATH,
    headless        : true,
    args            : ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ar'],
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  let patched = 0;
  let stillEmpty = 0;

  for (let i = 0; i < missing.length; i++) {
    const recipe = missing[i];
    process.stdout.write(`[${i+1}/${missing.length}] ${recipe.name.substring(0, 50)}\n             `);

    try {
      const result = await scrapeIngredients(page, recipe.url);

      if (result.ingredients.length > 0) {
        // Find and update in the main array
        const idx = data.recipes.findIndex(r => r.url === recipe.url);
        if (idx > -1) data.recipes[idx].ingredients = result.ingredients;
        patched++;
        console.log(`✅ Found ${result.ingredients.length} ingredients`);
      } else {
        stillEmpty++;
        console.log(`⚠️  Still 0 — area content: "${result.areaText.substring(0, 100)}"`);
        if (result.areaHTML === 'NOT FOUND') {
          console.log(`   → .ingredients-area NOT IN DOM`);
        } else {
          console.log(`   → HTML: ${result.areaHTML.substring(0, 150)}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }

    // Save after each patch
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
    await sleep(900 + Math.random() * 400);
  }

  await browser.close();

  console.log('\n══════════════════════════════════════');
  console.log(`✅ Patched: ${patched} recipes`);
  console.log(`⚠️  Still empty: ${stillEmpty} recipes`);
  console.log(`💾 Saved to data/recipes.json`);
}

main().catch(console.error);
