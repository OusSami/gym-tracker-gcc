const fs   = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'data', 'recipes.json');
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const ingredients = [
  'طحين : 3 اكواب (مقادير العجينة)',
  'الزيت : ملعقتان كبيرتان (مقادير العجينة)',
  'الماء : كوب (حسب ما تحتاجه العجينة من ماء، مقادير العجينة)',
  'اللحم الضاني : 1 كيلو (مفروم خشن وممكن خلطه مع دهن أو ليه حسب الرغبة، مقادير الحشوة)',
  'البصل : 5 حبات (مفروم متوسط الحجم، مقادير الحشوة)',
  'فلفل أسود : ملعقتان صغيرتان (مقادير الحشوة)',
  'الكمون : ملعقة صغيرة (مقادير الحشوة)',
  'الزبدة : ربع كوب (مقادير الحشوة)',
  'لبن زبادي : علبتين (تخفق مع رشة ملح وتترك بحرارة الغرفة، مقادير الصوص المقدم فوق المنتو)',
  'طماطم : 4 حبات (مفرومة ناعم، مقادير الصوص المقدم فوق المنتو)',
  'زيت الزيتون : ملعقة صغيرة (مقادير الصوص المقدم فوق المنتو)',
  'كزبرة خضراء : حزمة (مفرومة ناعم، مقادير الصوص المقدم فوق المنتو)',
  'الخل الأبيض : ربع كوب (مقادير الصوص المقدم فوق المنتو)',
  'خل العنب : ربع كوب (أسمر، مقادير الصوص المقدم فوق المنتو)',
  'الكمون : ملعقة صغيرة (ناعم، مقادير الصوص المقدم فوق المنتو)',
  'فلفل أحمر : ملعقة صغيرة (مجروش حار، مقادير الصوص المقدم فوق المنتو)',
  'فلفل أسود : نصف ملعقة صغيرة (مقادير الصوص المقدم فوق المنتو)',
];

const idx = data.recipes.findIndex(r => r.name.includes('المنتو'));
if (idx === -1) { console.log('❌ Recipe not found'); process.exit(1); }

data.recipes[idx].ingredients = ingredients;
fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log(`✅ Patched "${data.recipes[idx].name}" with ${ingredients.length} ingredients`);

// Final stats
const withIngredients = data.recipes.filter(r => r.ingredients.length > 0).length;
const withSteps       = data.recipes.filter(r => r.steps.length > 0).length;
const full            = data.recipes.filter(r => r.ingredients.length > 0 && r.steps.length > 0).length;
console.log(`\n📊 Final stats:`);
console.log(`   Total recipes  : ${data.recipes.length}`);
console.log(`   With ingredients: ${withIngredients}`);
console.log(`   With steps      : ${withSteps}`);
console.log(`   Fully complete  : ${full}`);
