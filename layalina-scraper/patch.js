/**
 * Layalina Patch v2 — correct selectors from debug
 * Ingredients: .recipe_ingredient_wrapper dd
 * Steps:       .recipe_method_wrapper .recipeDescription
 */

const fetch   = require('node-fetch');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

const JSON_PATH = path.join(__dirname, 'data', 'recipes.json');

const HEADERS = {
  'User-Agent'      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language' : 'ar,en;q=0.9',
  'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer'         : 'https://yummy.layalina.com/',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function scrapeRecipeData(url) {
  const res  = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $    = cheerio.load(html);

  // ── Ingredients: <dd> inside .recipe_ingredient_wrapper ──
  const ingredients = [];
  $('.recipe_ingredient_wrapper dd').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 1) ingredients.push(t);
  });

  // ── Steps: .recipeDescription inside .recipe_method_wrapper ──
  const steps = [];
  $('.recipe_method_wrapper .recipeDescription').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 5) steps.push(t);
  });

  // Extra metadata
  const cookTime = $('.recipe_ingredient_wrapper .fa-clock').parent().text().trim() || '';
  const servings = $('.recipe_ingredient_wrapper .fa-user-friends').parent().text().trim() || '';
  const calories = $('.recipe_ingredient_wrapper .fa-chart-pie').parent().text().trim() || '';

  return { ingredients, steps, cookTime, servings, calories };
}

async function main() {
  const data    = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const recipes = data.recipes;

  // Patch all — ingredients were wrong for everyone
  const toFix = recipes.filter(r => r.url); // all valid recipes

  console.log(`📊 Total recipes: ${recipes.length}`);
  console.log(`🔧 Re-patching all with correct selectors: ${toFix.length}\n`);

  let patched = 0;
  let failed  = 0;

  for (let i = 0; i < toFix.length; i++) {
    const recipe = toFix[i];
    process.stdout.write(`[${i+1}/${toFix.length}] ${recipe.name.substring(0, 50)}\n             `);

    try {
      const { ingredients, steps, cookTime, servings, calories } = await scrapeRecipeData(recipe.url);

      const idx = recipes.findIndex(r => r.url === recipe.url);
      if (idx > -1) {
        recipes[idx].ingredients = ingredients;
        recipes[idx].steps       = steps;
        if (cookTime) recipes[idx].cook_time = cookTime;
        if (servings) recipes[idx].servings  = servings;
        if (calories) recipes[idx].calories  = calories;
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

  console.log('\n══════════════════════════════════════');
  console.log(`✅ Patched: ${patched}`);
  console.log(`❌ Failed:  ${failed}`);

  const withBoth = recipes.filter(r => r.ingredients.length > 0 && r.steps.length > 0).length;
  const noIngr   = recipes.filter(r => r.ingredients.length === 0).length;
  const noSteps  = recipes.filter(r => r.steps.length === 0).length;
  console.log(`\n📊 Final:`);
  console.log(`   Complete (ingredients + steps): ${withBoth}`);
  console.log(`   Missing ingredients: ${noIngr}`);
  console.log(`   Missing steps: ${noSteps}`);
}

main().catch(console.error);
