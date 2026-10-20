// Pure layout helpers for the 3D electrics: knob detents, needle angle, dial tick layout, socket and cable coordinates.
// No three.js and no DOM here, so the numbers can be unit-tested. Units: cm, y up (see ../units.ts).
import type { MeterRange } from '../../../apparatus/index.ts'
import { needleAngleDeg, scaleTicks } from '../../benchkit.ts'

export type V3 = readonly [number, number, number]

// ---- multimeter: knob detents and needle ------------------------------------------------------------
export const KNOB_RANGES: readonly MeterRange[] = ['OFF', 0.1, 0.3, 1, 3, 10, 30]
/** Angle (deg, clockwise seen from the front, 0 = pointing up the face) of every detent, OFF at the far left. */
export const KNOB_STEP_DEG = 30
export function knobAngleDeg(range: MeterRange): number {
  const i = KNOB_RANGES.indexOf(range)
  return (i < 0 ? 0 : i) * KNOB_STEP_DEG - ((KNOB_RANGES.length - 1) / 2) * KNOB_STEP_DEG
}
/** Needle angle (deg, clockwise) for the readout: the same mapping as the 2D dial, left stop when OFF, pinned when over range. */
export function needleTargetFraction(r: { meterRange: MeterRange; needleFraction: number; overRange: boolean }): number {
  if (r.meterRange === 'OFF') return 0
  return r.overRange ? 1 : Math.min(1, Math.max(0, r.needleFraction))
}
export const needleTargetDeg = (r: { meterRange: MeterRange; needleFraction: number; overRange: boolean }): number =>
  needleAngleDeg(needleTargetFraction(r))

// ---- dial face (canvas pixels) -----------------------------------------------------------------------
export const DIAL_CM = { w: 10.4, h: 8 } as const
export const DIAL_PX_PER_CM = 123
export const DIAL_PX = { w: Math.round(DIAL_CM.w * DIAL_PX_PER_CM), h: Math.round(DIAL_CM.h * DIAL_PX_PER_CM) } as const
export const DIAL_PIVOT_PX = { x: DIAL_PX.w / 2, y: 790, r: 590 } as const
/** Pivot and scale radius in cm, relative to the dial plane centre (v up). */
export const DIAL_PIVOT_CM = {
  u: 0,
  v: (DIAL_PX.h / 2 - DIAL_PIVOT_PX.y) / DIAL_PX_PER_CM,
  r: DIAL_PIVOT_PX.r / DIAL_PX_PER_CM,
} as const

export interface DialTick {
  fraction: number
  major: boolean
  label: string | null
  /** Clockwise angle from straight up, deg (same as needleAngleDeg). */
  angleDeg: number
  /** Inner end of the stroke, as a fraction of the scale radius (outer end is 1). */
  innerR: number
  labelR: number
}
/** Proportions of the 2D dial (radius 120: major ticks 14 long, minor 6, numerals at r + 14). */
export function dialTickLayout(range_V: number): DialTick[] {
  return scaleTicks(range_V).map((t) => ({
    fraction: t.fraction,
    major: t.major,
    label: t.label,
    angleDeg: needleAngleDeg(t.fraction),
    innerR: 1 - (t.major ? 14 : 6) / 120,
    labelR: 1 + 14 / 120,
  }))
}
/** Scale shown on the dial: the OFF position still shows the 3 V scale (like the 2D dial, dimmed). */
export const dialRangeFor = (range: MeterRange): number => (range === 'OFF' ? 3 : range)
export const MIRROR_R = 1 - 22 / 120

// ---- multimeter housing ------------------------------------------------------------------------------
export const METER = { x: 38.5, z: 12.5, width: 12, depth: 13 } as const
/** Side profile (z relative to METER.z, y): front lip top and the top edge of the sloped face. */
export const METER_FACE = { lip: { z: 6.5, y: 1.6 }, top: { z: -4, y: 9.6 }, bevel: 0.3 } as const
export const METER_KNOB_V = 1.75
export const METER_TERMINALS = {
  black: [41.4, 1.0, 19.65],
  red: [43.0, 1.0, 19.65],
} as const satisfies Record<string, V3>

// ---- amplifier 532 14 ----------------------------------------------------------------------------------
export const AMP = { x: 25.3, z: 1.8, w: 12.7, h: 12, d: 12.4 } as const
export const AMP_FRONT_Z = AMP.z + AMP.d / 2
export const SOCKET_FRONT = 0.45
export const PLATE_CM = { w: 11.9, h: 11.2 } as const
/** Front plate positions (u right, v up, cm from the plate centre = the middle of the front face). */
export const PLATE = {
  bnc: { u: -4.6, v: 3.2 },
  groundA: { u: -4.0, v: -4.4 },
  supply: { u: -1.0, v: -4.4 },
  outRed: { u: 4.9, v: 2.0 },
  outBlue: { u: 4.9, v: 0.4 },
  offset: { u: 2.9, v: -3.3 },
  led: { u: -4.9, v: 4.9 },
} as const
const plateWorld = (p: { u: number; v: number }): V3 => [AMP.x + p.u, AMP.h / 2 + p.v, AMP_FRONT_Z + SOCKET_FRONT]
/** Right side socket for the earth lead to the distribution box. */
export const AMP_EARTH_SIDE: V3 = [AMP.x + AMP.w / 2 + SOCKET_FRONT, 3, AMP.z + 0.2]

// ---- sockets elsewhere (given by the bench layout) ------------------------------------------------------
export const SOCKETS = {
  lamp: [-29.5, 2.5, -1.5],
  chokeOut: [-33.4, 4.2, 7.2 + SOCKET_FRONT],
  s81: [13.3, 3, 0.5],
  s82: [13.3, 6.5, -4.5],
  /** Second 4 mm socket of 8.2, bridged to the first by a 25 cm lead. */
  s82b: [13.3, 6.5, -2.4],
  ampBnc: plateWorld(PLATE.bnc),
  ampGround: plateWorld(PLATE.groundA),
  ampSupply: plateWorld(PLATE.supply),
  ampOutRed: plateWorld(PLATE.outRed),
  ampOutBlue: plateWorld(PLATE.outBlue),
  ampEarth: AMP_EARTH_SIDE,
  meterBlack: METER_TERMINALS.black,
  meterRed: METER_TERMINALS.red,
  /** Plug-in capacitor 578 22 and key 579 10 blocks (top contact) and the side of the amplifier input where their leads end. */
  capTop: [16.5, 1.35, 5],
  keyTop: [20, 0.95, 12],
  ampInSide: [21.55, 9.2, 8.55],
  supplyBox: [24.5, 2.4, 12],
  distBox: [44.5, 1.5, -9 + 0.3],
} as const satisfies Record<string, V3>

// ---- cables ----------------------------------------------------------------------------------------------
export type CableMat = 'red' | 'blue' | 'black' | 'yellowGreen'
export type EndKind = 'bnc' | '4mm' | 'none'
export interface CableDef {
  id: string
  mat: CableMat
  radius: number
  /** Control points; the first and last are the socket coordinates. */
  points: V3[]
  ends: [EndKind, EndKind]
}
const r = 0.2
export const CABLES: CableDef[] = [
  { // screened BNC cable 8.1 -> amplifier input
    id: 'bnc', mat: 'black', radius: 0.26, ends: ['bnc', 'bnc'],
    points: [SOCKETS.s81, [15.2, 1.9, 1.3], [14.4, r, 3], [14.4, r, 7], [15.5, r, 9.0], [18.9, 0.4, 9.2], [20.0, 4.5, 9.6], [20.7, 9.2, 9.4], SOCKETS.ampBnc],
  },
  { // 100 cm lead: ring anode 8.2 -> amplifier ground
    id: 'anode', mat: 'black', radius: r, ends: ['4mm', '4mm'],
    points: [SOCKETS.s82b, [15.0, 4.2, -3.0], [16.4, r, -4.6], [18.2, r, -3], [18.25, r, 3], [18.3, r, 8.5], [19.0, r, 10.1], [21.3, 0.5, 10.0], [21.3, 1.6, 9.0], SOCKETS.ampGround],
  },
  { // 25 cm lead between the two 4 mm sockets of 8.2 (a slack loop standing up from the end wall)
    id: 'bridge', mat: 'red', radius: 0.17, ends: ['4mm', '4mm'],
    points: [SOCKETS.s82, [15.2, 7.0, -5.0], [18.0, 10.2, -5.0], [19.4, 12.4, -3.5], [18.0, 10.2, -2.0], [15.2, 7.0, -1.9], SOCKETS.s82b],
  },
  { // capacitor block -> amplifier input
    id: 'capLead', mat: 'black', radius: 0.14, ends: ['4mm', 'none'],
    points: [SOCKETS.capTop, [17.2, 3.4, 6.2], [19.6, 6.4, 8.0], SOCKETS.ampInSide],
  },
  { // key block -> amplifier input
    id: 'keyLead', mat: 'black', radius: 0.14, ends: ['4mm', 'none'],
    points: [SOCKETS.keyTop, [20.6, 3.8, 11.0], [21.6, 7.0, 9.6], SOCKETS.ampInSide],
  },
  { // red: amplifier output -> multimeter
    id: 'red', mat: 'red', radius: r, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampOutRed, [30.4, 8.0, 9.4], [30.9, 5, 11], [31.3, r, 14], [31.3, r, 21.0], [36, r, 23.0], [43.0, 0.35, 22.4], [43.0, 1.0, 20.4], SOCKETS.meterRed],
  },
  { // blue: amplifier common -> multimeter
    id: 'blue', mat: 'blue', radius: r, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampOutBlue, [30.45, 6.4, 9.5], [31.2, 4, 11.4], [31.9, r, 14.2], [31.9, r, 20.3], [36.5, r, 21.6], [41.4, 0.35, 21.4], [41.4, 1.0, 20.4], SOCKETS.meterBlack],
  },
  { // yellow-green earth lead: amplifier -> distribution box 502 04
    id: 'earth', mat: 'yellowGreen', radius: r, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampEarth, [33.6, 1.0, 1.8], [34.5, r, -1], [37, r, -6], [41, r, -6.5], [44.5, 0.6, -7.2], SOCKETS.distBox],
  },
  { // supply 562 791 -> amplifier 12 V~ jack
    id: 'supply', mat: 'black', radius: 0.18, ends: ['none', '4mm'],
    points: [SOCKETS.supplyBox, [23.4, r, 11.0], [23.6, r, 9.6], [24.3, 1.0, 8.9], SOCKETS.ampSupply],
  },
  { // lamp 1 -> universal choke 451 30
    id: 'lamp', mat: 'black', radius: 0.24, ends: ['4mm', '4mm'],
    points: [SOCKETS.lamp, [-30.4, 1.2, 0.0], [-29.6, r, 3.5], [-30.0, r, 9.0], [-33.4, 1.2, 9.8], [-33.4, 4.2, 8.8], SOCKETS.chokeOut],
  },
]
