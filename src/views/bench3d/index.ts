// Public entry of the 3D bench: mountBench3D(root, ctx) returns a View. It paints its (cheap) frame immediately and
// lazy-loads scene.ts, which pulls in three.js as a separate chunk, so the first paint does not wait for it.
import type { View, ViewContext } from '../view.ts'
import { lookup, strings } from '../strings/bench3d.ts'
import type { BenchScene, PresetName } from './scene.ts'
import type { PartId } from './parts.ts'

const PRESET_ORDER: readonly PresetName[] = ['overview', 'optics', 'meter', 'top']

export interface Bench3DOptions {
  /** Called when the scene cannot start or loses its context; the caller should fall back to 2D. */
  onFail?(reason: string): void
  /** Initial camera preset (default: ?cam= if valid, else 'overview'). */
  preset?: PresetName
}
export type Bench3DView = View & { setVisible(visible: boolean): void; setPreset(name: PresetName): void }

/** True when a WebGL2 context can be created. Releases the probe context right away. */
export function webgl2Available(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}

export function mountBench3D(root: HTMLElement, ctx: ViewContext, opts: Bench3DOptions = {}): Bench3DView {
  const S = () => strings[ctx.lang()]
  const camParam = new URLSearchParams(location.search).get('cam') as PresetName | null
  const initial: PresetName = opts.preset ?? (camParam && PRESET_ORDER.includes(camParam) ? camParam : 'overview')

  const wrap = document.createElement('div')
  wrap.className = 'bench3d'
  const stage = document.createElement('div')
  stage.className = 'bench3d-stage'
  stage.dataset.benchStage = ''
  stage.setAttribute('role', 'group')
  const status = document.createElement('p')
  status.className = 'bench3d-status'
  status.setAttribute('role', 'status')
  stage.append(status)

  const presets = document.createElement('div')
  presets.className = 'bench3d-presets'
  presets.setAttribute('role', 'group')
  const presetBtns = PRESET_ORDER.map((p) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.dataset.preset = p
    b.addEventListener('click', () => choose(p))
    presets.append(b)
    return b
  })
  stage.append(presets)

  const card = document.createElement('div')
  card.className = 'bench3d-card'
  card.hidden = true
  card.setAttribute('aria-live', 'polite')
  const cardText = document.createElement('p')
  const cardGo = document.createElement('button')
  cardGo.type = 'button'
  const cardClose = document.createElement('button')
  cardClose.type = 'button'
  card.append(cardText, cardGo, cardClose)
  stage.append(card)
  wrap.append(stage)
  root.append(wrap)

  let scene: BenchScene | null = null
  let destroyed = false
  let current: PresetName = initial
  let pendingFocus: string[] | null = null
  let cardPart: PartId | null = null
  let cardControl: string | undefined

  const syncPresets = (): void => {
    presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(PRESET_ORDER[i] === current)))
  }
  function choose(p: PresetName): void {
    current = p
    syncPresets()
    scene?.setPreset(p)
  }
  const showCard = (id: PartId | null): void => {
    cardPart = id
    card.hidden = id === null
    if (!id) { cardControl = undefined; return }
    const s = S()
    const name = lookup(s, `parts.${id}.name`)
    cardText.replaceChildren()
    const strong = document.createElement('strong')
    strong.textContent = `${/^\d/.test(id) ? id + '  ' : ''}${name}`
    cardText.append(strong, document.createElement('br'), lookup(s, `parts.${id}.info`))
    cardControl = ctrlOf[id]
    cardGo.hidden = !cardControl
  }
  const ctrlOf: Partial<Record<PartId, string>> = { '1': 'lamp', '2': 'beam', '9': 'arm', '11': 'cathode', '12': 'windowCover', key: 'key', meter: 'range', meterKnob: 'range' }
  cardGo.addEventListener('click', () => {
    const target = cardControl && document.querySelector<HTMLElement>(`[data-ctl="${cardControl}"]`)
    if (!target) return
    target.scrollIntoView({ block: 'nearest', behavior: ctx.reducedMotion() ? 'auto' : 'smooth' })
    target.querySelector<HTMLElement>('input, button, select')?.focus({ preventScroll: true })
  })
  cardClose.addEventListener('click', () => showCard(null))
  stage.addEventListener('keydown', (e) => { if (e.key === 'Escape') showCard(null) })

  const relabel = (): void => {
    const s = S()
    stage.setAttribute('aria-label', s.figure)
    status.textContent = scene || destroyed ? '' : s.loading
    presets.setAttribute('aria-label', s.presetsLabel)
    presetBtns.forEach((b, i) => { b.textContent = s.presets[PRESET_ORDER[i]!] })
    cardGo.textContent = s.goToControl
    cardClose.textContent = s.close
    cardClose.setAttribute('aria-label', s.close)
    scene?.relabel()
    showCard(cardPart)
  }
  relabel()
  syncPresets()

  import('./scene.ts').then(({ createBenchScene }) => {
    if (destroyed) return
    try {
      scene = createBenchScene(stage, ctx, {
        initialPreset: initial,
        onPick: (id) => showCard(id),
        onFail: (r) => opts.onFail?.(r),
      })
      status.textContent = ''
      status.hidden = true
      if (pendingFocus) scene.focus(pendingFocus)
      if (current !== initial) scene.setPreset(current)
    } catch (err) {
      opts.onFail?.(String(err))
    }
  }).catch((err) => { if (!destroyed) opts.onFail?.(String(err)) })

  return {
    update() { scene?.update() },
    relabel,
    focus(list) { pendingFocus = list; scene?.focus(list) },
    setVisible(v) { wrap.hidden = !v; scene?.setVisible(v) },
    setPreset: choose,
    destroy() {
      destroyed = true
      scene?.destroy()
      scene = null
      wrap.remove()
    },
  }
}
