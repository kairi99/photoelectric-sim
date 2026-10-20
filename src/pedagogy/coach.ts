// Contextual coach: decides which one-off nudge (if any) an event deserves. Pure: the toast lives in card.ts.
import type { Apparatus, Measurement } from '../apparatus/index.ts'
import { VISIBLE_LINES } from './task.ts'

export type CoachKey = 'releasedMeterOff' | 'overRange' | 'recordUnsettled' | 'lampWarming' | 'armBetween' | 'typedFar' | 'openFit'

/** A typed value further than this from the needle triggers "read the needle again" (V). */
export const TYPED_FAR_V = 0.15

export type CoachEvent =
  | { type: 'release' }
  | { type: 'record'; typed: number | undefined; measurement: Measurement }
  | { type: 'tick' }

/** Which nudge fits this event, in priority order (null = none). Callers apply the once-per-session rule. */
export function coachCandidates(a: Apparatus, e: CoachEvent): CoachKey[] {
  const out: CoachKey[] = []
  const r = a.readout()
  if (e.type === 'release') {
    if (a.meterRange === 'OFF') out.push('releasedMeterOff')
    if (a.lampOn && r.lampBrightness < 0.99) out.push('lampWarming')
    if (a.lampOn && (r.lineOnCell === null || r.lineOnCell === 'uv')) out.push('armBetween')
  } else if (e.type === 'record') {
    if (!e.measurement.settled) out.push('recordUnsettled')
    if (a.mode === 'lab' && e.typed !== undefined && r.needleValue_V !== null && Math.abs(e.typed - r.needleValue_V) > TYPED_FAR_V) out.push('typedFar')
    const lines = new Set(a.measurements.map((m) => m.lineId).filter((l) => l && (VISIBLE_LINES as readonly string[]).includes(l)))
    if (lines.size >= 4) out.push('openFit')
  } else if (a.overRange()) out.push('overRange')
  return out
}

export class Coach {
  private shown = new Set<CoachKey>()
  /** First candidate not yet shown this session; marks it shown. */
  pick(a: Apparatus, e: CoachEvent): CoachKey | null {
    for (const k of coachCandidates(a, e)) {
      if (!this.shown.has(k)) {
        this.shown.add(k)
        return k
      }
    }
    return null
  }
  reset(): void { this.shown.clear() }
}

// ---- DOM ------------------------------------------------------------------------------------
import type { ViewContext } from '../views/view.ts'
import { button, el } from './dom.ts'
import { pt } from './strings.ts'

export const COACH_VISIBLE_MS = 12000

/** Non-blocking toast in the dock. Each nudge shows at most once per session and can be dismissed. */
export function mountCoach(dock: HTMLElement, ctx: ViewContext): { update(): void; relabel(): void; destroy(): void } {
  const a = ctx.apparatus
  const coach = new Coach()
  const box = el('div', 'coach', dock)
  box.setAttribute('role', 'status')
  box.hidden = true
  const text = el('p', 'coach-text', box)
  const close = button('×', 'coach-close', box, () => hide())
  let current: CoachKey | null = null
  let timer = 0
  let lastTick = 0
  const label = (): void => {
    const s = pt(ctx.lang())
    close.setAttribute('aria-label', s.ui.dismiss)
    if (current) text.textContent = s.coach[current]
  }
  const hide = (): void => { box.hidden = true; current = null; window.clearTimeout(timer) }
  const show = (k: CoachKey | null): void => {
    if (!k) return
    current = k
    label()
    box.hidden = false
    window.clearTimeout(timer)
    timer = window.setTimeout(hide, COACH_VISIBLE_MS)
  }
  const offs = [
    a.on('release', () => show(coach.pick(a, { type: 'release' }))),
    a.on('record', (m) => show(coach.pick(a, { type: 'record', typed: m.U0_V, measurement: m }))),
    a.on('mode', () => hide()),
  ]
  return {
    update() {
      const now = performance.now()
      if (now - lastTick < 400) return
      lastTick = now
      show(coach.pick(a, { type: 'tick' }))
    },
    relabel: label,
    destroy() { for (const off of offs) off(); hide(); box.remove() },
  }
}
