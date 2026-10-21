// Contract every view follows. A view renders Apparatus state; it never computes physics.
import type { Apparatus } from '../apparatus/index.ts'
import type { Lang } from '../i18n.ts'

/** Each view keeps its strings in its own `{ en, es }` pair with identical keys. */
export type Strings<T> = { en: T; es: T }

export interface ViewContext {
  apparatus: Apparatus
  lang: () => Lang
  /** True when the user asked for reduced motion (prefers-reduced-motion). */
  reducedMotion: () => boolean
}

export interface View {
  /** Called once per animation frame after apparatus.tick(); must not cause layout thrash. */
  update(): void
  /** Rebuild every label after a language change. */
  relabel(): void
  /** Optional: point out the controls a guided task needs (the 3D bench highlights their parts). Nothing is dimmed or disabled. */
  focus?(controls: string[] | null): void
  destroy(): void
}

export type MountView = (root: HTMLElement, ctx: ViewContext) => View
