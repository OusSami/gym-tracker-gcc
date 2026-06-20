/**
 * Cleanup Listicles
 * ─────────────────
 * Removes recipes with 0 ingredients AND 0 steps from recipes.json
 * and deletes their images from data/images/
 *
 * Run: node cleanup_listicles.js
 */

const fs   = require('fs');
const path = require('path');

const JSON_PATH  = path.join(__dirname, 'data', 'recipes.json');
const IMAGES_DIR = path.join(__dirname, 'data', 'images');

const data      = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const before    = data.recipes.length;

const listicles = data.recipes.filter(r => r.ingredients.length === 0 && r.steps.length === 0);
const clean     = data.recipes.filter(r => r.ingredients.length > 0 || r.steps.length > 0);

console.log(`📊 Before: ${before} recipes`);
console.log(`🗑  Listicles to remove: ${listicles.length}`);

listicles.forEach(r => {
  console.log(`\n   ✂️  ${r.name}`);

  // Delete image from disk
  if (r.image_local) {
    const imgPath = path.join(__dirname, r.image_local);
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
      console.log(`      🖼  Deleted: ${r.image_local}`);
    } else {
      console.log(`      ⚠️  Image not found: ${r.image_local}`);
    }
  }
});

// Save cleaned JSON
data.recipes = clean;
data.total   = clean.length;
fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log(`\n✅ Done`);
console.log(`   Recipes: ${before} → ${clean.length}`);
console.log(`   Removed: ${listicles.length} listicles + their images`);
