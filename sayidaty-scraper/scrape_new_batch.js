/**
 * Sayidaty — New Batch Scraper
 * ─────────────────────────────
 * Scrapes the new 48 URLs and APPENDS to existing data/recipes.json
 * Uses same selectors as the main scraper (confirmed working)
 *
 * Run: node scrape_new_batch.js
 */

const puppeteer = require('puppeteer-core');
const fetch     = require('node-fetch');
const fs        = require('fs');
const path      = require('path');

const BASE_URL   = 'https://kitchen.sayidaty.net';
const IMAGES_DIR = path.join(__dirname, 'data', 'images');
const JSON_PATH  = path.join(__dirname, 'data', 'recipes.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const NEW_URLS = [
  'https://kitchen.sayidaty.net/node/15877/%D9%81%D8%B7%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D9%81%D8%B1%D8%A7%D9%88%D9%84%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/15848/%D8%A8%D9%81-%D8%A8%D8%A7%D8%B3%D8%AA%D8%B1%D9%8A-%D8%A8%D8%AD%D8%B4%D9%88%D8%A9-%D8%A7%D9%84%D8%AA%D9%88%D8%AA-%D8%A7%D9%84%D9%85%D8%B4%D9%83%D9%84-%D9%88%D8%A7%D9%84%D8%AA%D9%81%D8%A7%D8%AD-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/15632/%D8%A8%D8%B1%D9%88%D8%B4%D9%83%D9%8A%D8%AA%D8%A7-%D8%A8%D8%A7%D9%84%D8%A3%D9%81%D9%88%D9%83%D8%A7%D8%AF%D9%88-%D9%88%D8%A7%D9%84%D8%B7%D9%85%D8%A7%D8%B7%D9%85-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/15381/%D9%83%D8%B1%D8%A7%D8%AA-%D8%A7%D9%84%D8%AF%D8%AC%D8%A7%D8%AC-%D8%A8%D8%A7%D9%84%D8%AC%D8%A8%D9%86-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/15322/%D8%B3%D9%85%D9%83-%D9%81%D9%8A%D9%84%D9%8A%D9%87-%D8%A8%D8%A7%D9%84%D8%A8%D9%82%D8%AF%D9%88%D9%86%D8%B3-%D8%A8%D8%A7%D9%84%D9%82%D8%B5%D8%AF%D9%8A%D8%B1-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A3%D8%B7%D8%A8%D8%A7%D9%82-%D8%A7%D9%84%D8%A3%D8%B3%D9%85%D8%A7%D9%83-%D9%88%D8%AB%D9%85%D8%A7%D8%B1-%D8%A7%D9%84%D8%A8%D8%AD%D8%B1/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/14094/%D8%A3%D8%B1%D8%B2-%D8%A8%D8%A7%D9%84%D8%AD%D9%84%D9%8A%D8%A8-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/13916/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%AA%D9%8A%D9%86-%D8%A8%D8%AC%D8%A8%D9%86-%D8%A7%D9%84%D9%81%D9%8A%D8%AA%D8%A7-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/13858/%D8%A3%D9%85-%D8%B9%D9%84%D9%8A-%D8%A8%D8%A7%D9%84%D8%AA%D9%88%D8%B3%D8%AA-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/13607/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%A8%D8%A7%D8%B0%D9%86%D8%AC%D8%A7%D9%86-%D9%88%D8%AC%D8%A8%D9%86%D8%A9-%D8%A7%D9%84%D8%AD%D9%84%D9%88%D9%85-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/13464/%D8%B7%D8%A7%D8%AC%D9%86-%D8%A7%D9%84%D8%A8%D8%A7%D9%85%D9%8A%D8%A9-%D8%A8%D8%A7%D9%84%D9%84%D8%AD%D9%85-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/13068/%D8%B9%D8%B5%D9%8A%D8%B1-%D8%A7%D9%84%D9%84%D9%8A%D9%85%D9%88%D9%86-%D8%A8%D8%A7%D9%84%D8%B1%D9%8A%D8%AD%D8%A7%D9%86-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%85%D8%B4%D8%B1%D9%88%D8%A8%D8%A7%D8%AA-%D9%88%D8%B9%D8%B5%D8%A7%D8%A6%D8%B1/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/12769/%D8%A7%D9%84%D8%A3%D8%B1%D8%B2-%D8%A7%D9%84%D9%85%D8%A8%D9%87%D8%B1-%D8%B9%D9%84%D9%89-%D8%A7%D9%84%D8%B7%D8%B1%D9%8A%D9%82%D8%A9-%D8%A7%D9%84%D8%A3%D8%B5%D9%84%D9%8A%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/12676/%D8%A3%D9%88%D9%85%D9%84%D9%8A%D8%AA-%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%A7%D8%B1-%D9%88%D8%A7%D9%84%D8%AC%D8%A8%D9%86-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D9%81%D8%B7%D9%88%D8%B1/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/12568/%D9%84%D9%8A%D8%B2%D9%8A-%D9%83%D9%8A%D9%83-%D8%A7%D9%84%D8%B4%D9%88%D9%81%D8%A7%D9%86-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/12468/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%AC%D8%B1%D8%AC%D9%8A%D8%B1-%D8%A8%D8%A7%D9%84%D8%AC%D9%88%D8%B2-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/12281/%D8%A7%D9%84%D9%81%D8%AA%D9%88%D8%B4-%D8%A8%D8%AF%D8%A8%D8%B3-%D8%A7%D9%84%D8%B1%D9%85%D8%A7%D9%86-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/10860/%D8%A7%D9%84%D9%81%D9%88%D9%84-%D8%A7%D9%84%D9%85%D8%AF%D9%85%D8%B3-%D8%A8%D8%A7%D9%84%D8%A8%D8%B5%D9%84-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D9%81%D8%B7%D9%88%D8%B1/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/10580/%D9%85%D9%87%D9%84%D8%A8%D9%8A%D8%A9-%D8%A7%D9%84%D9%88%D8%B1%D8%AF-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/10335/%D8%A8%D8%A7%D9%86-%D9%83%D9%8A%D9%83-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/10214/%D8%B4%D9%88%D8%B1%D8%A8%D8%A9-%D8%A7%D9%84%D8%B9%D8%AF%D8%B3-%D8%A8%D8%A7%D9%84%D9%83%D9%85%D9%88%D9%86-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B4%D9%88%D8%B1%D8%A8%D8%A9/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/9702/%D8%A7%D9%84%D9%85%D9%86%D8%AA%D9%88-%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/8395/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%AC%D8%B1%D8%AC%D9%8A%D8%B1-%D8%A8%D8%A7%D9%84%D8%AA%D9%81%D8%A7%D8%AD-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/8302/%D9%81%D8%B3%D8%AA%D9%82%D9%8A%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/8245/%D8%AF%D8%AC%D8%A7%D8%AC-%D8%A8%D8%A7%D9%84%D9%83%D8%A7%D8%AC%D9%88-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%AF%D8%AC%D8%A7%D8%AC/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/8232/%D8%B3%D9%85%D8%B3%D9%85%D9%8A%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/8179/%D8%AF%D8%AC%D8%A7%D8%AC-%D9%85%D8%AD%D8%B4%D9%8A-%D9%81%D8%B1%D9%8A%D9%83%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%AF%D8%AC%D8%A7%D8%AC/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3039/%D8%A8%D9%82%D9%84%D8%A7%D9%88%D8%A9-%D8%AA%D8%B1%D9%83%D9%8A%D8%A9-%D8%A8%D8%A7%D9%84%D9%81%D8%B3%D8%AA%D9%82-%D8%A7%D9%84%D8%AD%D9%84%D8%A8%D9%8A-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/7867/%D9%85%D9%87%D9%84%D8%A8%D9%8A%D8%A9-%D9%82%D9%85%D8%B1-%D8%A7%D9%84%D8%AF%D9%8A%D9%86-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B1%D9%85%D8%B6%D8%A7%D9%86%D9%8A%D8%A9',
  'https://kitchen.sayidaty.net/node/7798/%D8%B3%D8%AD%D9%84%D8%A8-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/7846/%D9%84%D9%82%D9%8A%D9%85%D8%A7%D8%AA-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B1%D9%85%D8%B6%D8%A7%D9%86%D9%8A%D8%A9',
  'https://kitchen.sayidaty.net/node/6931/%D8%B3%D9%84%D8%B7%D8%A9-%D8%AE%D8%B6%D8%A7%D8%B1-%D8%A8%D8%A7%D9%84%D9%84%D8%A8%D9%86%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/2563/%D8%B4%D9%88%D8%B1%D8%A8%D8%A9-%D8%A7%D9%84%D8%B9%D8%AF%D8%B3-%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%A7%D8%B1-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B4%D9%88%D8%B1%D8%A8%D8%A9/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/6695/%D8%A8%D8%B7%D8%A7%D8%B7%D8%B3-%D9%85%D8%B4%D9%88%D9%8A%D8%A9-%D8%A8%D8%A7%D9%84%D8%B2%D8%B9%D8%AA%D8%B1-%D8%A7%D9%84%D9%85%D8%AC%D9%81%D9%81-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/6730/%D9%84%D8%AD%D9%85-%D8%B1%D9%8A%D8%B4-%D9%85%D8%B4%D9%88%D9%8A-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A3%D9%83%D9%84%D8%A7%D8%AA-%D8%A7%D9%84%D9%84%D8%AD%D9%88%D9%85/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/6661/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D9%81%D8%A7%D8%B5%D9%88%D9%84%D9%8A%D8%A7-%D8%A7%D9%84%D8%AD%D9%85%D8%B1%D8%A7%D8%A1-%D9%88%D8%A7%D9%84%D8%AC%D8%B2%D8%B1-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/6531/%D8%B9%D8%AC%D8%A9-%D8%A8%D9%8A%D8%B6-%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%A7%D8%B1-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A3%D8%B7%D8%A8%D8%A7%D9%82-%D8%A7%D9%84%D8%AE%D8%B6%D8%A7%D8%B1/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/6372/%D8%AF%D8%AC%D8%A7%D8%AC-%D8%A8%D8%A7%D9%84%D9%81%D8%B3%D8%AA%D9%82-%D8%A7%D9%84%D8%AD%D9%84%D8%A8%D9%8A-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3902/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%B3%D8%A8%D8%A7%D9%86%D8%AE-%D9%88%D8%A7%D9%84%D9%81%D8%B1%D8%A7%D9%88%D9%84%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3852/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%AF%D8%AC%D8%A7%D8%AC-%D9%88%D8%A7%D9%84%D9%85%D8%A7%D9%86%D8%AC%D8%A7-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3886/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%B3%D8%A8%D8%A7%D9%86%D8%AE-%D8%A8%D8%A7%D9%84%D8%A8%D8%B1%D8%AA%D9%82%D8%A7%D9%84-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3846/%D8%B4%D9%88%D8%B1%D8%A8%D8%A9-%D8%A7%D9%84%D9%82%D8%B1%D8%B9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B4%D9%88%D8%B1%D8%A8%D8%A9/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3821/%D9%83%D8%B1%D8%A7%D8%AA-%D8%A7%D9%84%D9%84%D8%AD%D9%85%D8%A9-%D8%A8%D8%A7%D9%84%D8%A3%D9%81%D9%88%D9%83%D8%A7%D8%AF%D9%88-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3798/%D9%81%D8%AA%D8%A9-%D8%A7%D9%84%D8%AF%D8%AC%D8%A7%D8%AC-%D8%A8%D8%A7%D9%84%D8%B1%D9%8A%D8%AD%D8%A7%D9%86-%D9%88%D8%A7%D9%84%D9%86%D8%B9%D9%86%D8%A7%D8%B9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3719/%D8%A8%D8%A7%D8%A8%D8%A7-%D8%BA%D9%86%D9%88%D8%AC-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/845/%D9%85%D9%82%D9%84%D9%88%D8%A8%D8%A9-%D8%A7%D9%84%D8%A8%D8%A7%D8%B0%D9%86%D8%AC%D8%A7%D9%86-%D8%A7%D9%84%D9%85%D9%85%D9%8A%D8%B2%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/3712/%D8%B4%D9%88%D8%B1%D8%A8%D8%A9-%D8%A7%D9%84%D8%B0%D8%B1%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D8%B5%D9%88%D8%B1/%D8%A7%D9%84%D8%B4%D9%88%D8%B1%D8%A8%D8%A9/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/2454/%D8%AD%D9%84%D8%A7-%D8%A7%D9%84%D8%B4%D8%B9%D9%8A%D8%B1%D9%8A%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9/%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/2449/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%B0%D8%B1%D8%A9-%D8%A7%D9%84%D9%85%D9%85%D9%8A%D8%B2%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/901/%D8%A7%D9%84%D9%81%D8%AA%D8%A9-%D8%A7%D9%84%D8%AD%D9%84%D8%A8%D9%8A%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/2386/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%A8%D8%B1%D9%88%D9%83%D9%84%D9%8A-%D8%A8%D8%A7%D9%84%D8%B7%D8%AD%D9%8A%D9%86%D8%A9-%D9%88%D8%A7%D9%84%D9%84%D8%A8%D9%86-%D8%A7%D9%84%D8%B2%D8%A8%D8%A7%D8%AF%D9%8A-%D9%84%D8%B1%D8%AC%D9%8A%D9%85-%D9%85%D8%AB%D8%A7%D9%84%D9%8A/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/2344/%D8%B1%D9%88%D9%84%D8%A7%D8%AA-%D8%A7%D9%84%D8%AE%D9%8A%D8%A7%D8%B1-%D9%85%D8%AD%D8%B4%D9%88%D8%A9-%D8%A8%D8%A7%D9%84%D9%84%D8%A8%D9%86%D8%A9-%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B1%D9%85%D8%B6%D8%A7%D9%86%D9%8A%D8%A9',
  'https://kitchen.sayidaty.net/node/2335/%D8%B3%D9%84%D8%B7%D8%A9-%D8%A7%D9%84%D8%B4%D9%85%D9%86%D8%AF%D8%B1-%D8%A8%D8%A7%D9%84%D8%A8%D8%B7%D8%A7%D8%B7%D8%B3-%D9%88%D8%A7%D9%84%D8%AC%D9%88%D8%B2/%D8%A7%D9%84%D8%B3%D9%84%D8%B7%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/1397/%D9%85%D8%AC%D8%AF%D8%B1%D8%A9-%D8%A7%D9%84%D8%A8%D8%B1%D8%BA%D9%84-%D8%A8%D8%A7%D9%84%D8%AE%D8%B7%D9%88%D8%A7%D8%AA/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/98/%D9%81%D9%8A%D9%84%D9%8A%D9%87-%D8%B3%D9%85%D9%83-%D9%87%D8%A7%D9%85%D9%88%D8%B1-%D9%85%D8%B9-%D8%B5%D9%84%D8%B5%D8%A9-%D8%A7%D9%84%D8%AD%D8%A8%D9%82/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/100/%D8%B3%D9%85%D9%83%D8%A9-%D8%AD%D8%B1%D9%91%D8%A9-%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%B1/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/107/%D8%A7%D9%84%D9%81%D9%84%D8%A7%D9%81%D9%84-%D9%88%D8%A7%D9%84%D8%B7%D8%B1%D8%B7%D9%88%D8%B1-..-%D9%84%D8%B3%D8%AD%D9%88%D8%B1-%D9%85%D8%AB%D8%A7%D9%84%D9%8A/%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%84%D8%A7%D8%AA/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/427/%D8%B3%D9%85%D9%83%D8%A9-%D8%A7%D9%84%D9%84%D9%82%D8%B2-%D9%85%D8%B9-%D8%A7%D9%84%D9%87%D9%84%D9%8A%D9%88%D9%86-%D8%A7%D9%84%D8%A3%D8%AE%D8%B6%D8%B1/%D8%A3%D8%B7%D8%A8%D8%A7%D9%82-%D8%A7%D9%84%D8%A3%D8%B3%D9%85%D8%A7%D9%83-%D9%88%D8%AB%D9%85%D8%A7%D8%B1-%D8%A7%D9%84%D8%A8%D8%AD%D8%B1/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/512/%D8%A7%D9%84%D8%A8%D8%A7%D9%8A%D9%84%D9%91%D9%84%D8%A7/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
  'https://kitchen.sayidaty.net/node/673/%D8%AD%D8%B6%D9%91%D8%B1%D9%8A-%D8%B4%D8%B1%D8%A7%D8%A6%D8%AD-%D8%A7%D9%84%D9%84%D8%AD%D9%85-%D9%85%D8%B9-%D8%A7%D9%84%D8%AE%D8%B6%D8%B1-%D8%A7%D9%84%D9%85%D9%86%D9%88%D8%B9%D8%A9/%D9%88%D8%B5%D9%81%D8%A7%D8%AA-%D8%B7%D8%A8%D8%AE/%D8%AE%D8%B7%D9%88%D8%A9-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function sanitizeFilename(name) {
  return name.trim()
    .replace(/\s+/g, '-')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 120);
}

async function downloadImage(imageUrl, recipeName) {
  if (!imageUrl) return null;
  try {
    const ext      = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = sanitizeFilename(recipeName) + ext;
    const dest     = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(dest)) return `data/images/${filename}`;
    const res = await fetch(imageUrl, { headers: { 'Referer': BASE_URL } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(dest, await res.buffer());
    return `data/images/${filename}`;
  } catch (e) { return null; }
}

async function scrapeRecipe(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(600);

  return page.evaluate(() => {
    const name     = document.querySelector('h1')?.innerText?.trim() || '';
    const imageUrl = document.querySelector('meta[property="og:image"]')?.content || '';

    const ingredients = [];
    document.querySelector('.ingredients-area')?.querySelectorAll('li').forEach(li => {
      const t = li.innerText?.trim();
      if (t && t.length > 1) ingredients.push(t);
    });

    const steps = [];
    document.querySelector('.preparation-area')?.querySelectorAll('li').forEach(li => {
      const t = li.innerText?.trim();
      if (t && t.length > 5) steps.push(t);
    });

    const cookTime = document.querySelector('.recipe-meta-field .recipe-meta-data-info')?.innerText?.trim() || '';
    const servings = document.querySelectorAll('.recipe-meta-field .recipe-meta-data-info')[1]?.innerText?.trim() || '';

    return { name, imageUrl, ingredients, steps, cookTime, servings };
  });
}

async function main() {
  console.log('🍳 Sayidaty — New Batch (48 recipes)');
  console.log('======================================\n');

  // Load existing data
  const data    = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const doneUrls = new Set(data.recipes.map(r => r.url));

  const toScrape = NEW_URLS.filter(u => !doneUrls.has(u));
  console.log(`📋 Total new URLs: ${NEW_URLS.length}`);
  console.log(`⏭  Already in JSON: ${NEW_URLS.length - toScrape.length}`);
  console.log(`🔧 To scrape: ${toScrape.length}\n`);

  if (toScrape.length === 0) {
    console.log('✅ All already scraped!');
    return;
  }

  const browser = await puppeteer.launch({
    executablePath : CHROME_PATH,
    headless        : true,
    args            : ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ar'],
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];

  try {
    for (let i = 0; i < toScrape.length; i++) {
      const url   = toScrape[i];
      const label = decodeURIComponent(url.split('/node/')[1]?.split('/')[1] || '').substring(0, 50);
      process.stdout.write(`[${i+1}/${toScrape.length}] ${label}\n             `);

      try {
        const recipe    = await scrapeRecipe(page, url);
        process.stdout.write(`scraping ✓  image... `);
        const imagePath = await downloadImage(recipe.imageUrl, recipe.name);

        data.recipes.push({
          name        : recipe.name,
          url,
          image_url   : recipe.imageUrl,
          image_local : imagePath,
          cook_time   : recipe.cookTime,
          servings    : recipe.servings,
          ingredients : recipe.ingredients,
          steps       : recipe.steps,
        });

        console.log(`✅ (${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps)`);
      } catch (err) {
        console.log(`❌ ${err.message}`);
        errors.push({ url, error: err.message });
      }

      // Save after every recipe
      data.total  = data.recipes.length;
      data.failed = errors.length;
      fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');

      await sleep(1000 + Math.random() * 400);
    }
  } finally {
    await browser.close();
  }

  console.log('\n══════════════════════════════════════');
  console.log(`✅ Done! Total recipes now: ${data.recipes.length}`);
  console.log(`❌ Errors: ${errors.length}`);
}

main().catch(console.error);
