// Panel view: key switch, electrometer amplifier, analog multimeter dial, stopwatch and time speed.
import '../styles/panel.css'
import type { MeterRange, Speed } from '../apparatus/index.ts'
import type { MountView, View } from './view.ts'
import { strings } from './strings/panel.ts'
import {
  attrSetter, classSetter, fill, fmtNum, formatStopwatch, htmlEl, needleAngleDeg, scaleTicks, svgEl, textSetter,
} from './benchkit.ts'

const RANGES: MeterRange[] = ['OFF', 0.1, 0.3, 1, 3, 10, 30]
let uid = 0
const DIAL = { cx: 150, cy: 168, r: 118 }

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
  const svg = svgEl('svg', { viewBox: '0 0 300 190', class: 'dial-svg', role: 'img' }, dial)
  relabelers.push(() => svg.setAttribute('aria-label', S().meterLabel))
  const ptAt = (f: number, r: number) => {
    const t = (needleAngleDeg(f) * Math.PI) / 180
    return { x: DIAL.cx + r * Math.sin(t), y: DIAL.cy - r * Math.cos(t) }
  }
  const p0 = ptAt(0, DIAL.r), p1 = ptAt(1, DIAL.r)
  svgEl('path', { d: `M${p0.x} ${p0.y} A${DIAL.r} ${DIAL.r} 0 0 1 ${p1.x} ${p1.y}`, class: 'dial-arc' }, svg)
  const ticksG = svgEl('g', { class: 'dial-ticks' }, svg)
  const unitText = svgEl('text', { x: 14, y: 182, class: 'dial-unit', 'text-anchor': 'start' }, svg)
  const rangeText = svgEl('text', { x: 286, y: 182, class: 'dial-range', 'text-anchor': 'end' }, svg)
  const needle = svgEl('g', { class: 'dial-needle' }, svg)
  svgEl('line', { x1: DIAL.cx, y1: DIAL.cy + 14, x2: DIAL.cx, y2: DIAL.cy - DIAL.r + 6, class: 'dial-needle-line' }, needle)
  svgEl('circle', { cx: DIAL.cx, cy: DIAL.cy, r: 7, class: 'dial-hub' }, svg)
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
      const a0 = ptAt(t.fraction, DIAL.r), a1 = ptAt(t.fraction, DIAL.r - (t.major ? 14 : 8))
      svgEl('line', { x1: a0.x, y1: a0.y, x2: a1.x, y2: a1.y, class: t.major ? 'tick-major' : 'tick-minor' }, ticksG)
      if (t.label !== null) {
        const l = ptAt(t.fraction, DIAL.r - 28)
        const el = svgEl('text', { x: l.x, y: l.y + 4, class: 'dial-num', 'text-anchor': 'middle' }, ticksG)
        el.textContent = t.label.replace('.', ctx.lang() === 'es' ? ',' : '.')
      }
    }
  }
  const badge = htmlEl('p', { class: 'dial-badge', role: 'status' }, dial)
  const setBadgeText = textSetter(badge)
  const setBadgeKind = (() => { let l = ''; return (k: string) => { if (k !== l) { l = k; badge.dataset.kind = k; badge.hidden = k === '' } } })()
  const digital = htmlEl('p', { class: 'digital only-explore' }, meter)
  const setDigital = textSetter(digital)

  const rangeGroup = htmlEl('div', { class: 'seg seg-range', role: 'radiogroup' }, meter)
  relabelers.push(() => rangeGroup.setAttribute('aria-label', S().rangeGroup))
  const rangeBtns = RANGES.map((rg) => {
    const b = htmlEl('button', { type: 'button', role: 'radio', 'aria-checked': 'false', class: 'seg-btn', tabindex: -1 }, rangeGroup)
    relabelers.push(() => {
      const num = String(rg).replace('.', ctx.lang() === 'es' ? ',' : '.')
      b.textContent = rg === 'OFF' ? S().rangeOff : num
      b.setAttribute('aria-label', rg === 'OFF' ? S().rangeOff : fill(S().rangeOption, { v: num }))
    })
    listen(b, 'click', () => a.setRange(rg))
    listen(b, 'keydown', (e: KeyboardEvent) => {
      const i = RANGES.indexOf(rg)
      const j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : -1
      if (j < 0 || j >= RANGES.length) return
      e.preventDefault()
      a.setRange(RANGES[j]!)
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
    const b = htmlEl('button', { type: 'button', role: 'radio', 'aria-checked': 'false', class: `seg-btn${sp === 20 ? ' only-explore' : ''}` }, speedGroup)
    relabelers.push(() => { b.textContent = fill(S().speedOption, { n: sp }) })
    listen(b, 'click', () => a.setSpeed(sp))
    return { chk: attrSetter(b, 'aria-checked') }
  })

  // ---------------------------------------------------------------- update
  let builtMode: string | null = null
  let hasReleased = false
  let lastClock = 0
  cleanups.push(a.on('release', () => { hasReleased = true }))

  const setBadgeShown = setBadgeKind
  const update = (): void => {
    const r = a.readout()
    if (r.mode !== builtMode) { builtMode = r.mode; wrap.dataset.mode = r.mode }
    if (r.clock_s < lastClock) hasReleased = false
    lastClock = r.clock_s
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
    if (r.mode === 'explore' && r.needleValue_V !== null) setDigital(`${s.digital}: ${fmtNum(r.needleValue_V, 3, ctx.lang())} V`)
    else setDigital('')
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

    SPEEDS.forEach((sp, i) => speedBtns[i]!.chk(String(r.mode !== 'lab' || sp !== 20 ? a.speed === sp : false)))
  }

  const relabel = (): void => { for (const f of relabelers) f(); builtRange = null; update() }
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
