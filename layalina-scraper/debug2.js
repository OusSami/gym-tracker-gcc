/**
 * Debug2 — check if full ingredients are in HTML or truly locked
 */
const fetch   = require('node-fetch');
const cheerio = require('cheerio');

const TEST_URL = 'https://yummy.layalina.com/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%AA%D9%88%D9%86%D8%A9-%D8%A8%D8%A7%D9%84%D8%A3%D8%B1%D8%B2-433403.html';

const HEADERS = {
  'User-Agent'      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language' : 'ar,en;q=0.9',
  'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer'         : 'https://yummy.layalina.com/',
};

async function main() {
  const res  = await fetch(TEST_URL, { headers: HEADERS });
  const html = await res.text();
  const $    = cheerio.load(html);

  // Print FULL HTML of ingredient wrapper
  console.log('=== FULL .recipe_ingredient_wrapper HTML ===');
  console.log($('.recipe_ingredient_wrapper').html());

  // Count all recipeDescription divs total and per section
  console.log('\n=== ALL .recipeDescription divs ===');
  $('.recipeDescription').each((i, el) => {
    console.log(`[${i}] ${$(el).text().trim().substring(0, 100)}`);
  });

  // Check if there are hidden elements
  console.log('\n=== HIDDEN ELEMENTS IN INGREDIENT WRAPPER ===');
  $('.recipe_ingredient_wrapper [style*="display:none"], .recipe_ingredient_wrapper [style*="display: none"], .recipe_ingredient_wrapper .hide, .recipe_ingredient_wrapper .hidden').each((_, el) => {
    console.log(`Hidden: ${$(el).text().trim().substring(0, 100)}`);
  });

  // Search for ingredient amounts in the raw HTML
  console.log('\n=== RAW INGREDIENT SECTION (500 chars around recipe_ingredient_wrapper) ===');
  const idx = html.indexOf('recipe_ingredient_wrapper');
  if (idx > -1) console.log(html.substring(idx, idx + 2000));
}

main().catch(console.error);
