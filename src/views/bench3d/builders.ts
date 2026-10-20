// Extension point of the 3D bench. scene.ts calls every builder in BUILDERS once with a BuildCtx and then drives it.
//
// To replace a placeholder: edit only your own file (optics.ts or electrics.ts) and keep its `buildOptics` /
// `buildElectrics` export. A builder owns everything it adds to `ctx.scene` and removes it in `dispose()`.
import type * as THREE from 'three'
import type { Apparatus, Readout } from '../../apparatus/index.ts'
import type { Materials } from './materials.ts'
import type { PartRegistry } from './parts.ts'
import type { Units } from './units.ts'
import type { Lang } from '../../i18n.ts'
import type { PresetName } from './scene.ts'
import { buildOptics } from './optics.ts'
import { buildElectrics } from './electrics.ts'

export interface BuildCtx {
  scene: THREE.Scene
  /** The three.js namespace (the lazy chunk's single copy; builders should use this instead of importing 'three'). */
  three: typeof THREE
  materials: Materials
  parts: PartRegistry
  units: Units
  /** Ask for one more render. The scene renders on demand: call this whenever you change something outside `update`. */
  requestRender: () => void
  /** Current UI language (for text drawn on textures: decimal comma in Spanish). Redraw in `relabel()`. */
  lang: () => Lang
  /** Camera preset the user last chose (stays set while orbiting). */
  preset: () => PresetName | null
  /** True while the pointer hovers a part (number tags show up then). */
  hovering: () => boolean
}

export interface BuiltModel {
  /** Called once on mount and again whenever the readout (or windowCover / beamIntensity / cathode) changed. */
  update(readout: Readout, a: Apparatus): void
  /** Optional: redraw anything drawn with text after a language change. */
  relabel?(): void
  /** Optional per-frame hook for animations (dt in s); call ctx.requestRender() while something is moving. */
  tick?(dt_s: number): void
  /** Remove from the scene and dispose geometries, textures and any materials the builder created itself. */
  dispose(): void
}

export type Builder = (ctx: BuildCtx) => BuiltModel

/** Register new builders here (order = build order). */
export const BUILDERS: Builder[] = [buildOptics, buildElectrics]
