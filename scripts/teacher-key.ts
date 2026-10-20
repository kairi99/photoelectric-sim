// Writes docs/teacher-key.md from the model. Run with: npm run teacher-key  (Node 24+ strips types natively).
import { mkdirSync, writeFileSync } from 'node:fs'
import { teacherKey } from '../src/pedagogy/teacherKey.ts'

const out = new URL('../docs/teacher-key.md', import.meta.url)
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true })
writeFileSync(out, teacherKey() + '\n')
console.log(`wrote ${out.pathname}`)
