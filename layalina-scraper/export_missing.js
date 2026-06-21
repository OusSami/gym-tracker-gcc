/**
 * Exports recipes with missing ingredients or steps to a separate JSON
 * Run: node export_missing.js
 */
const fs   = require('fs');
const path = require('path');

const JSON_PATH    = path.join(__dirname, 'data', 'recipes.json');
const MISSING_PATH = path.join(__dirname, 'data', 'missing.json');

const data    = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const recipes = data.recipes;

const missingIngredients = recipes.filter(r => r.ingredients.length === 0);
const missingSteps       = recipes.filter(r => r.steps.length === 0);
const missingBoth        = recipes.filter(r => r.ingredients.length === 0 && r.steps.length === 0);
const complete           = recipes.filter(r => r.ingredients.length > 0 && r.steps.length > 0);

const missing = {
  generated_at       : new Date().toISOString(),
  summary: {
    total            : recipes.length,
    complete         : complete.length,
    missing_ingredients : missingIngredients.length,
    missing_steps    : missingSteps.length,
    missing_both     : missingBoth.length,
  },
  missing_ingredients: missingIngredients.map(r => ({ name: r.name, url: r.url, steps: r.steps.length })),
  missing_steps      : missingSteps.map(r => ({ name: r.name, url: r.url, ingredients: r.ingredients.length })),
};

fs.writeFileSync(MISSING_PATH, JSON.stringify(missing, null, 2), 'utf8');

console.log('📊 Summary:');
console.log(`   Total recipes    : ${recipes.length}`);
console.log(`   ✅ Complete       : ${complete.length}`);
console.log(`   ❌ No ingredients : ${missingIngredients.length}`);
console.log(`   ❌ No steps       : ${missingSteps.length}`);
console.log(`   ❌ Both missing   : ${missingBoth.length}`);
console.log(`\n💾 Saved to data/missing.json`);

console.log('\n--- Missing INGREDIENTS ---');
missingIngredients.forEach(r => console.log(`  • ${r.name}\n    ${r.url}`));

console.log('\n--- Missing STEPS ---');
missingSteps.forEach(r => console.log(`  • ${r.name}\n    ${r.url}`));
