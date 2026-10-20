// Bench view: SVG top view of the compact arrangement plus its controls. Renders Apparatus state only.
import '../styles/bench.css'
import { HG_LINES, nuFromLambda, photonEnergy_eV } from '../physics/index.ts'
import type { CathodeId, HgLineId } from '../physics/index.ts'
import { LINE_SIGMA, STRAY_PRESET_FRACTION } from '../apparatus/index.ts'
import type { Mode } from '../apparatus/index.ts'
import type { MountView, View } from './view.ts'
import { strings } from './strings/bench.ts'
import {
  armAngleDeg, armPoint, armPositionFromAngle, attrSetter, classSetter, clamp, fill, flagSetter, fmtNum, htmlEl,
  opacityFromIntensity, pointerAngleDeg, q2, svgEl, textSetter,
} from './benchkit.ts'

const PIVOT = { x: 180, y: 410 }
const R_WINDOW = 150
const R_LENS = 118
const R_CELL = 80
const R_HANDLE = 45
const MIRROR = { x: 290, y: 70 }
const PRISM_EXIT = { x: 214, y: 70 }
const INSET = { x0: 20, w: 320 }
/** UI preset for the explore stray-light toggle (fraction of the line power scattered onto the cell). */
const STRAY_PRESET = STRAY_PRESET_FRACTION
const LINE_IDS = HG_LINES.map((l) => l.id)
const lineVar = (id: HgLineId): string => `var(--stage-${id})`
const CATHODE_IDS: CathodeId[] = ['photocell', 'Cs', 'Na', 'K', 'Zn']
type PartKey = keyof (typeof strings.en)['parts']

let uid = 0

export const mountBench: MountView = (root, ctx): View => {
  const a = ctx.apparatus
  const S = () => strings[ctx.lang()]
  const id = `bench${uid++}`
  const cleanups: Array<() => void> = []
  const relabelers: Array<() => void> = []
  const listen = <T extends EventTarget>(el: T, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions): void => {
    el.addEventListener(type, fn as EventListener, opts)
    cleanups.push(() => el.removeEventListener(type, fn as EventListener, opts))
  }

  const wrap = htmlEl('div', { class: 'bench' }, root)
  const stage = htmlEl('div', { class: 'bench-stage' }, wrap)

  // ---------------------------------------------------------------- main SVG
  const svg = svgEl('svg', { viewBox: '0 0 360 432', class: 'bench-svg', role: 'img' }, stage)
  relabelers.push(() => svg.setAttribute('aria-label', S().figure))
  const defs = svgEl('defs', {}, svg)
  const grad = svgEl('radialGradient', { id: `${id}-glow` }, defs)
  svgEl('stop', { offset: '0', 'stop-color': 'var(--stage-glow)', 'stop-opacity': '0.95' }, grad)
  svgEl('stop', { offset: '1', 'stop-color': 'var(--stage-glow)', 'stop-opacity': '0' }, grad)

  // Optical beam up to the prism (white)
  const beam = svgEl('path', {
    d: 'M46 62 L80 52 L118 68 L158 56 L207 69 L207 71 L158 84 L118 72 L80 88 L46 78 Z',
    class: 'bench-beam',
  }, svg)
  const setBeamOp = attrSetter(beam, 'opacity')

  // Fan of spectral lines: prism -> mirror -> window arc
  const fan = svgEl('g', { class: 'bench-fan' }, svg)
  interface LineGfx { path: SVGPathElement; dot: SVGCircleElement; op: (v: number) => void; sw: (v: number) => void; vis: (b: boolean) => void }
  const lineGfx = new Map<HgLineId, LineGfx>()
  for (const lid of LINE_IDS) {
    const path = svgEl('path', { class: `bench-ray${lid === 'uv' ? ' is-uv' : ''}`, stroke: lineVar(lid), fill: 'none' }, fan)
    const dot = svgEl('circle', { r: 3, fill: lineVar(lid), class: 'bench-ray-dot' }, fan)
    lineGfx.set(lid, {
      path, dot,
      op: (() => { const s = attrSetter(path, 'opacity'); const d = attrSetter(dot, 'opacity'); return (v: number) => { s(v); d(v) } })(),
      sw: attrSetter(path, 'stroke-width'),
      vis: flagSetterInv(path, dot),
    })
  }
  function flagSetterInv(p: SVGElement, d: SVGElement): (b: boolean) => void {
    const sp = flagSetter(p, 'hidden'), sd = flagSetter(d, 'hidden')
    return (b) => { sp(!b); sd(!b) }
  }

  // Emission window (12): arc
  const arcPt = (pos: number, r: number) => ({
    x: PIVOT.x + r * Math.sin((armAngleDeg(pos) * Math.PI) / 180),
    y: PIVOT.y - r * Math.cos((armAngleDeg(pos) * Math.PI) / 180),
  })
  const w0 = arcPt(0, R_WINDOW), w1 = arcPt(1, R_WINDOW)
  svgEl('path', { d: `M${w0.x} ${w0.y} A${R_WINDOW} ${R_WINDOW} 0 0 1 ${w1.x} ${w1.y}`, class: 'bench-window' }, svg)

  // Static optics
  const optics = svgEl('g', { class: 'bench-optics' }, svg)
  const lampGlow = svgEl('circle', { cx: 30, cy: 70, r: 34, fill: `url(#${id}-glow)` }, optics)
  const setLampGlow = attrSetter(lampGlow, 'opacity')
  svgEl('rect', { x: 14, y: 55, width: 34, height: 30, rx: 6, class: 'bench-body' }, optics)
  svgEl('rect', { x: 14, y: 55, width: 34, height: 30, rx: 6, class: 'bench-lamp-core' }, optics)
  const lampCore = optics.lastElementChild as SVGRectElement
  const setCore = attrSetter(lampCore, 'opacity')
  for (const x of [80, 158]) svgEl('ellipse', { cx: x, cy: 70, rx: 5, ry: 19, class: 'bench-lens' }, optics)
  svgEl('rect', { x: 116, y: 50, width: 4, height: 15, class: 'bench-body' }, optics)
  svgEl('rect', { x: 116, y: 74, width: 4, height: 15, class: 'bench-body' }, optics)
  svgEl('polygon', { points: '192,92 222,92 207,48', class: 'bench-prism' }, optics)
  svgEl('line', { x1: 278, y1: 58, x2: 302, y2: 82, class: 'bench-mirror' }, optics)

  // Short labels
  const shortLabels: Array<[PartKey, number, number]> = [['lamp', 31, 106], ['condenser', 80, 106], ['slit', 118, 106], ['imaging', 158, 106], ['prism', 207, 106], ['mirror', 326, 64]]
  const shortEls: Array<[PartKey, SVGTextElement]> = shortLabels.map(([k, x, y]) => [k, svgEl('text', { x, y, class: 'bench-short', 'text-anchor': 'middle' }, svg)])
  relabelers.push(() => { for (const [k, el] of shortEls) el.textContent = S().parts[k].short })
  const winLabel = svgEl('text', { x: 326, y: 326, class: 'bench-short', 'text-anchor': 'middle' }, svg)
  relabelers.push(() => { winLabel.textContent = S().parts.window.short })

  // Swivelling arm group (rotates as a whole)
  const armG = svgEl('g', { class: 'bench-arm' }, svg)
  const armHit = svgEl('g', { class: 'bench-arm-hit' }, armG)
  svgEl('rect', { x: PIVOT.x - 3, y: PIVOT.y - R_WINDOW - 8, width: 6, height: R_WINDOW + 8, rx: 3, class: 'bench-arm-bar' }, armG)
  svgEl('ellipse', { cx: PIVOT.x, cy: PIVOT.y - R_LENS, rx: 16, ry: 5, class: 'bench-lens' }, armG)
  svgEl('rect', { x: PIVOT.x - 7, y: PIVOT.y - R_LENS - 3, width: 14, height: 6, class: 'bench-diaphragm' }, armG)
  const cellGlow = svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y - R_CELL, r: 24, fill: 'var(--stage-yellow)' }, armG)
  const setCellGlow = attrSetter(cellGlow, 'opacity')
  const setCellFill = attrSetter(cellGlow, 'fill')
  svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y - R_CELL, r: 13, class: 'bench-cell' }, armG)
  svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y - R_CELL, r: 7, class: 'bench-cell-ring' }, armG)
  svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y - R_HANDLE, r: 12, class: 'bench-handle' }, armG)
  svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y - R_HANDLE, r: 4, class: 'bench-handle-dot' }, armG)
  // drag target: wide invisible stroke along the arm plus a big circle on the handle
  svgEl('line', { x1: PIVOT.x, y1: PIVOT.y, x2: PIVOT.x, y2: PIVOT.y - R_LENS - 20, class: 'bench-hit' }, armHit)
  svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y - R_HANDLE, r: 24, class: 'bench-hit-fill' }, armHit)
  svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y, r: 9, class: 'bench-pivot' }, svg)
  const setArmTransform = (() => {
    let last = ''
    return (deg: number) => {
      const v = `rotate(${deg.toFixed(2)}deg)`
      if (v !== last) { last = v; armG.style.transform = v }
    }
  })()

  // Badges (leaflet numbers). Each is a button; the shared info panel explains the part.
  interface Badge { g: SVGGElement; key: PartKey; num: string }
  const badges: Badge[] = []
  const infoPanel = htmlEl('div', { class: 'bench-info', 'aria-live': 'polite' })
  const infoText = htmlEl('p', {}, infoPanel)
  const infoClose = htmlEl('button', { type: 'button', class: 'bench-info-close' }, infoPanel)
  let openKey: PartKey | null = null
  const showInfo = (k: PartKey | null): void => {
    openKey = k
    infoPanel.hidden = k === null
    if (k) {
      const p = S().parts[k]
      infoText.replaceChildren()
      const b = htmlEl('strong', {}, infoText)
      b.textContent = `${badges.find((x) => x.key === k)?.num}  ${p.name}`
      infoText.append(document.createElement('br'), p.info)
    }
    for (const bd of badges) bd.g.setAttribute('aria-expanded', String(bd.key === k))
  }
  const makeBadge = (key: PartKey, num: string, x: number, y: number): SVGGElement => {
    const g = svgEl('g', { class: 'bench-badge', role: 'button', tabindex: 0, transform: `translate(${x} ${y})`, 'aria-expanded': 'false' }, svg)
    svgEl('circle', { r: 22, class: 'bench-hit-fill' }, g)
    svgEl('circle', { r: 10, class: 'bench-badge-bg' }, g)
    const t = svgEl('text', { class: 'bench-badge-num', 'text-anchor': 'middle', y: 4 }, g)
    t.textContent = num
    listen(g, 'click', () => showInfo(openKey === key ? null : key))
    listen(g, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showInfo(openKey === key ? null : key) }
    })
    badges.push({ g, key, num })
    return g
  }
  makeBadge('lamp', '1', 30, 30); makeBadge('condenser', '3', 80, 30); makeBadge('slit', '4', 118, 30)
  makeBadge('imaging', '5', 158, 30); makeBadge('prism', '6', 207, 30); makeBadge('mirror', '7', 290, 30)
  const winBadge = makeBadge('window', '12', 326, 300)
  void winBadge
  const armBadges: Array<[SVGGElement, number, number]> = [
    [makeBadge('lens', '10', 0, 0), R_LENS, 26], [makeBadge('cell', '11', 0, 0), R_CELL, 28], [makeBadge('arm', '9', 0, 0), R_HANDLE - 6, 30],
  ]
  relabelers.push(() => {
    for (const bd of badges) bd.g.setAttribute('aria-label', fill(S().partLabel, { n: bd.num, name: S().parts[bd.key].name }))
    infoClose.textContent = S().closeInfo
    showInfo(openKey)
  })
  listen(infoClose, 'click', () => showInfo(null))
  listen(wrap, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && openKey) showInfo(null) })
  const setBadgePos = (() => {
    let last = -1
    return (pos: number) => {
      const p = q2(pos)
      if (p === last) return
      last = p
      for (const [g, r, lat] of armBadges) {
        const pt = armPoint(pos, r, lat, PIVOT)
        g.setAttribute('transform', `translate(${q2(pt.x)} ${q2(pt.y)})`)
      }
    }
  })()

  // Drag the arm in the main drawing
  let dragging = false
  const toSvg = (e: PointerEvent): { x: number; y: number } => {
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = m.inverse().transformPoint(new DOMPoint(e.clientX, e.clientY))
    return { x: p.x, y: p.y }
  }
  listen(armHit, 'pointerdown', (e: PointerEvent) => {
    dragging = true
    wrap.classList.add('is-dragging')
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    e.preventDefault()
  })
  listen(armHit, 'pointermove', (e: PointerEvent) => {
    if (!dragging) return
    const p = toSvg(e)
    a.setArm(armPositionFromAngle(pointerAngleDeg(p.x, p.y, PIVOT)))
  })
  const endDrag = (): void => { dragging = false; wrap.classList.remove('is-dragging') }
  listen(armHit, 'pointerup', endDrag)
  listen(armHit, 'pointercancel', endDrag)

  // ---------------------------------------------------------------- inset: emission window, enlarged
  const insetBox = htmlEl('figure', { class: 'bench-inset' }, wrap)
  const insetSvg = svgEl('svg', { viewBox: '0 0 360 92', class: 'bench-inset-svg', role: 'img' }, insetBox as unknown as Element)
  insetBox.append(insetSvg)
  const insetCap = htmlEl('figcaption', {}, insetBox)
  relabelers.push(() => {
    insetSvg.setAttribute('aria-label', S().windowZoom)
    insetCap.textContent = S().windowZoomCap
  })
  svgEl('rect', { x: INSET.x0 - 8, y: 8, width: INSET.w + 16, height: 52, rx: 6, class: 'bench-inset-bg' }, insetSvg)
  interface InsetGfx { bar: SVGRectElement; tick: SVGLineElement; label: SVGTextElement; vis: (b: boolean) => void; op: (v: number) => void }
  const insetGfx = new Map<HgLineId, InsetGfx>()
  for (const lid of LINE_IDS) {
    const bar = svgEl('rect', { y: 14, width: 6, height: 40, rx: 2, fill: lineVar(lid), class: lid === 'uv' ? 'is-uv' : '' }, insetSvg)
    const tick = svgEl('line', { y1: 56, y2: 62, class: 'bench-tick' }, insetSvg)
    const label = svgEl('text', { y: 78, class: 'bench-inset-nm', 'text-anchor': 'middle' }, insetSvg)
    const sv1 = flagSetter(bar, 'hidden'), sv2 = flagSetter(tick, 'hidden'), sv3 = flagSetter(label, 'hidden')
    insetGfx.set(lid, { bar, tick, label, vis: (b) => { sv1(!b); sv2(!b); sv3(!b) }, op: attrSetter(bar, 'opacity') as (v: number) => void })
  }
  const aperture = svgEl('rect', { y: 10, width: 4 * LINE_SIGMA * INSET.w, height: 48, rx: 3, class: 'bench-aperture' }, insetSvg)
  const setApX = attrSetter(aperture, 'x')
  const apLabel = svgEl('text', { y: 90, class: 'bench-inset-nm', 'text-anchor': 'middle' }, insetSvg)
  const setApLX = attrSetter(apLabel, 'x')
  relabelers.push(() => { apLabel.textContent = '▲ ' + S().cellAperture })
  let insetDrag = false
  const insetPos = (e: PointerEvent): number => {
    const r = insetSvg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 360
    return clamp((x - INSET.x0) / INSET.w, 0, 1)
  }
  listen(insetSvg, 'pointerdown', (e: PointerEvent) => { insetDrag = true; insetSvg.setPointerCapture(e.pointerId); a.setArm(insetPos(e)) })
  listen(insetSvg, 'pointermove', (e: PointerEvent) => { if (insetDrag) a.setArm(insetPos(e)) })
  listen(insetSvg, 'pointerup', () => { insetDrag = false })
  listen(insetSvg, 'pointercancel', () => { insetDrag = false })

  wrap.append(infoPanel)
  infoPanel.hidden = true
  const hint = htmlEl('p', { class: 'bench-hint' }, wrap)
  relabelers.push(() => { hint.textContent = S().tapHint })

  // ---------------------------------------------------------------- controls
  const controls = htmlEl('div', { class: 'bench-controls' }, wrap)
  const ctl = (name: string, cls = ''): HTMLDivElement => htmlEl('div', { class: `ctl ${cls}`.trim(), 'data-ctl': name }, controls)
  const ctls = new Map<string, HTMLElement>()

  // Arm slider + aligned line
  const armCtl = ctl('arm', 'ctl-wide'); ctls.set('arm', armCtl)
  const armLabel = htmlEl('label', { for: `${id}-arm`, class: 'ctl-label' }, armCtl)
  const armSlider = htmlEl('input', { id: `${id}-arm`, type: 'range', min: 0, max: 1000, step: 1, value: 500, class: 'bench-range' }, armCtl)
  const alignedPill = htmlEl('p', { class: 'bench-aligned' }, armCtl)
  const alignedSwatch = htmlEl('span', { class: 'bench-swatch', 'aria-hidden': 'true' }, alignedPill)
  const alignedText = htmlEl('span', {}, alignedPill)
  const armHelp = htmlEl('p', { class: 'ctl-help', id: `${id}-armhelp` }, armCtl)
  armSlider.setAttribute('aria-describedby', armHelp.id)
  relabelers.push(() => { armLabel.textContent = S().armLabel; armHelp.textContent = S().armHelp })
  listen(armSlider, 'input', () => a.setArm(Number(armSlider.value) / 1000))
  listen(armSlider, 'keydown', (e: KeyboardEvent) => {
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.002 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.002
      : e.key === 'PageUp' ? 0.03 : e.key === 'PageDown' ? -0.03 : 0
    if (!step) return
    e.preventDefault()
    a.setArm(a.armPosition + step)
  })

  // Lamp switch
  const lampCtl = ctl('lamp'); ctls.set('lamp', lampCtl)
  const lampBtn = htmlEl('button', { type: 'button', role: 'switch', 'aria-checked': 'false', class: 'switch-row' }, lampCtl)
  const lampName = htmlEl('span', { class: 'switch-name' }, lampBtn)
  htmlEl('span', { class: 'switch-track', 'aria-hidden': 'true' }, lampBtn).append(htmlEl('span', { class: 'switch-knob' }))
  const lampStatus = htmlEl('p', { class: 'ctl-help' }, lampCtl)
  relabelers.push(() => { lampName.textContent = S().lamp })
  listen(lampBtn, 'click', () => a.setLamp(!a.lampOn))

  // Window cover (12): keeps room light out; does not dim the beam on the cathode
  const dimCtl = ctl('windowCover'); ctls.set('windowCover', dimCtl)
  const dimLabel = htmlEl('label', { for: `${id}-dim`, class: 'ctl-label' }, dimCtl)
  const dimSlider = htmlEl('input', { id: `${id}-dim`, type: 'range', min: 0, max: 100, step: 1, value: 0, class: 'bench-range' }, dimCtl)
  const dimOut = htmlEl('p', { class: 'ctl-help' }, dimCtl)
  relabelers.push(() => { dimLabel.textContent = S().windowCover })
  listen(dimSlider, 'input', () => a.setWindowCover(Number(dimSlider.value) / 100))

  // Beam intensity (neutral-density filter), explore only
  const beamCtl = ctl('beam', 'only-explore'); ctls.set('beam', beamCtl)
  const beamLabel = htmlEl('label', { for: `${id}-beam`, class: 'ctl-label' }, beamCtl)
  const beamSlider = htmlEl('input', { id: `${id}-beam`, type: 'range', min: 10, max: 100, step: 1, value: 100, class: 'bench-range' }, beamCtl)
  const beamOut = htmlEl('p', { class: 'ctl-help' }, beamCtl)
  relabelers.push(() => { beamLabel.textContent = S().beamIntensity })
  listen(beamSlider, 'input', () => a.setBeamIntensity(Number(beamSlider.value) / 100))

  // Explore-only
  const catCtl = ctl('cathode', 'only-explore'); ctls.set('cathode', catCtl)
  const catLabel = htmlEl('label', { for: `${id}-cat`, class: 'ctl-label' }, catCtl)
  const catSel = htmlEl('select', { id: `${id}-cat`, class: 'bench-select' }, catCtl)
  const catOpts = CATHODE_IDS.map((c) => { const o = htmlEl('option', { value: c }, catSel); return o })
  relabelers.push(() => { catLabel.textContent = S().cathode; CATHODE_IDS.forEach((c, i) => { catOpts[i]!.textContent = S().cathodes[c] }) })
  listen(catSel, 'change', () => a.setOverrides({ cathode: catSel.value as CathodeId }))

  const mkToggle = (name: string, only: string, on: (v: boolean) => void, label: () => string) => {
    const c = ctl(name, only); ctls.set(name, c)
    const b = htmlEl('button', { type: 'button', role: 'switch', 'aria-checked': 'false', class: 'switch-row' }, c)
    const n = htmlEl('span', { class: 'switch-name' }, b)
    htmlEl('span', { class: 'switch-track', 'aria-hidden': 'true' }, b).append(htmlEl('span', { class: 'switch-knob' }))
    relabelers.push(() => { n.textContent = label() })
    listen(b, 'click', () => on(b.getAttribute('aria-checked') !== 'true'))
    return attrSetter(b, 'aria-checked')
  }
  const setStrayChk = mkToggle('stray', 'only-explore', (v) => a.setOverrides({ stray_fraction: v ? STRAY_PRESET : null }), () => S().stray)
  const setDirtyChk = mkToggle('dirty', 'only-explore', (v) => a.setOverrides({ dirty: v }), () => S().dirty)
  const setRoomChk = mkToggle('roomLights', 'only-lab', (v) => a.setRoomLights(v), () => S().roomLights)

  // Explore overlay: photon energy, placed on the stage
  const photonG = svgEl('g', { class: 'bench-photon only-explore' }, svg)
  const photonLbl = svgEl('text', { x: 16, y: 168, class: 'bench-photon-lbl' }, photonG)
  const photonVal = svgEl('text', { x: 16, y: 194, class: 'bench-photon-val' }, photonG)
  relabelers.push(() => { photonLbl.textContent = S().photonEnergy })
  const setPhotonVal = textSetter(photonVal)
  const setPhotonShown = flagSetter(photonG, 'hidden')

  // ---------------------------------------------------------------- update
  const setBeam = (op: number): void => setBeamOp(q2(op))
  const setAlignedText = textSetter(alignedText)
  const setAlignedFill = attrSetter(alignedSwatch, 'style')
  const setSliderVal = (() => { let l = -1; return (v: number) => { if (v !== l) { l = v; armSlider.value = String(v) } } })()
  const setSliderText = attrSetter(armSlider, 'aria-valuetext')
  const setDimVal = (() => { let l = -1; return (v: number) => { if (v !== l) { l = v; dimSlider.value = String(v) } } })()
  const setDimText = textSetter(dimOut)
  const setDimAria = attrSetter(dimSlider, 'aria-valuetext')
  const setBeamVal = (() => { let l = -1; return (v: number) => { if (v !== l) { l = v; beamSlider.value = String(v) } } })()
  const setBeamText = textSetter(beamOut)
  const setBeamAria = attrSetter(beamSlider, 'aria-valuetext')
  const setLampChecked = attrSetter(lampBtn, 'aria-checked')
  const setLampStatus = textSetter(lampStatus)
  const setLampWarm = classSetter(lampCtl, 'is-warming')
  const setCathodeVal = (() => { let l = ''; return (v: string) => { if (v !== l) { l = v; catSel.value = v } } })()
  const setAlignedCls = classSetter(alignedPill, 'is-aligned')
  let builtMode: Mode | null = null
  let lastCellId: string | null = null

  const rebuildGeometry = (): void => {
    for (const s of a.spectrumOnWindow()) {
      const g = lineGfx.get(s.id)!
      const ig = insetGfx.get(s.id)!
      const dy = (s.position - 0.5) * 16
      const mp = { x: MIRROR.x + dy, y: MIRROR.y + dy }
      const tp = arcPt(clamp(s.position, 0, 1), R_WINDOW)
      g.path.setAttribute('d', `M${PRISM_EXIT.x} ${PRISM_EXIT.y} L${q2(mp.x)} ${q2(mp.y)} L${q2(tp.x)} ${q2(tp.y)}`)
      g.dot.setAttribute('cx', String(q2(tp.x))); g.dot.setAttribute('cy', String(q2(tp.y)))
      g.vis(s.reachable)
      const x = INSET.x0 + clamp(s.position, 0, 1) * INSET.w
      ig.bar.setAttribute('x', String(q2(x - 3)))
      ig.tick.setAttribute('x1', String(q2(x))); ig.tick.setAttribute('x2', String(q2(x)))
      ig.label.setAttribute('x', String(q2(x)))
      ig.label.textContent = String(Math.round(s.lambda_nm))
      ig.vis(s.reachable)
    }
  }

  const update = (): void => {
    const r = a.readout()
    if (r.mode !== builtMode) {
      builtMode = r.mode
      rebuildGeometry()
      wrap.dataset.mode = r.mode
    }
    const spec = a.spectrumOnWindow()
    let glow = 0
    for (const s of spec) {
      const g = lineGfx.get(s.id)!
      const ig = insetGfx.get(s.id)!
      const op = q2(opacityFromIntensity(s.intensity))
      const aligned = r.lineOnCell === s.id
      g.op(op)
      g.sw(aligned ? 3 : 1.6)
      ig.op(op)
      if (s.reachable) glow += s.overlap * opacityFromIntensity(s.intensity)
    }
    setBeam(r.lampBrightness * 0.85)
    setLampGlow(q2(r.lampBrightness))
    setCore(q2(0.15 + 0.85 * r.lampBrightness))
    setArmTransform(armAngleDeg(r.armPosition))
    setBadgePos(r.armPosition)
    setApX(q2(INSET.x0 + r.armPosition * INSET.w - (2 * LINE_SIGMA * INSET.w)))
    setApLX(q2(clamp(INSET.x0 + r.armPosition * INSET.w, 60, 300)))
    const cellId = r.lineOnCell ?? 'none'
    if (cellId !== lastCellId) { lastCellId = cellId; setCellFill(r.lineOnCell ? lineVar(r.lineOnCell) : 'var(--stage-glow)') }
    setCellGlow(q2(Math.min(1, glow) * 0.55))

    // Slider and aligned label
    setSliderVal(Math.round(r.armPosition * 1000))
    const s = S()
    let state = s.between
    let swatch = ''
    if (r.lineOnCell) {
      const sl = spec.find((x) => x.id === r.lineOnCell)!
      state = fill(s.aligned, { line: fill(s.lineNm, { name: s.lines[r.lineOnCell], nm: Math.round(sl.lambda_nm) }) })
      swatch = `background:${lineVar(r.lineOnCell)}`
    }
    setAlignedText(state)
    setAlignedFill(swatch)
    setAlignedCls(r.lineOnCell !== null)
    setSliderText(state)

    // Photon energy (explore only): physics supplied by the physics module, not computed here
    if (r.mode === 'explore' && r.lineOnCell) {
      const sl = spec.find((x) => x.id === r.lineOnCell)!
      setPhotonVal(`${fmtNum(photonEnergy_eV(nuFromLambda(sl.lambda_nm)), 2, ctx.lang())} ${s.eV}`)
      setPhotonShown(false)
    } else setPhotonShown(true)

    // Controls
    setLampChecked(String(r.lampOn))
    const warming = r.lampOn && r.lampBrightness < 1
    setLampWarm(warming)
    setLampStatus(!r.lampOn ? s.lampOff : warming ? fill(s.lampWarming, { pct: Math.floor(r.lampBrightness * 100) }) : s.lampOn)
    const dim = Math.round(a.windowCover * 100)
    setDimVal(dim)
    const dimTxt = fill(s.windowCoverValue, { pct: dim })
    setDimText(dimTxt); setDimAria(dimTxt)
    const beam = Math.round(a.beamIntensity * 100)
    setBeamVal(beam)
    const beamTxt = fill(s.beamIntensityValue, { pct: beam })
    setBeamText(beamTxt); setBeamAria(beamTxt)
    setCathodeVal(a.cathode)
    setStrayChk(String(a.stray_fraction !== null && a.stray_fraction > 0))
    setDirtyChk(String(a.dirty))
    setRoomChk(String(a.roomLights))
  }

  const relabel = (): void => { for (const f of relabelers) f(); update() }
  relabel()

  return {
    update,
    relabel,
    focus(list) {
      for (const [name, el] of ctls) el.classList.toggle('is-dimmed', list !== null && !list.includes(name))
    },
    destroy() {
      for (const c of cleanups) c()
      wrap.remove()
    },
  }
}
