import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Read .env.local
const envPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.env.local'
)
const env = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [k, ...v] = line.split('=')
    if (k && v) acc[k.trim()] = v.join('=').trim()
    return acc
  }, {})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await supabase
  .from('recipes')
  .select('id, name, source')
  .is('image_url', null)
  .order('source')

if (error) { console.error(error); process.exit(1) }

console.log(`\nTotal recipes without images: ${data.length}\n`)
console.log('ID | Source | Name')
console.log('─'.repeat(80))
data.forEach(r => {
  console.log(`${r.id} | ${r.source} | ${r.name}`)
})

// Also write to a CSV for easy reference
const csv = 'id,source,name\n' +
  data.map(r =>
    `${r.id},${r.source},"${r.name.replace(/"/g,'""')}"`
  ).join('\n')

fs.writeFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)),
  '../scripts/missing_images.csv'),
  csv
)
console.log('\nSaved to scripts/missing_images.csv')
