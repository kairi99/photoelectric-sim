// First-run tour: spotlight plus a coach card. Keyboard: Right/Enter next, Left back, Escape skips, Tab stays inside.
import type { ViewContext } from '../views/view.ts'
import { button, el, store } from './dom.ts'
import { fmt, pt } from './strings.ts'

export const TOUR_KEY = 'photoelectric-tour-done'
export type TourStepId = 'bench' | 'arm' | 'lamp' | 'meter' | 'key' | 'table' | 'charts' | 'learn'
export const TOUR_STEPS: ReadonlyArray<{ id: TourStepId; selector: string }> = [
  { id: 'bench', selector: '[data-region="bench"] svg' },
  { id: 'arm', selector: '[data-ctl="arm"]' },
  { id: 'lamp', selector: '[data-ctl="lamp"]' },
  { id: 'meter', selector: '[data-ctl="range"]' },
  { id: 'key', selector: '[data-ctl="key"]' },
  { id: 'table', selector: '[data-region="table"]' },
  { id: 'charts', selector: '[data-region="charts"]' },
  { id: 'learn', selector: '[data-tour="learn"]' },
]

export interface Tour {
  start(): void
  /** True on a first visit (nothing stored). */
  shouldAutoStart(): boolean
  relabel(): void
  isOpen(): boolean
}

const PAD = 6

export function mountTour(ctx: ViewContext, hooks: { onClose?: () => void } = {}): Tour {
  let root: HTMLElement | null = null
  let idx = 0
  let steps: Array<{ id: TourStepId; target: HTMLElement }> = []
  let opener: HTMLElement | null = null
  let raf = 0
  let spot: HTMLElement
  let card: HTMLElement
  let title: HTMLElement
  let body: HTMLElement
  let count: HTMLElement
  let backBtn: HTMLButtonElement
  let nextBtn: HTMLButtonElement
  let skipBtn: HTMLButtonElement

  const place = (): void => {
    if (!root) return
    const step = steps[idx]
    if (!step) return
    const r = step.target.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x0 = Math.max(0, r.left - PAD)
    const y0 = Math.max(0, r.top - PAD)
    const x1 = Math.min(vw, r.right + PAD)
    const y1 = Math.min(vh, r.bottom + PAD)
    Object.assign(spot.style, { left: `${x0}px`, top: `${y0}px`, width: `${Math.max(0, x1 - x0)}px`, height: `${Math.max(0, y1 - y0)}px` })
    const below = (y0 + y1) / 2 < vh / 2
    card.dataset.pos = below ? 'bottom' : 'top'
  }
  const loop = (): void => { place(); raf = requestAnimationFrame(loop) }

  const show = (i: number): void => {
    idx = Math.min(Math.max(0, i), steps.length - 1)
    const s = pt(ctx.lang())
    const step = steps[idx]!
    const txt = s.tour.steps[step.id]
    title.textContent = txt.title
    body.textContent = txt.body
    count.textContent = fmt(s.tour.stepOf, { n: idx + 1, total: steps.length })
    backBtn.textContent = s.tour.back
    backBtn.hidden = idx === 0
    nextBtn.textContent = idx === steps.length - 1 ? s.tour.finish : s.tour.next
    skipBtn.textContent = s.tour.skip
    step.target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: ctx.reducedMotion() ? 'auto' : 'smooth' })
    place()
    nextBtn.focus({ preventScroll: true })
  }

  const close = (): void => {
    if (!root) return
    cancelAnimationFrame(raf)
    root.remove()
    root = null
    store.set(TOUR_KEY, '1')
    document.removeEventListener('keydown', onKey, true)
    opener?.focus({ preventScroll: true })
    hooks.onClose?.()
  }
  const next = (): void => { if (idx >= steps.length - 1) close(); else show(idx + 1) }

  function onKey(e: KeyboardEvent): void {
    if (!root) return
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1) }
    else if (e.key === 'Tab') {
      const f = [backBtn, nextBtn, skipBtn].filter((b) => !b.hidden)
      const at = f.indexOf(document.activeElement as HTMLButtonElement)
      e.preventDefault()
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length]!.focus({ preventScroll: true })
    }
  }

  return {
    shouldAutoStart: () => store.get(TOUR_KEY) === null,
    isOpen: () => root !== null,
    relabel() { if (root) show(idx) },
    start() {
      if (root) return
      steps = TOUR_STEPS.map((t) => ({ id: t.id, target: document.querySelector<HTMLElement>(t.selector)! }))
        .filter((t) => t.target && t.target.getBoundingClientRect().width > 0)
      if (steps.length === 0) return
      opener = document.activeElement as HTMLElement | null
      root = el('div', 'tour', document.body)
      spot = el('div', 'tour-spot', root)
      card = el('div', 'tour-card', root)
      card.setAttribute('role', 'dialog')
      card.setAttribute('aria-modal', 'true')
      card.setAttribute('aria-label', pt(ctx.lang()).tour.label)
      count = el('p', 'tour-count', card)
      title = el('h2', 'tour-title', card)
      body = el('p', 'tour-body', card)
      const row = el('div', 'tour-actions', card)
      skipBtn = button('', 'tour-skip', row, close)
      backBtn = button('', 'tour-back', row, () => show(idx - 1))
      nextBtn = button('', 'tour-next', row, next)
      document.addEventListener('keydown', onKey, true)
      raf = requestAnimationFrame(loop)
      show(0)
    },
  }
}
