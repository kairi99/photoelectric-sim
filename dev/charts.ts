// Dev harness for the charts and table views (not part of the app build).
import '../src/styles/app.css'
import { Apparatus } from '../src/apparatus/index.ts'
import type { Mode } from '../src/apparatus/index.ts'
import type { HgLineId } from '../src/physics/index.ts'
import { mountCharts } from '../src/views/charts.ts'
import { mountTable } from '../src/views/table.ts'
import type { Lang } from '../src/i18n.ts'

const q = new URLSearchParams(location.search)
if (q.get('theme') === 'dark' || q.get('theme') === 'light') document.documentElement.dataset.theme = q.get('theme')!
let lang: Lang = q.get('lang') === 'es' ? 'es' : 'en'
const app = new Apparatus({ mode: (q.get('mode') as Mode) === 'lab' ? 'lab' : 'explore' })

const root = document.getElementById('app')!
root.innerHTML = '<div class="bar"></div><main><div class="region" id="c"></div><div class="region" id="t"></div></main>'
const bar = root.querySelector('.bar') as HTMLElement
bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px'
const ctx = { apparatus: app, lang: () => lang, reducedMotion: () => false }
const charts = mountCharts(document.getElementById('c')!, ctx)
const table = mountTable(document.getElementById('t')!, ctx)

function setup(): void {
  app.setLamp(true)
  app.setRange(3)
  app.lampOn = true
  app.load({ lampWarm_s: 60 })
}
async function measure(line: HgLineId): Promise<void> {
  app.pressKey()
  app.tick(2)
  app.setArm(app.linePosition(line))
  app.releaseKey()
  for (let i = 0; i < 12; i++) app.tick(5) // 60 s at speed 1
  app.record()
}
function autoAll(): void {
  app.speed = 1
  for (const l of ['yellow', 'green', 'blue', 'violet'] as HgLineId[]) {
    app.pressKey(); app.tick(2)
    app.setArm(app.linePosition(l))
    app.releaseKey()
    for (let i = 0; i < 14; i++) app.tick(5)
    app.record()
  }
}
void measure

function btn(label: string, fn: () => void): void {
  const b = document.createElement('button')
  b.className = 'tool'
  b.textContent = label
  b.onclick = fn
  bar.append(b)
}
btn('mode', () => { app.setMode(app.mode === 'explore' ? 'lab' : 'explore'); if (app.mode === 'explore') setup(); else { app.setLamp(true); app.load({ lampWarm_s: 60 }); app.setRange(3) } })
btn('lang', () => { lang = lang === 'en' ? 'es' : 'en'; charts.relabel(); table.relabel() })
btn('auto-measure 4 lines', autoAll)
btn('release one', () => { app.pressKey(); app.tick(2); app.setArm(app.linePosition('blue')); app.releaseKey() })

setup()
if (q.get('auto') === '1') autoAll()

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  app.tick(dt)
  charts.update()
  table.update()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
