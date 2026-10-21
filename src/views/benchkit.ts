// Small DOM and geometry helpers shared by the bench and panel views. Geometry here is drawing math only
// (angles, arc points, tick layout); no physics.
import type { Lang } from '../i18n.ts'
import { NEEDLE_MIN_FRAC } from '../apparatus/index.ts'

const SVGNS = 'http://www.w3.org/2000/svg'
type Attrs = Record<string, string | number>

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  parent?.append(el)
  return el
}
export function htmlEl<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  parent?.append(el)
  return el
}

/** Returns a setter that touches the DOM only when the value actually changed. */
export function attrSetter(el: Element, name: string): (v: string | number) => void {
  let last: string | undefined
  return (v) => {
    const s = String(v)
    if (s !== last) {
      last = s
      el.setAttribute(name, s)
    }
  }
}
export function textSetter(el: Node): (s: string) => void {
  let last: string | undefined
  return (s) => {
    if (s !== last) {
      last = s
      el.textContent = s
    }
  }
}
export function flagSetter(el: Element, name: string): (on: boolean) => void {
  let last: boolean | undefined
  return (on) => {
    if (on !== last) {
      last = on
      el.toggleAttribute(name, on)
    }
  }
}
export function classSetter(el: Element, cls: string): (on: boolean) => void {
  let last: boolean | undefined
  return (on) => {
    if (on !== last) {
      last = on
      el.classList.toggle(cls, on)
    }
  }
}

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
/** Round for attribute churn control. */
export const q2 = (x: number): number => Math.round(x * 100) / 100

const nf = new Map<string, Intl.NumberFormat>()
export function fmtNum(x: number, digits: number, lang: Lang): string {
  const key = `${lang}${digits}`
  let f = nf.get(key)
  if (!f) {
    f = new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    nf.set(key, f)
  }
  return f.format(x)
}
export const fill = (tpl: string, vars: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

// ---- bench geometry (drawing only) -------------------------------------------------------------
/** Total sweep of the swivelling arm in the drawing, degrees (arm position 0..1 maps to -50..+50). */
export const ARM_SPAN_DEG = 100
export function armAngleDeg(position: number): number {
  return (clamp(position, 0, 1) - 0.5) * ARM_SPAN_DEG
}
/** Point at `radius` along the arm and `lateral` to its right (screen coords), for badges that must not rotate. */
export function armPoint(position: number, radius: number, lateral: number, pivot: { x: number; y: number }): { x: number; y: number } {
  const a = (armAngleDeg(position) * Math.PI) / 180
  return {
    x: pivot.x + radius * Math.sin(a) + lateral * Math.cos(a),
    y: pivot.y - radius * Math.cos(a) + lateral * Math.sin(a),
  }
}
export function armPositionFromAngle(angle_deg: number): number {
  return clamp(angle_deg / ARM_SPAN_DEG + 0.5, 0, 1)
}
/** Point on a circle around the arm pivot, at the angle of an arm position (0 deg points straight up). */
export function arcPoint(position: number, radius: number, pivot: { x: number; y: number }): { x: number; y: number } {
  const a = (armAngleDeg(position) * Math.PI) / 180
  return { x: pivot.x + radius * Math.sin(a), y: pivot.y - radius * Math.cos(a) }
}
/** Angle (degrees from straight up) of a pointer relative to the pivot. */
export function pointerAngleDeg(px: number, py: number, pivot: { x: number; y: number }): number {
  return (Math.atan2(px - pivot.x, pivot.y - py) * 180) / Math.PI
}
/** Relative line intensity -> stroke opacity; perceptual (sqrt) so faint lines stay visible. */
export function opacityFromIntensity(intensity: number): number {
  return intensity <= 0 ? 0 : Math.min(1, Math.sqrt(intensity))
}

// ---- meter dial (drawing only) ----------------------------------------------------------------------
export const DIAL_SPAN_DEG = 110
export function needleAngleDeg(fraction: number): number {
  return (clamp(fraction, NEEDLE_MIN_FRAC, 1) - 0.5) * DIAL_SPAN_DEG
}
export interface Tick {
  fraction: number
  major: boolean
  label: string | null
}
const trimNum = (x: number): string => String(+x.toFixed(3))
/** Scale marks for a range: 1-type ranges (0.1, 1, 10) have 10 divisions, 3-type ranges (0.3, 3, 30) have 6.
 *  Each division carries 4 fine ticks (5 steps): 0.1 V on the 3 V range, 0.02 V on the 1 V range. */
export function scaleTicks(range_V: number): Tick[] {
  const threeType = [0.3, 3, 30].includes(range_V)
  const n = threeType ? 6 : 10
  const ticks: Tick[] = []
  const sub = 5
  for (let i = 0; i <= n * sub; i++) {
    const major = i % sub === 0
    const f = i / (n * sub)
    const div = i / sub
    // label every second division (0, 2, 4 ...) so labels never crowd
    ticks.push({ fraction: f, major, label: major && div % 2 === 0 ? trimNum(f * range_V) : null })
  }
  return ticks
}
/** Fine ticks per division on every scale (see scaleTicks). */
const FINE_PER_DIV = 5
/** Reading resolution of the scale, V: half a fine tick (0.05 V on 3 V, 0.01 V on 1 V). */
export function readingResolution_V(range_V: number): number {
  const n = [0.3, 3, 30].includes(range_V) ? 6 : 10
  return range_V / (n * FINE_PER_DIV) / 2
}
/** Needle value rounded to the reading resolution (what a sighted student can honestly read), never below zero. */
export function quantiseReading_V(value_V: number, range_V: number): number {
  const res = readingResolution_V(range_V)
  const q = Math.round(Math.max(0, value_V) / res) * res
  return +q.toFixed(6)
}
/** Decimals needed to print quantised readings on a range (2 for 0.05 and 0.01 V steps, 3 for 0.1 V ranges and below). */
export function readingDecimals(range_V: number): number {
  const res = readingResolution_V(range_V)
  return Math.max(2, Math.ceil(-Math.log10(res) - 1e-9))
}
/** True when an assistive-tech announcement is due: the text changed and the minimum gap has passed. */
export function announceDue(lastText: string, nextText: string, lastAt_ms: number, now_ms: number, minGap_ms = 1000): boolean {
  return nextText !== lastText && now_ms - lastAt_ms >= minGap_ms
}
export function formatStopwatch(t_s: number): string {
  const s = Math.max(0, t_s)
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}
