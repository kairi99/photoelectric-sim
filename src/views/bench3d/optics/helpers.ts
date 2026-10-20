// Pure helpers of the 3D optics (no three.js, no DOM): window geometry, arm pose, knob angle, smoothing.
// Coordinates follow units.ts: cm, y up, x left->right, z back->front.
import { ARM_SPAN_DEG } from '../../benchkit.ts'
import { DEG, yawToward } from '../units.ts'

export interface XZ { x: number; z: number }

/** Footprint of the triangular housing (cm) and its height. */
export const TRI_A: XZ = { x: -12.6, z: 1.6 }
export const TRI_B: XZ = { x: 12.5, z: 1.6 }
export const TRI_C: XZ = { x: -6.6, z: 14.8 }
export const TRI_HEIGHT = 9

/** Pivot of the swivelling arm 9 (under the mirror corner) and the direction it points at position 0.5. */
export const ARM_PIVOT: XZ = { x: 10, z: -2 }
export const ARM_DIR: XZ = { x: -0.799, z: 0.602 }
export const ARM_LENGTH = 20.8
/** Height of the arm axis (lens 10 and cathode) and of the spectrum on the window. */
export const ARM_Y = 3.8

/** Length of the emission-window edge A-C. */
export const WINDOW_LEN = Math.hypot(TRI_C.x - TRI_A.x, TRI_C.z - TRI_A.z)
/** Unit vector along the window edge, pointing from C towards A (the direction in which `position` grows). */
export const WINDOW_U: XZ = { x: (TRI_A.x - TRI_C.x) / WINDOW_LEN, z: (TRI_A.z - TRI_C.z) / WINDOW_LEN }

/**
 * World xz of the spectrum position `t` (0..1) on window edge A-C. t = 0 is the C end, t = 1 the A end: this is the
 * end the arm swings towards as `armPosition` grows, so the arm always points at the line it selects.
 */
export function windowPoint(t: number): XZ {
  const k = Math.min(1, Math.max(0, t))
  return { x: TRI_C.x + (TRI_A.x - TRI_C.x) * k, z: TRI_C.z + (TRI_A.z - TRI_C.z) * k }
}

/** Arm rotation (rad, about y) in the 2D bench convention: 0 at position 0.5, ARM_SPAN_DEG over the full range, clockwise seen from above as position grows. */
export function armSwingRad(position: number, span_deg: number = ARM_SPAN_DEG): number {
  return -(Math.min(1, Math.max(0, position)) - 0.5) * span_deg * DEG
}

/**
 * Yaw (rad about y) of the 3D arm at `position`: the arm aims from its pivot at the window spot of the same position.
 * Same sense as the 2D bench (the yaw falls as the position grows). The window only spans about 36 degrees seen from the
 * pivot, so the 3D sweep is narrower than the 100 degrees of the 2D drawing: it is the geometric aim, not the drawing span.
 */
export function armAimYaw(position: number): number {
  const p = windowPoint(position)
  return yawToward(p.x - ARM_PIVOT.x, p.z - ARM_PIVOT.z)
}

/** Total knob rotation over the full arm range, in turns. */
export const KNOB_TURNS = 2
/** Rotation of the thread-guide knob about its axis: proportional to the arm position (turns the arm swings with it). */
export function knobAngleRad(position: number): number {
  return -(Math.min(1, Math.max(0, position)) - 0.5) * KNOB_TURNS * 2 * Math.PI
}

/** One exact step of a critically damped spring (position x, velocity v) towards `target`; stable for any dt. */
export function dampStep(x: number, v: number, target: number, omega: number, dt_s: number): { x: number; v: number } {
  const e = x - target
  const k = v + omega * e
  const decay = Math.exp(-omega * dt_s)
  return { x: target + (e + k * dt_s) * decay, v: (v - omega * k * dt_s) * decay }
}
/** Spring constant giving a settling time of roughly 150 ms. */
export const ARM_OMEGA = 32
