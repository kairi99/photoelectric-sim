// Pedagogy layer: wires the Learn drawer content, procedure strip, coach and tour to the app shell.
import type { View, ViewContext } from '../views/view.ts'
import { mountLearn } from './card.ts'
import type { LearnHost } from './card.ts'
import { createChecklist } from './checklist.ts'
import { mountCoach } from './coach.ts'
import { mountTour } from './tour.ts'

export { TASKS } from './tasks/index.ts'
export type { GuidedTask } from './task.ts'

export interface PedagogyOptions {
  ctx: ViewContext
  /** Element that receives the Learn drawer content (.learn-body). */
  learnBody: HTMLElement
  /** The panel region: the compact procedure strip is placed at its top. */
  panelRoot: HTMLElement
  /** Fixed bottom container for the task bar and the coach toast. */
  dock: HTMLElement
  learn: LearnHost
  views: () => View[]
  helpHref: () => string
}

export interface Pedagogy {
  update(): void
  relabel(): void
  startTour(): void
  openTask(id: string, step?: 0 | 1 | 2 | 3): void
  /** Start the tour on a first visit (call once the page is laid out). */
  maybeAutoTour(): void
}

export function mountPedagogy(o: PedagogyOptions): Pedagogy {
  const { ctx } = o
  const a = ctx.apparatus
  const tour = mountTour(ctx)
  const learn = mountLearn(o.learnBody, {
    ...ctx, views: o.views, learn: o.learn, dock: o.dock, helpHref: o.helpHref,
    startTour: () => { o.learn.close(); window.setTimeout(() => tour.start(), 360) },
  })
  const strip = createChecklist(ctx, 'strip')
  o.panelRoot.prepend(strip.el)
  const coach = mountCoach(o.dock, ctx)
  const syncStrip = (): void => { strip.el.hidden = a.mode !== 'lab' }
  a.on('mode', syncStrip)
  syncStrip()
  return {
    update() {
      strip.update()
      learn.update()
      coach.update()
    },
    relabel() { strip.relabel(); learn.relabel(); coach.relabel(); tour.relabel() },
    startTour: () => tour.start(),
    openTask: (id, step) => learn.openTask(id, step),
    maybeAutoTour() { if (tour.shouldAutoStart()) tour.start() },
  }
}
