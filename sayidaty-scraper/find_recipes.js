/**
 * Finds recipes by partial name match
 * Run: node find_recipes.js
 */
const fs   = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'data', 'recipes.json');
const data      = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const searches = [
  'السمك المقلي مقرمش',
  'الدقوس بالثوم',
  'الدقوس البارد',
  'السمك المشوي',
  'مكبوس الأرز مع سمك',
  'كباب الميرو',
  'القبولي العُماني',
  'الغوزي السعودي',
  'الحنيذ',
  'كبسة بالجزر',
  'زربيان اللحم',
  'المندي',
  'الجريش',
  'الأرز الكابلي',
  'المثلوثة السعودية',
];

searches.forEach(search => {
  const matches = data.recipes.filter(r =>
    r.name.includes(search) || r.image_local?.includes(search)
  );
  console.log(`\n🔍 "${search}":`);
  if (matches.length === 0) {
    console.log('   ❌ Not found');
  } else {
    matches.forEach(r => {
      console.log(`   ✅ ${r.name}`);
      console.log(`      ${r.url}`);
      console.log(`      ${r.image_local}`);
    });
  }
});
