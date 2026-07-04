/**
 * Patch New Batch — fixes ingredients & steps for the 59 new خطوة بخطوة recipes
 * Selectors discovered from debug:
 *   Ingredients: .ing-group li
 *   Steps:       .recipe-step-caption (inside .recipe-steps-holder)
 *
 * Run: node patch_new_batch.js
 */

const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

const JSON_PATH   = path.join(__dirname, 'data', 'recipes.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The new batch URLs we just scraped
const NEW_BATCH_URLS = new Set([
  'https://kitchen.sayidaty.net/node/15877',
  'https://kitchen.sayidaty.net/node/15848',
  'https://kitchen.sayidaty.net/node/15632',
  'https://kitchen.sayidaty.net/node/15381',
  'https://kitchen.sayidaty.net/node/15322',
  'https://kitchen.sayidaty.net/node/14094',
  'https://kitchen.sayidaty.net/node/13916',
  'https://kitchen.sayidaty.net/node/13858',
  'https://kitchen.sayidaty.net/node/13607',
  'https://kitchen.sayidaty.net/node/13464',
  'https://kitchen.sayidaty.net/node/13068',
  'https://kitchen.sayidaty.net/node/12769',
  'https://kitchen.sayidaty.net/node/12676',
  'https://kitchen.sayidaty.net/node/12568',
  'https://kitchen.sayidaty.net/node/12468',
  'https://kitchen.sayidaty.net/node/12281',
  'https://kitchen.sayidaty.net/node/10860',
  'https://kitchen.sayidaty.net/node/10580',
  'https://kitchen.sayidaty.net/node/10335',
  'https://kitchen.sayidaty.net/node/10214',
  'https://kitchen.sayidaty.net/node/9702',
  'https://kitchen.sayidaty.net/node/8395',
  'https://kitchen.sayidaty.net/node/8302',
  'https://kitchen.sayidaty.net/node/8245',
  'https://kitchen.sayidaty.net/node/8232',
  'https://kitchen.sayidaty.net/node/8179',
  'https://kitchen.sayidaty.net/node/3039',
  'https://kitchen.sayidaty.net/node/7867',
  'https://kitchen.sayidaty.net/node/7798',
  'https://kitchen.sayidaty.net/node/7846',
  'https://kitchen.sayidaty.net/node/6931',
  'https://kitchen.sayidaty.net/node/2563',
  'https://kitchen.sayidaty.net/node/6695',
  'https://kitchen.sayidaty.net/node/6730',
  'https://kitchen.sayidaty.net/node/6661',
  'https://kitchen.sayidaty.net/node/6531',
  'https://kitchen.sayidaty.net/node/6372',
  'https://kitchen.sayidaty.net/node/3902',
  'https://kitchen.sayidaty.net/node/3852',
  'https://kitchen.sayidaty.net/node/3886',
  'https://kitchen.sayidaty.net/node/3846',
  'https://kitchen.sayidaty.net/node/3821',
  'https://kitchen.sayidaty.net/node/3798',
  'https://kitchen.sayidaty.net/node/3719',
  'https://kitchen.sayidaty.net/node/845',
  'https://kitchen.sayidaty.net/node/3712',
  'https://kitchen.sayidaty.net/node/2454',
  'https://kitchen.sayidaty.net/node/2449',
  'https://kitchen.sayidaty.net/node/901',
  'https://kitchen.sayidaty.net/node/2386',
  'https://kitchen.sayidaty.net/node/2344',
  'https://kitchen.sayidaty.net/node/2335',
  'https://kitchen.sayidaty.net/node/1397',
  'https://kitchen.sayidaty.net/node/98',
  'https://kitchen.sayidaty.net/node/100',
  'https://kitchen.sayidaty.net/node/107',
  'https://kitchen.sayidaty.net/node/427',
  'https://kitchen.sayidaty.net/node/512',
  'https://kitchen.sayidaty.net/node/673',
]);

function getNodeId(url) {
  const m = url.match(/\/node\/(\d+)/);
  return m ? `https://kitchen.sayidaty.net/node/${m[1]}` : null;
}

async function scrape(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(800);

  return page.evaluate(() => {
    // ── Ingredients: .ing-group li ──
    const ingredients = [];
    document.querySelectorAll('.ing-group li').forEach(li => {
      const t = li.innerText?.trim();
      if (t && t.length > 1) ingredients.push(t);
    });

    // Also grab section headers like "للعجينة" / "للحشوة"
    // These are text nodes directly inside .ingredients-area before each .ing-group
    // We'll reconstruct with section labels for context
    const ingredientsWithSections = [];
    document.querySelector('.ingredients-area')?.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent?.trim().replace(/^-\s*/, '');
        if (t && t.length > 1) ingredientsWithSections.push(`[${t}]`);
      } else if (node.tagName === 'UL' || node.classList?.contains('ing-group')) {
        node.querySelectorAll('li').forEach(li => {
          const t = li.innerText?.trim();
          if (t && t.length > 1) ingredientsWithSections.push(t);
        });
      }
    });

    const finalIngredients = ingredientsWithSections.length > 0 ? ingredientsWithSections : ingredients;

    // ── Steps: .recipe-step-caption inside .recipe-steps-holder ──
    // The slider has duplicated slides (slick clones) — only take non-clone slides
    const steps = [];
    const seen  = new Set();
    document.querySelectorAll('.recipe-steps-holder .recipe-step:not(.slick-cloned) .recipe-step-caption').forEach(el => {
      const t = el.innerText?.trim();
      if (t && t.length > 3 && !seen.has(t)) {
        seen.add(t);
        steps.push(t);
      }
    });

    // Fallback: all .recipe-step-caption if no steps found
    if (steps.length === 0) {
      document.querySelectorAll('.recipe-step-caption').forEach(el => {
        const t = el.innerText?.trim();
        if (t && t.length > 3 && !seen.has(t)) {
          seen.add(t);
          steps.push(t);
        }
      });
    }

    return { ingredients: finalIngredients, steps };
  });
}

async function main() {
  const data    = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const recipes = data.recipes;

  // Only patch recipes from the new batch that have 0 steps
  const toFix = recipes.filter(r => {
    const nodeId = getNodeId(r.url);
    return nodeId && NEW_BATCH_URLS.has(nodeId) && r.steps.length === 0;
  });

  console.log(`📊 Total recipes: ${recipes.length}`);
  console.log(`🔧 New batch recipes to patch: ${toFix.length}\n`);

  if (toFix.length === 0) { console.log('✅ Nothing to patch!'); return; }

  const browser = await puppeteer.launch({
    executablePath : CHROME_PATH,
    headless        : true,
    args            : ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ar'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  let patched = 0;
  let failed  = 0;

  try {
    for (let i = 0; i < toFix.length; i++) {
      const recipe = toFix[i];
      process.stdout.write(`[${i+1}/${toFix.length}] ${recipe.name.substring(0, 50)}\n             `);

      try {
        const { ingredients, steps } = await scrape(page, recipe.url);
        const idx = recipes.findIndex(r => r.url === recipe.url);
        if (idx > -1) {
          if (ingredients.length > 0) recipes[idx].ingredients = ingredients;
          recipes[idx].steps = steps;
        }
        console.log(`✅ (${ingredients.length} ingredients, ${steps.length} steps)`);
        patched++;
      } catch (err) {
        console.log(`❌ ${err.message}`);
        failed++;
      }

      fs.writeFileSync(JSON_PATH, JSON.stringify({ ...data, recipes }, null, 2), 'utf8');
      await sleep(900 + Math.random() * 400);
    }
  } finally {
    await browser.close();
  }

  console.log('\n══════════════════════════════════════');
  console.log(`✅ Patched: ${patched}`);
  console.log(`❌ Failed:  ${failed}`);

  const complete = recipes.filter(r => r.ingredients.length > 0 && r.steps.length > 0).length;
  console.log(`\n📊 Complete recipes now: ${complete} / ${recipes.length}`);
}

main().catch(console.error);
