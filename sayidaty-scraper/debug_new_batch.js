/**
 * Debug one of the new batch pages to find the right selectors
 */
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Pick one that has ingredients but 0 steps
const TEST_URL = 'https://kitchen.sayidaty.net/node/15877/%D9%81%D8%B7%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D9%81%D8%B1%D8%A7%D9%88%D9%84%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--lang=ar'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' });
  await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const result = await page.evaluate(() => {
    // Headings
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map(el => ({
      tag: el.tagName, class: el.className, text: el.innerText?.trim().substring(0, 80)
    }));

    // Known selectors from original recipes
    const ingredientsArea  = document.querySelector('.ingredients-area')?.innerText?.trim().substring(0, 200);
    const preparationArea  = document.querySelector('.preparation-area')?.innerText?.trim().substring(0, 200);

    // All classes
    const classes = new Set();
    document.querySelectorAll('[class]').forEach(el => {
      el.className.split(/\s+/).forEach(c => { if (c) classes.add(c); });
    });

    // Context around المقادير and الخطوات
    const bodyText = document.body.innerText;
    const mIdx = bodyText.indexOf('المقادير');
    const mCtx = mIdx > -1 ? bodyText.substring(mIdx, mIdx + 400) : 'NOT FOUND';
    const sIdx = bodyText.indexOf('الخطوات');
    const sCtx = sIdx > -1 ? bodyText.substring(sIdx, sIdx + 400) : 'NOT FOUND';

    // All li elements
    const allLi = [...document.querySelectorAll('li')].slice(0, 30).map(el => ({
      parentClass: el.parentElement?.className || '',
      text: el.innerText?.trim().substring(0, 80)
    })).filter(l => l.text.length > 1);

    // Main content HTML
    const main = document.querySelector('main, article, .main-content, .content');
    const mainHTML = main ? main.innerHTML.substring(0, 3000) : 'NOT FOUND';

    return { headings, ingredientsArea, preparationArea, classes: [...classes], mCtx, sCtx, allLi, mainHTML };
  });

  console.log('=== HEADINGS ===');
  result.headings.forEach(h => console.log(`  <${h.tag} class="${h.class}">${h.text}`));

  console.log('\n=== .ingredients-area ===');
  console.log(result.ingredientsArea || 'NOT FOUND');

  console.log('\n=== .preparation-area ===');
  console.log(result.preparationArea || 'NOT FOUND');

  console.log('\n=== CONTEXT AROUND المقادير ===');
  console.log(result.mCtx);

  console.log('\n=== CONTEXT AROUND الخطوات ===');
  console.log(result.sCtx);

  console.log('\n=== ALL <li> (first 30) ===');
  result.allLi.forEach(li => console.log(`  [${li.parentClass}]: ${li.text}`));

  console.log('\n=== CSS CLASSES ===');
  console.log(result.classes.join(', '));

  console.log('\n=== MAIN HTML (first 3000) ===');
  console.log(result.mainHTML);

  await browser.close();
}

main().catch(console.error);
