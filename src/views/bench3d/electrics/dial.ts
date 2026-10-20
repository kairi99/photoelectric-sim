// Canvas drawing for the printed parts of the electrics: multimeter dial face, range-knob plate, amplifier front plate,
// small labels. Pure 2D-canvas code (takes a context), so the layout stays in layout.ts.
import type { MeterRange } from '../../../apparatus/index.ts'
import type { Lang } from '../../../i18n.ts'
import { DIAL_PIVOT_PX, DIAL_PX, MIRROR_R, KNOB_RANGES, PLATE, PLATE_CM, dialRangeFor, dialTickLayout, knobAngleDeg } from './layout.ts'

type G = CanvasRenderingContext2D
const INK = '#16181c'
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Decimal separator of the language on the printed numerals ('0,3' in Spanish). */
export const decimal = (text: string | number, lang: Lang): string => String(text).replace('.', lang === 'es' ? ',' : '.')

const polar = (angleDeg: number, rad: number, cx: number, cy: number): [number, number] => {
  const t = (angleDeg * Math.PI) / 180
  return [cx + rad * Math.sin(t), cy - rad * Math.cos(t)]
}

/** Dial face for a range (OFF shows the 3 V scale dimmed, as the 2D dial does). Same ticks, numerals and unit as the 2D panel. */
export function drawDial(g: G, range: MeterRange, lang: Lang = 'en'): void {
  const { w, h } = DIAL_PX
  const { x: cx, y: cy, r: R } = DIAL_PIVOT_PX
  const off = range === 'OFF'
  g.clearRect(0, 0, w, h)
  const bg = g.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#f6f2e6'); bg.addColorStop(1, '#ebe6d6')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.globalAlpha = off ? 0.55 : 1
  g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'butt'
  const half = 55
  // scale arc
  g.lineWidth = 7
  g.beginPath(); g.arc(cx, cy, R, ((-half - 90) * Math.PI) / 180, ((half - 90) * Math.PI) / 180); g.stroke()
  // mirror band: silver strip with thin dark edges, just inside the scale
  const mr = R * MIRROR_R, bw = 18
  const band = g.createLinearGradient(cx - mr, cy - mr, cx + mr, cy)
  band.addColorStop(0, '#fbfbfb'); band.addColorStop(0.5, '#bfc3c8'); band.addColorStop(1, '#f2f2f2')
  g.strokeStyle = band; g.lineWidth = bw
  g.beginPath(); g.arc(cx, cy, mr, ((-half - 90) * Math.PI) / 180, ((half - 90) * Math.PI) / 180); g.stroke()
  g.strokeStyle = INK; g.lineWidth = 1.5
  for (const d of [-bw / 2, bw / 2]) { g.beginPath(); g.arc(cx, cy, mr + d, ((-half - 90) * Math.PI) / 180, ((half - 90) * Math.PI) / 180); g.stroke() }
  // ticks and numerals
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `800 88px ${SANS}`
  for (const t of dialTickLayout(dialRangeFor(range))) {
    const [x0, y0] = polar(t.angleDeg, R, cx, cy), [x1, y1] = polar(t.angleDeg, R * t.innerR, cx, cy)
    g.strokeStyle = INK; g.lineWidth = t.major ? 10 : 5
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
    if (t.label !== null) { const [lx, ly] = polar(t.angleDeg, R * t.labelR, cx, cy); g.fillText(decimal(t.label, lang), lx, ly) }
  }
  // unit and range caption (same wording as the 2D dial's unit text)
  g.font = `800 84px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
  g.fillText('V DC', 70, h - 70)
  if (!off) { g.font = `700 60px ${SANS}`; g.textAlign = 'right'; g.fillText(`${decimal(range, lang)} V`, w - 70, h - 74) }
  g.globalAlpha = 1
}

/** Printed strip under the dial with the range labels around the knob. cx/cy are the knob centre in canvas px. */
export function drawKnobPlate(g: G, w: number, h: number, cx: number, cy: number, pxPerCm: number, lang: Lang = 'en'): void {
  g.clearRect(0, 0, w, h)
  g.fillStyle = '#25272c'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#f1efe8'; g.strokeStyle = '#f1efe8'; g.textAlign = 'center'; g.textBaseline = 'middle'
  const labelR = 1.7 * pxPerCm
  g.font = `700 ${Math.round(0.37 * pxPerCm)}px ${SANS}`
  for (const range of KNOB_RANGES) {
    const a = knobAngleDeg(range)
    const [lx, ly] = polar(a, labelR, cx, cy)
    g.fillText(range === 'OFF' ? 'OFF' : decimal(range, lang), lx, ly)
    const [t0x, t0y] = polar(a, 1.12 * pxPerCm, cx, cy), [t1x, t1y] = polar(a, 1.3 * pxPerCm, cx, cy)
    g.lineWidth = 3; g.beginPath(); g.moveTo(t0x, t0y); g.lineTo(t1x, t1y); g.stroke()
  }
  g.font = `700 ${Math.round(0.3 * pxPerCm)}px ${SANS}`
  g.fillText('V DC', cx + 3.7 * pxPerCm, cy)
  g.fillText('V DC', cx - 3.7 * pxPerCm, cy)
}

/** Amplifier front plate: op-amp symbol, offset knob legend, input and output markings, as in leaflet Fig. 2. */
export function drawAmpPlate(g: G, w: number, h: number): void {
  const k = w / PLATE_CM.w
  const X = (u: number): number => w / 2 + u * k, Y = (v: number): number => h / 2 - v * k
  g.fillStyle = '#ebe9e2'; g.fillRect(0, 0, w, h)
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 0.05 * k; g.lineJoin = 'round'; g.lineCap = 'round'
  g.strokeRect(0.25 * k, 0.25 * k, w - 0.5 * k, h - 0.5 * k)
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `600 ${0.42 * k}px ${SANS}`; g.fillText('532 14', X(3.6), Y(5.0))
  // op-amp triangle, with + and - inputs
  const tri: Array<[number, number]> = [[-1.4, 4.6], [-1.4, -0.4], [3.1, 2.1]]
  g.lineWidth = 0.08 * k
  g.beginPath(); tri.forEach(([u, v], i) => (i ? g.lineTo(X(u), Y(v)) : g.moveTo(X(u), Y(v)))); g.closePath(); g.stroke()
  g.lineWidth = 0.06 * k
  const line = (u0: number, v0: number, u1: number, v1: number): void => { g.beginPath(); g.moveTo(X(u0), Y(v0)); g.lineTo(X(u1), Y(v1)); g.stroke() }
  line(PLATE.bnc.u, PLATE.bnc.v, -1.4, 3.2) // input to +
  line(-2.2, 0.7, -1.4, 0.7); line(-2.2, 0.7, -2.2, -1.2); line(-2.2, -1.2, 1.0, -1.2); line(1.0, -1.2, 1.0, 0.8) // feedback-style return
  line(3.1, 2.1, PLATE.outRed.u, PLATE.outRed.v)
  g.font = `600 ${0.5 * k}px ${SANS}`
  g.fillText('+', X(-1.0), Y(3.2)); g.fillText('−', X(-1.0), Y(0.7))
  // output common line and ground symbol
  line(PLATE.outBlue.u, PLATE.outBlue.v, PLATE.outBlue.u - 0.8, PLATE.outBlue.v)
  line(PLATE.groundA.u, PLATE.groundA.v + 0.5, PLATE.groundA.u, PLATE.groundA.v + 1.2)
  for (let i = 0; i < 3; i++) line(PLATE.groundA.u - 0.5 + i * 0.15, PLATE.groundA.v + 1.2 + i * 0.12, PLATE.groundA.u + 0.5 - i * 0.15, PLATE.groundA.v + 1.2 + i * 0.12)
  // legends
  g.font = `500 ${0.34 * k}px ${SANS}`
  g.fillText('Offset', X(PLATE.offset.u), Y(PLATE.offset.v + 1.0))
  g.fillText('12 V ~', X(PLATE.supply.u), Y(PLATE.supply.v + 0.95))
  g.fillText('In', X(PLATE.bnc.u), Y(PLATE.bnc.v + 0.95))
  g.fillText('Out', X(PLATE.outRed.u - 0.2), Y(PLATE.outRed.v + 0.85))
  g.fillText('⏚', X(PLATE.groundA.u + 0.9), Y(PLATE.groundA.v))
}

/** Simple text label (choke 451 30, capacitor 100 pF, supply 12 V~). */
export function drawLabel(g: G, w: number, h: number, lines: string[], bg: string, ink: string): void {
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'
  const step = h / lines.length
  lines.forEach((t, i) => {
    g.font = `${i === 0 ? 700 : 500} ${Math.round(step * (i === 0 ? 0.62 : 0.5))}px ${SANS}`
    g.fillText(t, w / 2, step * (i + 0.5))
  })
}
