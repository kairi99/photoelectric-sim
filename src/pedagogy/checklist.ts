// Procedure checklist (leaflet steps). Pure: ticks come from apparatus state and procedureLog, no DOM.
import type { Apparatus } from '../apparatus/index.ts'
import { VISIBLE_LINES } from './task.ts'

export type ChecklistId = 'lamp' | 'meter' | 'line' | 'discharge' | 'release' | 'wait' | 'record' | 'lines' | 'fit'
export const CHECKLIST_IDS: readonly ChecklistId[] = ['lamp', 'meter', 'line', 'discharge', 'release', 'wait', 'record', 'lines', 'fit']

export interface ChecklistItem {
  id: ChecklistId
  done: boolean
  /** Optional progress, e.g. "2/4" for the lines step. */
  detail?: string
}

function distinctLines(a: Apparatus): number {
  const s = new Set<string>()
  for (const m of a.measurements) if (m.lineId && (VISIBLE_LINES as readonly string[]).includes(m.lineId)) s.add(m.lineId)
  return s.size
}

/**
 * Steps 4-7 describe the latest measurement cycle: it starts at the last 'discharged' log entry, so a new
 * discharge clears them for the next line while a finished cycle stays ticked.
 */
export function checklistState(a: Apparatus): ChecklistItem[] {
  const log = a.procedureLog
  let d = -1
  for (let i = log.length - 1; i >= 0; i--) if (log[i]!.action === 'discharged') { d = i; break }
  const after = (from: number, action: string): number => {
    if (from < 0) return -1
    for (let i = from + 1; i < log.length; i++) if (log[i]!.action === action) return i
    return -1
  }
  const r = after(d, 'released')
  const w = after(r, 'waited')
  const rec = after(r, 'recorded')
  const n = distinctLines(a)
  const fit = a.fitResult()
  const r0 = a.readout()
  const line = r0.lineOnCell
  return [
    { id: 'lamp', done: a.lampOn && r0.lampBrightness >= 0.99 },
    { id: 'meter', done: a.meterRange === 3 },
    { id: 'line', done: line !== null && line !== 'uv' },
    { id: 'discharge', done: d >= 0 },
    { id: 'release', done: r >= 0 },
    { id: 'wait', done: w >= 0 || (r >= 0 && a.isSettled()) },
    { id: 'record', done: rec >= 0 },
    { id: 'lines', done: n >= 4, detail: `${Math.min(n, 4)}/4` },
    { id: 'fit', done: n >= 4 && fit !== null },
  ]
}

/** Index of the first step not done (the "you are here" marker); -1 when all are done. */
export function currentStep(items: ChecklistItem[]): number {
  return items.findIndex((i) => !i.done)
}

// ---- DOM ------------------------------------------------------------------------------------
import type { ViewContext } from '../views/view.ts'
import { el } from './dom.ts'
import { fmt, pt } from './strings.ts'

export interface ChecklistView {
  el: HTMLElement
  update(): void
  relabel(): void
}

/**
 * 'full': numbered list for the Learn drawer. 'strip': compact progress strip near the panel
 * (dots plus the current step). Both read the same pure `checklistState`.
 */
export function createChecklist(ctx: ViewContext, variant: 'full' | 'strip'): ChecklistView {
  const a = ctx.apparatus
  const root = el('div', variant === 'full' ? 'proc' : 'proc-strip')
  let sig = ''
  const render = (): void => {
    const s = pt(ctx.lang())
    const items = checklistState(a)
    const cur = currentStep(items)
    const nDone = items.filter((i) => i.done).length
    root.replaceChildren()
    if (variant === 'full') {
      const ol = el('ol', 'proc-list', root)
      items.forEach((it, i) => {
        const li = el('li', `proc-item${it.done ? ' is-done' : ''}${i === cur ? ' is-current' : ''}`, ol)
        if (i === cur) li.setAttribute('aria-current', 'step')
        el('span', 'proc-mark', li).textContent = it.done ? '✓' : String(i + 1)
        const txt = el('span', 'proc-text', li)
        txt.textContent = s.checklist.steps[it.id]
        if (it.detail && !it.done) el('span', 'proc-detail', li).textContent = it.detail
        if (it.done) el('span', 'visually-hidden', li).textContent = ` (${s.ui.done})`
        if (i === cur) el('span', 'proc-now', li).textContent = s.ui.procedureNow
      })
    } else {
      root.setAttribute('role', 'group')
      root.setAttribute('aria-label', s.checklist.title)
      const dots = el('span', 'proc-dots', root)
      dots.setAttribute('aria-hidden', 'true')
      items.forEach((it, i) => el('span', `proc-dot${it.done ? ' is-done' : ''}${i === cur ? ' is-current' : ''}`, dots))
      const label = el('span', 'proc-now-text', root)
      label.textContent = cur >= 0 ? `${cur + 1}/${items.length} · ${s.checklist.steps[items[cur]!.id]}` : `✓ ${s.checklist.steps.fit}`
      root.title = fmt(s.checklist.progress, { n: nDone, total: items.length })
    }
  }
  const update = (): void => {
    const items = checklistState(a)
    const next = `${ctx.lang()}|${items.map((i) => (i.done ? 1 : 0) + (i.detail ?? '')).join('')}`
    if (next === sig) return
    sig = next
    render()
  }
  const relabel = (): void => { sig = ''; update() }
  relabel()
  return { el: root, update, relabel }
}
