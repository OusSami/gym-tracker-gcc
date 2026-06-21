/**
 * Debug — inspects HTML structure using cheerio (no Puppeteer needed)
 * Run: node debug.js
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
  console.log('Fetching:', TEST_URL);
  const res  = await fetch(TEST_URL, { headers: HEADERS });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('HTML size:', html.length, 'bytes\n');

  const $ = cheerio.load(html);

  // 1. Headings
  console.log('=== HEADINGS ===');
  $('h1,h2,h3,h4').each((_, el) => {
    console.log(`  <${el.tagName} class="${$(el).attr('class') || ''}">${$(el).text().trim().substring(0, 80)}`);
  });

  // 2. Context around المقادير
  console.log('\n=== RAW TEXT AROUND المقادير ===');
  const bodyText = $('body').text();
  const mIdx = bodyText.indexOf('المقادير');
  console.log(mIdx > -1 ? bodyText.substring(mIdx - 20, mIdx + 500) : 'NOT FOUND');

  // 3. Context around طريقة التحضير
  console.log('\n=== RAW TEXT AROUND طريقة التحضير ===');
  const tIdx = bodyText.indexOf('طريقة التحضير');
  console.log(tIdx > -1 ? bodyText.substring(tIdx - 20, tIdx + 500) : 'NOT FOUND');

  // 4. All <li> elements
  console.log('\n=== ALL <li> ELEMENTS (first 40) ===');
  $('li').slice(0, 40).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 1) {
      console.log(`  [parent: ${$(el).parent().attr('class') || 'no-class'}]: ${text.substring(0, 80)}`);
    }
  });

  // 5. All divs/sections with class containing recipe-related keywords
  console.log('\n=== ELEMENTS WITH RECIPE-RELATED CLASSES ===');
  $('[class]').each((_, el) => {
    const cls = $(el).attr('class') || '';
    if (/ingredient|step|recipe|preparation|method|instruct|direction/i.test(cls)) {
      console.log(`  <${el.tagName} class="${cls}">`);
      console.log(`    ${$(el).text().trim().substring(0, 150)}\n`);
    }
  });

  // 6. All unique class names
  console.log('\n=== ALL CSS CLASSES ===');
  const classes = new Set();
  $('[class]').each((_, el) => {
    ($(el).attr('class') || '').split(/\s+/).forEach(c => { if (c) classes.add(c); });
  });
  console.log([...classes].join(', '));

  // 7. Raw HTML of first 3000 chars of <main> or <article>
  console.log('\n=== MAIN/ARTICLE HTML (first 3000 chars) ===');
  const main = $('main, article, .main-content, .content').first();
  console.log(main.length ? main.html().substring(0, 3000) : 'NOT FOUND');
}

main().catch(console.error);
