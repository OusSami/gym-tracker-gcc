/**
 * Patches the single remaining recipe with 0 ingredients
 * using raw text parsing instead of <li> selectors
 */

const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

const JSON_PATH   = path.join(__dirname, 'data', 'recipes.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const data    = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const missing = data.recipes.filter(r => r.ingredients.length === 0 && r.steps.length > 0);
  
  console.log(`🔧 Recipes still missing ingredients: ${missing.length}`);
  missing.forEach(r => console.log(`   - ${r.name}: ${r.url}`));

  if (missing.length === 0) { console.log('🎉 All done!'); return; }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--lang=ar'],
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  for (const recipe of missing) {
    console.log(`\n→ Patching: ${recipe.name}`);
    await page.goto(recipe.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);

    const ingredients = await page.evaluate(() => {
      const area = document.querySelector('.ingredients-area');
      if (!area) return [];

      const results = [];

      // Strategy: parse raw innerText, split by newline, clean each line
      const raw = area.innerText || '';
      raw.split('\n').forEach(line => {
        const clean = line.replace(/^[\s\-–•\u200f\u200e]+/, '').trim();
        if (clean.length > 1 && !clean.includes('مقادير')) {
          results.push(clean);
        }
      });

      return results;
    });

    console.log(`   Found ${ingredients.length} ingredients:`);
    ingredients.forEach(i => console.log(`     • ${i}`));

    if (ingredients.length > 0) {
      const idx = data.recipes.findIndex(r => r.url === recipe.url);
      if (idx > -1) data.recipes[idx].ingredients = ingredients;
      fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
      console.log(`   ✅ Saved!`);
    } else {
      console.log(`   ❌ Still empty after text parsing`);
    }

    await sleep(800);
  }

  await browser.close();
  console.log('\n✅ Done');
}

main().catch(console.error);
