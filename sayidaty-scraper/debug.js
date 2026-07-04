/**
 * Debug script — open ONE recipe and dump everything we see
 * Run: node debug.js
 */

const puppeteer = require('puppeteer-core');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// A recipe we know has ingredients visually but scraped 0
const TEST_URL = 'https://kitchen.sayidaty.net/node/39456/%D9%83%D8%A8%D8%B3%D8%A9-%D9%84%D8%AD%D9%85-%D8%A8%D9%82%D8%AF%D8%B1-%D8%A7%D9%84%D8%B6%D8%BA%D8%B7-%D8%B9%D9%84%D9%89-%D8%A7%D9%84%D8%B7%D8%B1%D9%8A%D9%82%D8%A9-%D8%A7%D9%84%D8%AE%D9%84%D9%8A%D8%AC%D9%8A%D8%A9/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D9%88%D8%B5%D9%81%D8%A7%D8%AA';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--lang=ar'],
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' });
  await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const result = await page.evaluate(() => {
    // 1. All h2/h3 headings on the page
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.innerText?.trim().substring(0, 100),
    }));

    // 2. Search for مقادير anywhere in the DOM
    const allText = document.body.innerText;
    const maqadirIdx = allText.indexOf('مقادير');
    const maqadirContext = maqadirIdx > -1
      ? allText.substring(maqadirIdx - 50, maqadirIdx + 500)
      : 'NOT FOUND';

    // 3. All elements containing مقادير
    const maqadirEls = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 3) return; // skip containers
      const t = el.innerText?.trim() || '';
      if (t.includes('مقادير') && t.length < 100) {
        maqadirEls.push({
          tag: el.tagName,
          class: el.className,
          id: el.id,
          text: t,
        });
      }
    });

    // 4. All elements containing طريقة
    const tariqaEls = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 3) return;
      const t = el.innerText?.trim() || '';
      if (t.includes('طريقة') && t.length < 100) {
        tariqaEls.push({
          tag: el.tagName,
          class: el.className,
          id: el.id,
          text: t,
        });
      }
    });

    // 5. All li elements on the page
    const allLi = [...document.querySelectorAll('li')].slice(0, 30).map(el => ({
      class: el.className,
      parent: el.parentElement?.className,
      text: el.innerText?.trim().substring(0, 80),
    }));

    // 6. All p elements (first 30)
    const allP = [...document.querySelectorAll('p')].slice(0, 40).map(el => ({
      class: el.className,
      text: el.innerText?.trim().substring(0, 100),
    })).filter(p => p.text.length > 2);

    // 7. All classes in the page
    const classes = new Set();
    document.querySelectorAll('[class]').forEach(el => {
      el.className.split(/\s+/).forEach(c => { if (c) classes.add(c); });
    });

    return { headings, maqadirContext, maqadirEls, tariqaEls, allLi, allP, classes: [...classes] };
  });

  console.log('=== HEADINGS ===');
  result.headings.forEach(h => console.log(`  <${h.tag} class="${h.class}">${h.text}</${h.tag}>`));

  console.log('\n=== مقادير CONTEXT (raw text around it) ===');
  console.log(result.maqadirContext);

  console.log('\n=== ELEMENTS CONTAINING مقادير ===');
  result.maqadirEls.forEach(e => console.log(`  <${e.tag} class="${e.class}" id="${e.id}">${e.text}</${e.tag}>`));

  console.log('\n=== ELEMENTS CONTAINING طريقة ===');
  result.tariqaEls.forEach(e => console.log(`  <${e.tag} class="${e.class}">${e.text}</${e.tag}>`));

  console.log('\n=== ALL <li> ELEMENTS (first 30) ===');
  result.allLi.forEach(li => console.log(`  [parent:${li.parent}] class="${li.class}": ${li.text}`));

  console.log('\n=== ALL <p> ELEMENTS (first 40) ===');
  result.allP.forEach(p => console.log(`  class="${p.class}": ${p.text}`));

  console.log('\n=== ALL CSS CLASSES ===');
  console.log(result.classes.join(', '));

  await browser.close();
}

main().catch(console.error);
