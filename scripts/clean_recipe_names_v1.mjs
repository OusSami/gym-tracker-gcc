/**
 * clean_recipe_names_v1.mjs — One-time data migration (applied 2026-07-04)
 *
 * Cleaned 22 recipe names with editorial prefixes/suffixes from scraper sources.
 * All writes were to the `name` column directly (no schema change needed).
 *
 * Three of the 22 were already in the DB with the clean name — those dirty-named
 * records were DELETED as duplicates rather than renamed:
 *   DELETE: طريقة عمل الدقوس البارد          (clean "الدقوس البارد" already exists)
 *   DELETE: طريقة عمل مجبوس سمك بالطريقة الكويتية (clean already exists, 1200-cal whole-dish version)
 *   DELETE: وصفة اليوم من قلب المطبخ الخليجي: مجبوس الدجاج الإماراتي (clean already exists)
 *
 * Final outcome: 19 UPDATEs + 3 DELETEs = 22 dirty names removed from DB.
 *
 * Pattern types cleaned:
 *   Type 1 — Scraper prefix (طريقة عمل / وصفة / تعلمي / جربي / …)
 *   Type 2 — Source-site suffix (| يمي, : وصفة صحية وسهلة | يمي)
 *   Type 3 — Clickbait question intro (ما سرّ X؟ اكتشفي…)
 */

// ── Before → After mapping (19 successful UPDATEs) ────────────────────────────
//
// Type 1 — prefix strip (17 recipes)
//   طريقة عمل الأومليت الإسباني                    → الأومليت الإسباني
//   طريقة عمل البخاري بالدجاج ورز البسمتي          → البخاري بالدجاج ورز البسمتي
//   طريقة عمل الدقوس البارد (2)                     → الدقوس البارد (2)
//   طريقة عمل الدقوس الحار للكبسة                  → الدقوس الحار للكبسة
//   طريقة عمل حنيذ بالدجاج                         → حنيذ بالدجاج
//   طريقة عمل ساندويش مونتي كريستو                 → ساندويش مونتي كريستو
//   طريقة عمل فتة الحمص                             → فتة الحمص
//   طريقة عمل كبسة لحم بنكهة البرتقال              → كبسة لحم بنكهة البرتقال
//   طريقة عمل مطبق الخضار بالبيض للفطور            → مطبق الخضار بالبيض للفطور
//   طريقة عمل هاش براون مع السلمون والماسترد        → هاش براون مع السلمون والماسترد
//   وصفة عجة البطاطا بالفرن                         → عجة البطاطا بالفرن
//   تعلمي إعداد مندي الدجاج مثل المطاعم بسهولة     → مندي الدجاج
//   جربي صوص الحمص بالبنجر اليوم!                  → صوص الحمص بالبنجر
//   وصفة صحية وسهلة… سلطة التفاح والجوز مع الجرجير! → سلطة التفاح والجوز مع الجرجير
//
// Type 2 — suffix artifact strip (3 recipes, source: yummy.ph scraped as "يمي")
//   اليغمش – وصفة تقليدية سهلة ولذيذة | يمي        → اليغمش
//   سلطة الكينوا بالدجاج : وصفة صحية وسهلة | يمي   → سلطة الكينوا بالدجاج
//   سلطة فواكه بالكريمة الشهية والمنعشة | يمي       → سلطة فواكه بالكريمة
//
// Type 3 — clickbait intro extraction (2 recipes, content-verified before cleaning)
//   ما سرّ حواوشي جدة الشهي؟ اكتشفي المكونات وطرق التحضير  → حواوشي جدة
//   ما سر نكهة عيش بو لحم الحجازي الأصلي؟ اكتشفي ذلك       → عيش بو لحم الحجازي
//
// ── 3 DELETEs (dirty name was a duplicate of an existing clean record) ─────────
//   طريقة عمل الدقوس البارد          → deleted (الدقوس البارد preserved: 9 ingr, 120 cal)
//   طريقة عمل مجبوس سمك بالطريقة الكويتية → deleted (clean preserved: 460 cal/serving)
//   وصفة اليوم من قلب المطبخ الخليجي: مجبوس الدجاج الإماراتي → deleted (clean: 28 ingr, 430 cal)
