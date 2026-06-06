#!/usr/bin/env node
// Generates 8 body-shape avatars for onboarding (4 shapes × male/female)
// Output: public/body-shapes/{shape}-{sex}.png
// Usage: GEMINI_API_KEY=xxx node scripts/generate-body-shapes.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1) }

const OUT_DIR = path.join(__dirname, '..', 'public', 'body-shapes')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const SHAPES = [
  {
    id: 'slim',
    male:   'very lean and slim male with flat stomach and defined posture',
    female: 'very slim female with petite athletic frame',
  },
  {
    id: 'normal',
    male:   'average healthy male with slight belly, standard build',
    female: 'average healthy female with balanced proportions',
  },
  {
    id: 'belly',
    male:   'overweight male with a noticeable round belly and fuller torso',
    female: 'overweight female with a round belly and fuller waist',
  },
  {
    id: 'obese',
    male:   'obese male with a very large belly and heavy round body',
    female: 'obese female with a very large round body',
  },
]

function buildPrompt(sex, desc) {
  return [
    `A clean flat-design avatar illustration of a ${sex} human body shape, ${desc}.`,
    'Full body, front-facing, standing upright.',
    'Minimalist icon style, simple smooth shapes, no face details, no clothing texture.',
    'Body colored in warm golden tone (#CBA23B), semi-transparent fill.',
    'Pure solid black background (#09090B).',
    'Centered composition, square crop, no text, no labels, no background elements.',
    'App icon / UI onboarding illustration quality.',
  ].join(' ')
}

async function generateImage(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 0.4,
        },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data?.error || data))

  const parts = data?.candidates?.[0]?.content?.parts || []
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imgPart) throw new Error('No image part in response: ' + JSON.stringify(data).slice(0, 300))

  return Buffer.from(imgPart.inlineData.data, 'base64')
}

async function main() {
  const todo = []
  for (const shape of SHAPES) {
    for (const sex of ['male', 'female']) {
      const file = path.join(OUT_DIR, `${shape.id}-${sex}.png`)
      if (fs.existsSync(file)) { console.log(`skip  ${shape.id}-${sex}.png (exists)`); continue }
      todo.push({ shape, sex, file })
    }
  }

  if (!todo.length) { console.log('All images already exist.'); return }

  for (const { shape, sex, file } of todo) {
    const name = `${shape.id}-${sex}.png`
    process.stdout.write(`gen   ${name} ... `)
    try {
      const prompt = buildPrompt(sex, sex === 'male' ? shape.male : shape.female)
      const buf = await generateImage(prompt)
      fs.writeFileSync(file, buf)
      console.log(`✓  (${(buf.length / 1024).toFixed(0)} KB)`)
    } catch (e) {
      console.log(`✗  ${e.message}`)
    }
    // avoid rate-limit
    if (todo.indexOf({ shape, sex, file }) < todo.length - 1) {
      await new Promise(r => setTimeout(r, 2500))
    }
  }
  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
