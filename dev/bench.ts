// Standalone harness for the bench and panel views (not part of the app build).
import '../src/styles/tokens.css'
import { Apparatus } from '../src/apparatus/index.ts'
import type { Lang } from '../src/i18n.ts'
import { mountBench } from '../src/views/bench.ts'
import { mountPanel } from '../src/views/panel.ts'

const q = new URLSearchParams(location.search)
const theme = q.get('theme')
if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme
let lang: Lang = q.get('lang') === 'es' ? 'es' : 'en'
const apparatus = new Apparatus({ mode: q.get('mode') === 'lab' ? 'lab' : 'explore' })
if (q.get('demo')) {
  apparatus.setLamp(true)
  for (let i = 0; i < 14; i++) apparatus.tick(5)
  apparatus.setArm(apparatus.linePosition('blue'))
  for (let i = 0; i < 4; i++) apparatus.tick(5)
}

const style = document.createElement('style')
style.textContent = `
  body { margin:0; background:var(--bg); color:var(--label); font:var(--text-callout); }
  * { box-sizing: border-box; }
  .bar { display:flex; gap:8px; padding:8px 16px; flex-wrap:wrap; }
  .bar button { min-height:44px; padding:0 16px; border:none; border-radius:999px; background:var(--fill); color:var(--label); font:inherit; cursor:pointer; }
  .grid { display:grid; gap:16px; padding:0 16px 32px; max-width:72rem; margin-inline:auto; }
  @media (min-width: 900px) { .grid { grid-template-columns: 2fr 1fr; align-items:start; } }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }`
document.head.append(style)

const app = document.getElementById('app')!
const bar = document.createElement('div'); bar.className = 'bar'
const grid = document.createElement('div'); grid.className = 'grid'
const benchRoot = document.createElement('div'); const panelRoot = document.createElement('div')
grid.append(benchRoot, panelRoot); app.append(bar, grid)

const ctx = { apparatus, lang: () => lang, reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches }
const bench = mountBench(benchRoot, ctx)
const panel = mountPanel(panelRoot, ctx)

const mk = (label: string, fn: () => void): void => {
  const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', fn); bar.append(b)
}
mk('explore', () => apparatus.setMode('explore'))
mk('lab', () => apparatus.setMode('lab'))
mk('EN', () => { lang = 'en'; bench.relabel(); panel.relabel() })
mk('ES', () => { lang = 'es'; bench.relabel(); panel.relabel() })

let last = performance.now()
const frame = (now: number): void => {
  apparatus.tick((now - last) / 1000)
  last = now
  bench.update(); panel.update()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
