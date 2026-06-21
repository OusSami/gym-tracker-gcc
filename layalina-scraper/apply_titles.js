/**
 * Apply Titles — replaces name with name_cleaned after review
 * Run: node apply_titles.js
 */
const fs   = require('fs');
const path = require('path');
const JSON_PATH = path.join(__dirname, 'data', 'recipes.json');

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
let changed = 0;

data.recipes.forEach(r => {
  if (r.name_cleaned) {
    r.name = r.name_cleaned;
    delete r.name_cleaned;
    changed++;
  }
});

fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ Applied cleaned titles to ${changed} recipes`);
