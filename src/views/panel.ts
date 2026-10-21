// Panel view: key switch, electrometer amplifier, analog multimeter dial, stopwatch and time speed.
import '../styles/panel.css'
import type { MeterRange, Speed } from '../apparatus/index.ts'
import type { MountView, View } from './view.ts'
import { strings } from './strings/panel.ts'
import {
  announceDue, attrSetter, classSetter, fill, fmtNum, formatStopwatch, htmlEl, needleAngleDeg, quantiseReading_V, readingDecimals, scaleTicks, svgEl, textSetter,
} from './benchkit.ts'

const RANGES: MeterRange[] = ['OFF', 0.1, 0.3, 1, 3, 10, 30]
let uid = 0
const DIAL = { cx: 150, cy: 168, r: 120 }

export const mountPanel: MountView = (root, ctx): View => {
  const a = ctx.apparatus
  const S = () => strings[ctx.lang()]
  const cleanups: Array<() => void> = []
  const relabelers: Array<() => void> = []
  const listen = <T extends EventTarget>(el: T, type: string, fn: (e: never) => void): void => {
    el.addEventListener(type, fn as EventListener)
    cleanups.push(() => el.removeEventListener(type, fn as EventListener))
  }
  const ctls = new Map<string, HTMLElement>()
  const wrap = htmlEl('div', { class: 'panel' }, root)
  const card = (name: string | null, cls = ''): HTMLElement => {
    const c = htmlEl('section', { class: `card ${cls}`.trim() }, wrap)
    if (name) { c.dataset.ctl = name; ctls.set(name, c) }
    return c
  }

  // ---------------------------------------------------------------- meter
  const meter = card('range', 'card-meter')
  const meterHead = htmlEl('h3', {}, meter)
  relabelers.push(() => { meterHead.textContent = S().meterTitle })
  const dial = htmlEl('div', { class: 'dial' }, meter)
  const svg = svgEl('svg', { viewBox: '0 16 300 172', class: 'dial-svg', role: 'img' }, dial)
  const setSvgLabel = attrSetter(svg, 'aria-label')
  const ptAt = (f: number, r: number) => {
    const t = (needleAngleDeg(f) * Math.PI) / 180
    return { x: DIAL.cx + r * Math.sin(t), y: DIAL.cy - r * Math.cos(t) }
  }
  const p0 = ptAt(0, DIAL.r), p1 = ptAt(1, DIAL.r)
  svgEl('path', { d: `M${p0.x} ${p0.y} A${DIAL.r} ${DIAL.r} 0 0 1 ${p1.x} ${p1.y}`, class: 'dial-arc' }, svg)
  // calm mirror-scale hint: a fine reading band just inside the scale
  const m0 = ptAt(0, DIAL.r - 22), m1 = ptAt(1, DIAL.r - 22)
  svgEl('path', { d: `M${m0.x} ${m0.y} A${DIAL.r - 22} ${DIAL.r - 22} 0 0 1 ${m1.x} ${m1.y}`, class: 'dial-mirror' }, svg)
  const ticksG = svgEl('g', { class: 'dial-ticks' }, svg)
  const unitText = svgEl('text', { x: 14, y: 182, class: 'dial-unit', 'text-anchor': 'start' }, svg)
  const rangeText = svgEl('text', { x: 286, y: 182, class: 'dial-range', 'text-anchor': 'end' }, svg)
  const needle = svgEl('g', { class: 'dial-needle' }, svg)
  svgEl('line', { x1: DIAL.cx, y1: DIAL.cy + 16, x2: DIAL.cx, y2: DIAL.cy - DIAL.r - 2, class: 'dial-needle-line' }, needle)
  svgEl('circle', { cx: DIAL.cx, cy: DIAL.cy, r: 6, class: 'dial-hub' }, svg)
  svgEl('circle', { cx: DIAL.cx, cy: DIAL.cy, r: 2, class: 'dial-hub-dot' }, svg)
  const setNeedle = (() => {
    let last = ''
    return (deg: number) => {
      const v = `rotate(${(Math.round(deg * 10) / 10).toFixed(1)}deg)`
      if (v !== last) { last = v; needle.style.transform = v }
    }
  })()
  let builtRange: MeterRange | null = null
  const buildTicks = (range: MeterRange): void => {
    ticksG.replaceChildren()
    const rv = range === 'OFF' ? 3 : range
    for (const t of scaleTicks(rv)) {
      const a0 = ptAt(t.fraction, DIAL.r), a1 = ptAt(t.fraction, DIAL.r - (t.major ? 14 : 6))
      svgEl('line', { x1: a0.x, y1: a0.y, x2: a1.x, y2: a1.y, class: t.major ? 'tick-major' : 'tick-minor' }, ticksG)
      if (t.label !== null) {
        const l = ptAt(t.fraction, DIAL.r + 14)
        const el = svgEl('text', { x: l.x, y: l.y + 5, class: 'dial-num', 'text-anchor': 'middle' }, ticksG)
        el.textContent = t.label.replace('.', ctx.lang() === 'es' ? ',' : '.')
      }
    }
  }
  const badge = htmlEl('p', { class: 'dial-badge', role: 'status' }, dial)
  const setBadgeText = textSetter(badge)
  const setBadgeKind = (() => { let l = ''; return (k: string) => { if (k !== l) { l = k; badge.dataset.kind = k; badge.hidden = k === '' } } })()
  // Screen-reader text for the needle: quantised to the scale's reading resolution, announced at most once a second.
  const live = htmlEl('p', { class: 'visually-hidden', 'aria-live': 'polite', 'aria-atomic': 'true' }, dial)
  let liveText = '', liveAt = -Infinity, labelText = ''
  const needleText = (r: ReturnType<typeof a.readout>): string => {
    const s = S()
    if (r.meterRange === 'OFF' || r.needleValue_V === null) return s.needleOff
    const rng = String(r.meterRange).replace('.', ctx.lang() === 'es' ? ',' : '.')
    if (r.overRange) return fill(s.needleOver, { r: rng })
    return fill(s.needleReading, { v: fmtNum(quantiseReading_V(r.needleValue_V, r.meterRange), readingDecimals(r.meterRange), ctx.lang()), r: rng })
  }
  const digital = htmlEl('p', { class: 'digital only-explore' }, meter)
  const digitalLbl = htmlEl('span', { class: 'digital-lbl' }, digital)
  const digitalVal = htmlEl('span', { class: 'digital-val' }, digital)
  const setDigitalLbl = textSetter(digitalLbl)
  const setDigitalVal = textSetter(digitalVal)

  const rangeGroup = htmlEl('div', { class: 'seg seg-range', role: 'radiogroup' }, meter)
  relabelers.push(() => rangeGroup.setAttribute('aria-label', S().rangeGroup))
  const rangeBtns = RANGES.map((rg) => {
    const b = htmlEl('button', { type: 'button', role: 'radio', 'aria-checked': 'false', class: 'seg-btn', tabindex: -1 }, rangeGroup)
    relabelers.push(() => {
      const num = String(rg).replace('.', ctx.lang() === 'es' ? ',' : '.')
      b.textContent = rg === 'OFF' ? S().rangeOff : num
      b.setAttribute('aria-label', rg === 'OFF' ? S().rangeOff : fill(S().rangeOption, { v: num }))
    })
    listen(b, 'click', () => { a.setRange(rg); update() })
    listen(b, 'keydown', (e: KeyboardEvent) => {
      const i = RANGES.indexOf(rg)
      const j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : -1
      if (j < 0 || j >= RANGES.length) return
      e.preventDefault()
      a.setRange(RANGES[j]!)
      update()
      rangeBtns[j]!.focus()
    })
    return b
  })
  const rangeFlags = rangeBtns.map((b) => ({ chk: attrSetter(b, 'aria-checked'), tab: attrSetter(b, 'tabindex') }))

  // ---------------------------------------------------------------- key switch + amplifier + stopwatch
  const keyCard = card('key', 'card-key')
  const keyBtn = htmlEl('button', { type: 'button', class: 'key-btn', 'aria-pressed': 'false' }, keyCard)
  keyBtn.id = `key-${uid++}`
  const keyCap = htmlEl('span', { class: 'key-cap' }, keyBtn)
  const keyText = htmlEl('span', { class: 'key-text' }, keyCap)
  const keyHelp = htmlEl('p', { class: 'ctl-help' }, keyCard)
  keyHelp.id = `${keyBtn.id}-help`
  keyBtn.setAttribute('aria-describedby', keyHelp.id)
  relabelers.push(() => { keyHelp.textContent = S().keyHelp })
  listen(keyBtn, 'pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    try { keyBtn.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    a.pressKey()
  })
  const up = (): void => a.releaseKey()
  listen(keyBtn, 'pointerup', up)
  listen(keyBtn, 'pointercancel', up)
  listen(keyBtn, 'lostpointercapture', up)
  listen(keyBtn, 'contextmenu', (e: Event) => e.preventDefault())
  listen(keyBtn, 'keydown', (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) a.pressKey() }
  })
  listen(keyBtn, 'keyup', (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); a.releaseKey() } })
  listen(keyBtn, 'blur', up)
  const setKeyPressed = classSetter(keyBtn, 'is-pressed')
  const setKeyAria = attrSetter(keyBtn, 'aria-pressed')
  const setKeyText = textSetter(keyText)

  const amp = card(null, 'card-amp')
  const ampHead = htmlEl('h3', {}, amp)
  const ampRow = htmlEl('div', { class: 'amp-row' }, amp)
  htmlEl('span', { class: 'amp-led', 'aria-hidden': 'true' }, ampRow)
  const ampPower = htmlEl('span', {}, ampRow)
  const ampNote = htmlEl('p', { class: 'ctl-help' }, amp)
  relabelers.push(() => { ampHead.textContent = S().ampTitle; ampPower.textContent = S().ampPower; ampNote.textContent = S().ampNote })

  const sw = card(null, 'card-sw')
  const swHead = htmlEl('h3', {}, sw)
  const swTime = htmlEl('p', { class: 'sw-time', role: 'timer', 'aria-live': 'off' }, sw)
  const swSettled = htmlEl('p', { class: 'sw-settled' }, sw)
  relabelers.push(() => { swHead.textContent = S().stopwatch })
  // Compact true-voltage readout, shown only while the controls are collapsed in 3D (the meter card holds it otherwise).
  const swDigital = htmlEl('p', { class: 'digital digital-compact only-explore' }, sw)
  const swDigitalLbl = htmlEl('span', { class: 'digital-lbl' }, swDigital)
  const swDigitalVal = htmlEl('span', { class: 'digital-val' }, swDigital)
  const setSwDigitalLbl = textSetter(swDigitalLbl)
  const setSwDigitalVal = textSetter(swDigitalVal)
  const setSwTime = textSetter(swTime)
  const setSwText = classSetter(swTime, 'is-text')
  const setSwSettled = textSetter(swSettled)
  const setSettledOn = classSetter(swSettled, 'is-on')
  const setSettledMode = attrSetter(swSettled, 'data-mode')

  const speed = card('speed', 'card-speed')
  const speedHead = htmlEl('h3', {}, speed)
  const speedGroup = htmlEl('div', { class: 'seg', role: 'radiogroup' }, speed)
  const speedHelp = htmlEl('p', { class: 'ctl-help' }, speed)
  relabelers.push(() => { speedHead.textContent = S().speed; speedGroup.setAttribute('aria-label', S().speed); speedHelp.textContent = S().speedHelp })
  const SPEEDS: Speed[] = [1, 5, 20]
  const speedBtns = SPEEDS.map((sp) => {
    const b = htmlEl('button', { type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: -1, class: `seg-btn${sp === 20 ? ' only-explore' : ''}` }, speedGroup)
    relabelers.push(() => { b.textContent = fill(S().speedOption, { n: sp }) })
    listen(b, 'click', () => { a.setSpeed(sp); update() })
    listen(b, 'keydown', (e: KeyboardEvent) => {
      const avail = SPEEDS.filter((x) => !(a.mode === 'lab' && x === 20))
      const i = avail.indexOf(sp)
      const j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : -1
      if (j < 0 || j >= avail.length) return
      e.preventDefault()
      a.setSpeed(avail[j]!)
      update()
      speedBtns[SPEEDS.indexOf(avail[j]!)]!.el.focus()
    })
    return { el: b, chk: attrSetter(b, 'aria-checked'), tab: attrSetter(b, 'tabindex') }
  })

  // ---------------------------------------------------------------- update
  let builtMode: string | null = null

  const setBadgeShown = setBadgeKind
  const update = (): void => {
    const r = a.readout()
    if (r.mode !== builtMode) { builtMode = r.mode; wrap.dataset.mode = r.mode }
    const hasReleased = a.hasReleased
    const s = S()

    if (r.meterRange !== builtRange) { builtRange = r.meterRange; buildTicks(r.meterRange); wrap.classList.toggle('meter-off', r.meterRange === 'OFF') }
    const off = r.meterRange === 'OFF'
    unitText.textContent !== s.unitVdc && (unitText.textContent = s.unitVdc)
    const rt = off ? '' : fill(s.rangeOption, { v: String(r.meterRange).replace('.', ctx.lang() === 'es' ? ',' : '.') })
    rangeText.textContent !== rt && (rangeText.textContent = rt)
    setNeedle(needleAngleDeg(off ? 0 : r.needleFraction))
    if (off) { setBadgeText(s.meterOff); setBadgeShown('off') }
    else if (r.overRange) { setBadgeText(s.overRange); setBadgeShown('over') }
    else { setBadgeShown('') }
    const nt = needleText(r)
    const lbl = `${s.meterLabel}. ${nt}`
    if (lbl !== labelText) { labelText = lbl; setSvgLabel(lbl) }
    if (r.mode === 'lab') {
      const now = performance.now()
      if (announceDue(liveText, nt, liveAt, now)) { liveText = nt; liveAt = now; live.textContent = nt }
    } else if (liveText !== '') { liveText = ''; live.textContent = '' }
    if (r.mode === 'explore' && r.needleValue_V !== null) { setDigitalLbl(`${s.digital}: `); setDigitalVal(`${fmtNum(r.needleValue_V, 3, ctx.lang())} V`) }
    else { setDigitalLbl(''); setDigitalVal('') }
    if (r.mode === 'explore' && r.needleValue_V !== null) { setSwDigitalLbl(`${s.digital}: `); setSwDigitalVal(`${fmtNum(r.needleValue_V, 3, ctx.lang())} V`) }
    else { setSwDigitalLbl(''); setSwDigitalVal('') }
    RANGES.forEach((rg, i) => {
      const on = rg === r.meterRange
      rangeFlags[i]!.chk(String(on))
      rangeFlags[i]!.tab(on ? 0 : -1)
    })

    setKeyPressed(r.keyPressed)
    setKeyAria(String(r.keyPressed))
    setKeyText(r.keyPressed ? s.keyHold : s.keyLabel)

    setSwText(r.keyPressed || !hasReleased)
    setSwTime(r.keyPressed || !hasReleased ? (hasReleased ? s.held : s.stopwatchIdle) : formatStopwatch(r.elapsedSinceRelease_s))
    setSettledMode(r.mode)
    const settled = r.settled && hasReleased
    setSettledOn(settled)
    setSwSettled(settled ? (r.mode === 'lab' ? s.settledHint : s.settled) : '')

    const speedOn = SPEEDS.map((sp) => (r.mode !== 'lab' || sp !== 20 ? a.speed === sp : false))
    const speedTab = speedOn.includes(true) ? speedOn.indexOf(true) : 0
    SPEEDS.forEach((_, i) => {
      speedBtns[i]!.chk(String(speedOn[i]))
      speedBtns[i]!.tab(i === speedTab ? 0 : -1)
    })
  }

  const relabel = (): void => { for (const f of relabelers) f(); builtRange = null; labelText = ''; liveText = ''; liveAt = -Infinity; update() }
  relabel()

  return {
    update,
    relabel,
    destroy() {
      for (const c of cleanups) c()
      wrap.remove()
    },
  }
}
