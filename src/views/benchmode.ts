// The bench region: header with the 3D / 2D toggle, the 3D scene (lazy) and the 2D bench.
// The 2D bench is always mounted: in 3D mode its SVG drawing is hidden, but its control strip stays as the accessible
// controls under the canvas. Falls back to 2D when WebGL2 is missing or the scene fails.
import type { MountView, View } from './view.ts'
import { mountBench } from './bench.ts'
import { mountBench3D, webgl2Available, type Bench3DView } from './bench3d/index.ts'
import { strings } from './strings/bench3d.ts'
import { strings as benchStrings } from './strings/bench.ts'

type Mode = '3d' | '2d'
const KEY = 'photoelectric-bench-view'

function loadMode(): Mode | null {
  try { const v = localStorage.getItem(KEY); if (v === '3d' || v === '2d') return v } catch { /* ignore */ }
  return null
}
function saveMode(m: Mode): void { try { localStorage.setItem(KEY, m) } catch { /* ignore */ } }
const CTL_KEY = 'photoelectric-controls-open'
function loadControls(): boolean {
  const p = new URLSearchParams(location.search).get('controls') // overrides without persisting
  if (p === '1') return true
  if (p === '0') return false
  try { return localStorage.getItem(CTL_KEY) === '1' } catch { return false }
}
function saveControls(open: boolean): void { try { localStorage.setItem(CTL_KEY, open ? '1' : '0') } catch { /* ignore */ } }
/** Controls that exist only in the 2D strip (no handle in the 3D scene). */
const NO_3D_HANDLE = ['beam', 'cathode', 'stray', 'dirty']
const SVG_NS = 'http://www.w3.org/2000/svg'
function slidersIcon(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of ['M4 7h9M17 7h3M4 17h3M11 17h9']) { const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', d); svg.append(p) }
  for (const [cx, cy] of [[15, 7], [9, 17]] as const) {
    const c = document.createElementNS(SVG_NS, 'circle')
    c.setAttribute('cx', String(cx)); c.setAttribute('cy', String(cy)); c.setAttribute('r', '2')
    svg.append(c)
  }
  return svg
}

export const mountBenchSwitch: MountView = (root, ctx): View => {
  const S = () => strings[ctx.lang()]
  const param = new URLSearchParams(location.search).get('bench')
  const supported = webgl2Available()
  let mode: Mode = param === '2d' ? '2d' : param === '3d' ? '3d' : loadMode() ?? '3d'
  let note: 'none' | 'fallback' | 'fail' = 'none'
  if (!supported) { mode = '2d'; note = 'fallback' }

  const head = document.createElement('div')
  head.className = 'bench-head bench'
  const noteEl = document.createElement('p')
  noteEl.className = 'bench-note'
  noteEl.setAttribute('role', 'status')
  const group = document.createElement('div')
  group.className = 'seg-group'
  group.setAttribute('role', 'radiogroup')
  const MODES: Mode[] = ['3d', '2d']
  const btns = MODES.map((m) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'tool'
    b.setAttribute('role', 'radio')
    b.addEventListener('click', () => set(m, true))
    b.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      e.preventDefault()
      const next = m === '3d' ? '2d' : '3d'
      if (set(next, true)) btns[MODES.indexOf(next)]!.focus()
    })
    group.append(b)
    return b
  })
  const ctlBtn = document.createElement('button')
  ctlBtn.type = 'button'
  ctlBtn.className = 'tool bench-ctl-toggle'
  ctlBtn.dataset.tour = 'controls'
  ctlBtn.id = 'bench-ctl-toggle'
  const ctlText = document.createElement('span')
  let controlsOpen = loadControls()
  const appRoot = document.getElementById('app') ?? document.documentElement
  const hint = document.createElement('p')
  hint.className = 'bench-controls-hint'
  head.append(noteEl, ctlBtn, group)
  root.append(head)
  function setControls(open: boolean, persist: boolean): void {
    controlsOpen = open
    if (persist) saveControls(open)
    sync()
  }
  ctlBtn.addEventListener('click', () => setControls(!controlsOpen, true))

  let bench3d: Bench3DView | null = null
  const fail = (): void => {
    note = 'fail'
    bench3d?.destroy()
    bench3d = null
    unsupported = true
    set('2d', false)
  }
  let unsupported = !supported
  root.append(hint)
  const bench2d = mountBench(root, ctx) // appended after the 3D host, so the order is header, 3D, 2D bench

  function ensure3d(): void {
    if (bench3d || unsupported) return
    bench3d = mountBench3D(root, ctx, { onFail: fail, revealControls: () => setControls(true, false) })
    // keep the 3D host between the header and the 2D bench
    const host = root.querySelector('.bench3d')
    if (host) { head.after(host); host.after(hint) }
  }

  function set(m: Mode, persist: boolean): boolean {
    if (m === '3d' && unsupported) return false
    mode = m
    if (persist) saveMode(m)
    if (m === '3d') ensure3d()
    bench3d?.setVisible(m === '3d')
    bench2d.setStageVisible(m === '2d')
    sync()
    return true
  }
  function sync(): void {
    const s = S()
    group.setAttribute('aria-label', s.viewLabel)
    btns.forEach((b, i) => {
      const m = MODES[i]!
      b.textContent = m === '3d' ? s.view3d : s.view2d
      b.setAttribute('aria-checked', String(mode === m))
      b.tabIndex = mode === m ? 0 : -1
      b.disabled = m === '3d' && unsupported
    })
    const b = benchStrings[ctx.lang()]
    const collapsed = mode === '3d' && !controlsOpen
    appRoot.dataset.controls = collapsed ? 'collapsed' : 'open'
    ctlBtn.hidden = mode !== '3d'
    ctlBtn.replaceChildren(slidersIcon(), ctlText)
    ctlText.textContent = controlsOpen ? b.controlsHide : b.controlsShow
    ctlBtn.setAttribute('aria-expanded', String(controlsOpen))
    ctlBtn.setAttribute('aria-controls', 'bench-controls panel-region')
    ctlBtn.title = collapsed ? b.controlsHint : ''
    hint.textContent = b.controlsHint
    hint.hidden = !collapsed
    noteEl.textContent = note === 'fallback' ? s.fallbackNote : note === 'fail' ? s.failNote : ''
  }
  set(mode, false)

  return {
    update() {
      bench2d.update()
      if (mode === '3d') bench3d?.update()
    },
    relabel() { bench2d.relabel(); bench3d?.relabel(); sync() },
    focus(list) {
      if (mode === '3d' && list && list.some((c) => NO_3D_HANDLE.includes(c)) && !controlsOpen) setControls(true, false)
      bench2d.focus?.(list); bench3d?.focus?.(list)
    },
    destroy() { bench3d?.destroy(); bench2d.destroy(); head.remove(); hint.remove(); delete appRoot.dataset.controls },
  }
}
