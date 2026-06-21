/**
 * Title Cleaner — uses Claude API to clean recipe names
 * ───────────────────────────────────────────────────────
 * Removes: طريقة عمل / طريقة تحضير / طريقة طبخ / طريقة / حضري / حضّري
 * Keeps: the actual dish name
 *
 * Run AFTER scraper.js:  node clean_titles.js
 * Requires: ANTHROPIC_API_KEY in environment
 *   export ANTHROPIC_API_KEY=sk-ant-...
 */

const fs   = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'data', 'recipes.json');

async function cleanTitlesWithAI(titles) {
  const prompt = `أنتِ مساعدة لتنظيف أسماء الوصفات. 
المطلوب: إزالة أي بادئة غير ضرورية من أسماء الوصفات مثل:
- "طريقة عمل" → تُحذف
- "طريقة تحضير" → تُحذف  
- "طريقة طبخ" → تُحذف
- "طريقة" وحدها في البداية → تُحذف
- "حضري" أو "حضّري" في البداية → تُحذف
- "تذوّقي" أو "تذوقي" في البداية → تُحذف

لكن احتفظي بـ "بالطريقة" أو "على الطريقة" في منتصف الاسم.

أعطيكِ قائمة من الأسماء بتنسيق JSON، أعيديها مُنظّفة بنفس التنسيق بدون أي شرح.

القائمة:
${JSON.stringify(titles, null, 2)}

أعيدي فقط JSON array نظيف بدون markdown أو شرح.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method  : 'POST',
    headers : {
      'Content-Type'      : 'application/json',
      'x-api-key'         : process.env.ANTHROPIC_API_KEY,
      'anthropic-version' : '2023-06-01',
    },
    body: JSON.stringify({
      model      : 'claude-haiku-4-5-20251001',
      max_tokens : 4000,
      messages   : [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const text = data.content[0].text.trim();

  // Strip markdown if present
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Set ANTHROPIC_API_KEY first: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const data    = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const recipes = data.recipes;

  console.log(`🧹 Cleaning ${recipes.length} recipe titles with AI...\n`);

  // Process in batches of 30 to stay within token limits
  const BATCH = 30;
  for (let i = 0; i < recipes.length; i += BATCH) {
    const batch    = recipes.slice(i, i + BATCH);
    const titles   = batch.map(r => r.name);
    const end      = Math.min(i + BATCH, recipes.length);

    process.stdout.write(`  Batch ${Math.floor(i/BATCH)+1}: recipes ${i+1}–${end}... `);

    try {
      const cleaned = await cleanTitlesWithAI(titles);

      cleaned.forEach((newName, j) => {
        const old = recipes[i + j].name;
        recipes[i + j].name_cleaned = newName;
        if (old !== newName) {
          console.log(`\n    ✏️  "${old}" → "${newName}"`);
        }
      });

      console.log(`✅`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }

    // Small pause between batches
    if (i + BATCH < recipes.length) await new Promise(r => setTimeout(r, 1000));
  }

  // Save — keep original name, add name_cleaned
  data.recipes = recipes;
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');

  console.log(`\n✅ Done! Cleaned names saved as "name_cleaned" in recipes.json`);
  console.log(`   Review, then run: node apply_titles.js to replace "name" with "name_cleaned"`);
}

main().catch(console.error);
