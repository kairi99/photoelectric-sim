// Pure controller of the 3D handles (no three.js, no DOM): turns pointer positions on the bench into apparatus calls.
// interaction.ts does the picking and the plane intersections; this module holds the maths and the apparatus calls, so
// both can be tested with a fake apparatus.
import type { MeterRange } from '../../apparatus/index.ts'
import { KNOB_RANGES, KNOB_STEP_DEG } from './electrics/layout.ts'
import { ARM_PIVOT, TRI_A, TRI_C, WINDOW_LEN, WINDOW_U, windowPoint, type XZ } from './optics/helpers.ts'

/** The slice of Apparatus the 3D handles use. A fake with these members is enough for tests. */
export interface BenchActions {
  armPosition: number
  windowCover: number
  lampOn: boolean
  meterRange: MeterRange
  setArm(position: number): void
  setWindowCover(c: number): void
  setLamp(on: boolean): void
  setRange(r: MeterRange): void
  pressKey(): void
  releaseKey(): void
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const cross = (a: XZ, b: XZ): number => a.x * b.z - a.z * b.x

/**
 * Inverse of the arm aim: the window position `t` (0..1) the arm points at when it is turned towards the xz point
 * (x, z). The arm swings about ARM_PIVOT, so the point is projected from the pivot onto the window edge A-C
 * (a pointer on the knob maps to the position the arm then really has). windowPoint(t) maps back to t exactly.
 * A point behind the pivot, or in line with the edge, falls back to the nearest point of the edge.
 */
export function armPositionFromPoint(x: number, z: number): number {
  const d: XZ = { x: x - ARM_PIVOT.x, z: z - ARM_PIVOT.z }
  const w: XZ = { x: TRI_A.x - TRI_C.x, z: TRI_A.z - TRI_C.z }
  const c: XZ = { x: TRI_C.x - ARM_PIVOT.x, z: TRI_C.z - ARM_PIVOT.z }
  const den = cross(w, d)
  if (Math.abs(den) > 1e-9) {
    const t = cross(d, c) / den
    // s = distance along the ray; s > 0 means the edge is in front of the pivot along the pointer direction
    const s = cross(c, w) / cross(d, w)
    if (s > 0) return clamp01(t)
  }
  return clamp01(((x - TRI_C.x) * WINDOW_U.x + (z - TRI_C.z) * WINDOW_U.z) / WINDOW_LEN)
}

/** Fraction of the window edge that the dimming slider's travel uses (the panel is 94 % of the edge, see optics.ts). */
export const WINDOW_COVER_SPAN = 0.94
/** Cover (0..1) for a point of the window plane at distance `along_cm` from the edge midpoint, positive towards A. The slider is anchored at C. */
export function windowCoverFromAlong(along_cm: number): number {
  return clamp01((along_cm / (WINDOW_LEN * WINDOW_COVER_SPAN)) + 0.5)
}
/** Same, from a world xz point (the point is projected on the edge). */
export function windowCoverFromPoint(x: number, z: number): number {
  const mid = windowPoint(0.5)
  return windowCoverFromAlong((x - mid.x) * WINDOW_U.x + (z - mid.z) * WINDOW_U.z)
}

/** The detent `dir` steps away from `range` (+1 up, -1 down), clamped at OFF and at the top range. */
export function steppedRange(range: MeterRange, dir: 1 | -1): MeterRange {
  const i = KNOB_RANGES.indexOf(range)
  const j = Math.min(KNOB_RANGES.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))
  return KNOB_RANGES[j]!
}
/** Detent nearest to a pointer angle (deg, clockwise from straight up). */
export function rangeFromAngle(angle_deg: number): MeterRange {
  const half = (KNOB_RANGES.length - 1) / 2
  const i = Math.round(angle_deg / KNOB_STEP_DEG + half)
  return KNOB_RANGES[Math.min(KNOB_RANGES.length - 1, Math.max(0, i))]!
}
/** Detent for a pointer at (u, v) in the knob frame (u right, v up, any scale). */
export function rangeFromKnobPoint(u: number, v: number): MeterRange {
  return rangeFromAngle((Math.atan2(u, v) * 180) / Math.PI)
}

/** Position change of one mouse-wheel notch over the arm knob (fine adjustment; the slider's arrow-key step). */
export const ARM_WHEEL_STEP = 0.002
const ARM_NOTCH_CLAMP = 5

export interface BenchController {
  beginArmDrag(x: number, z: number): void
  dragArm(x: number, z: number): void
  /** One wheel notch (deltaY > 0 moves towards position 0, like scrolling down a slider). */
  nudgeArm(deltaY: number): void
  beginCoverDrag(x: number, z: number): void
  dragCover(x: number, z: number): void
  pressKey(): void
  releaseKey(): void
  toggleLamp(): void
  stepRange(dir: 1 | -1): void
  dragRange(u: number, v: number): void
}

export function createController(a: BenchActions): BenchController {
  // grab offsets keep the handle from jumping to the pointer when it is grabbed off-centre
  let armOffset = 0, coverOffset = 0
  return {
    beginArmDrag(x, z) { armOffset = a.armPosition - armPositionFromPoint(x, z) },
    dragArm(x, z) { a.setArm(clamp01(armPositionFromPoint(x, z) + armOffset)) },
    nudgeArm(deltaY) {
      const n = Math.min(ARM_NOTCH_CLAMP, Math.max(1, Math.round(Math.abs(deltaY) / 100)))
      a.setArm(a.armPosition + (deltaY > 0 ? -1 : 1) * n * ARM_WHEEL_STEP)
    },
    beginCoverDrag(x, z) { coverOffset = a.windowCover - windowCoverFromPoint(x, z) },
    dragCover(x, z) { a.setWindowCover(clamp01(windowCoverFromPoint(x, z) + coverOffset)) },
    pressKey() { a.pressKey() },
    releaseKey() { a.releaseKey() },
    toggleLamp() { a.setLamp(!a.lampOn) },
    stepRange(dir) {
      const next = steppedRange(a.meterRange, dir)
      if (next !== a.meterRange) a.setRange(next)
    },
    dragRange(u, v) {
      if (Math.hypot(u, v) < 1e-6) return
      const next = rangeFromKnobPoint(u, v)
      if (next !== a.meterRange) a.setRange(next)
    },
  }
}
