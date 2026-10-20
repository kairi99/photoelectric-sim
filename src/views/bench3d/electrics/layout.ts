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
  /** 4 mm sockets across the electrometer input: the 100 pF capacitor and the key plug in here (leaflet Fig. 2). */
  capIn: { u: -2.75, v: 4.3 },
  keyIn: { u: -2.75, v: 2.1 },
} as const
const plateWorld = (p: { u: number; v: number }): V3 => [AMP.x + p.u, AMP.h / 2 + p.v, AMP_FRONT_Z + SOCKET_FRONT]
/** Right side socket for the earth lead to the distribution box. */
export const AMP_EARTH_SIDE: V3 = [AMP.x + AMP.w / 2 + SOCKET_FRONT, 3, AMP.z + 0.2]

// ---- plug-in blocks in front of the amplifier (clear gaps of at least 5 cm to the amplifier and to each other) -------
export interface Footprint { x: number; z: number; w: number; d: number }
export const CAP_BLOCK: Footprint = { x: 14, z: 17, w: 3.4, d: 2.6 }
export const KEY_BLOCK: Footprint = { x: 23.5, z: 19, w: 4, d: 3.2 }
export const SUPPLY_BOX: Footprint = { x: 28, z: 28, w: 5, d: 4 }
/** Height of the contact socket on the back (amplifier-side) face of the capacitor and key blocks. */
export const BLOCK_SOCKET_Y = 0.5

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
  /** Back-face contacts of the capacitor 578 22 and key 579 10 blocks (the faces turned to the amplifier) and their amplifier input sockets. */
  capBlock: [CAP_BLOCK.x, BLOCK_SOCKET_Y, CAP_BLOCK.z - CAP_BLOCK.d / 2 - SOCKET_FRONT],
  keyBlock: [KEY_BLOCK.x, BLOCK_SOCKET_Y, KEY_BLOCK.z - KEY_BLOCK.d / 2 - SOCKET_FRONT],
  ampCapIn: plateWorld(PLATE.capIn),
  ampKeyIn: plateWorld(PLATE.keyIn),
  /** Where the fixed cord leaves the back of the plug-in supply (no socket: the cord is moulded in). */
  supplyBox: [SUPPLY_BOX.x, 1.4, SUPPLY_BOX.z - SUPPLY_BOX.d / 2],
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
    points: [SOCKETS.s82b, [14.6, 5.0, -2.0], [15.8, 1.5, -1.2], [16.6, r, 0], [18.2, r, 2], [18.25, r, 3], [18.3, r, 8.5], [19.0, r, 10.1], [21.3, 0.5, 10.0], [21.3, 1.6, 9.0], SOCKETS.ampGround],
  },
  { // 25 cm lead between the two 4 mm sockets of 8.2: hangs from both plugs, lies in a small loop on the table behind the tube
    id: 'bridge', mat: 'red', radius: 0.17, ends: ['4mm', '4mm'],
    points: [SOCKETS.s82, [14.8, 5.2, -5.0], [15.8, 1.6, -5.9], [16.8, 0.17, -6.8], [19.5, 0.17, -8.2], [22, 0.17, -6.2], [19.5, 0.17, -4.4], [16.4, 0.17, -3.5], [14.9, 3.2, -2.9], SOCKETS.s82b],
  },
  { // capacitor block -> amplifier input (+): hangs from the upper input socket, lies on the table, enters the block's back face
    id: 'capLead', mat: 'black', radius: 0.14, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampCapIn, [22.3, 10.3, 9.9], [22.2, 6.0, 10.7], [22.2, 0.14, 11.0], [19, 0.14, 12.4], [15.5, 0.14, 13.0], [14.1, 0.14, 14.0], SOCKETS.capBlock],
  },
  { // key block -> amplifier input (+): hangs from the lower input socket and runs straight to the key block
    id: 'keyLead', mat: 'black', radius: 0.14, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampKeyIn, [22.8, 8.1, 9.5], [23.4, 4.5, 10.0], [23.45, 0.14, 11.2], [23.5, 0.14, 14.0], [23.5, 0.14, 15.3], SOCKETS.keyBlock],
  },
  { // red: amplifier output -> multimeter
    id: 'red', mat: 'red', radius: r, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampOutRed, [30.5, 7.0, 9.6], [30.8, 3.4, 10.3], [31.1, r, 11.4], [31.3, r, 14], [31.3, r, 21.0], [36, r, 23.0], [43.0, 0.35, 22.4], [43.0, 1.0, 20.4], SOCKETS.meterRed],
  },
  { // blue: amplifier common -> multimeter
    id: 'blue', mat: 'blue', radius: r, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampOutBlue, [30.6, 5.4, 9.7], [31.0, 2.6, 10.6], [31.6, r, 12.0], [31.9, r, 14.2], [31.9, r, 20.3], [36.5, r, 21.6], [41.4, 0.35, 21.4], [41.4, 1.0, 20.4], SOCKETS.meterBlack],
  },
  { // yellow-green earth lead: amplifier -> distribution box 502 04
    id: 'earth', mat: 'yellowGreen', radius: r, ends: ['4mm', '4mm'],
    points: [SOCKETS.ampEarth, [33.6, 1.0, 1.8], [34.5, r, -1], [37, r, -6], [41, r, -6.5], [44.5, 0.6, -7.2], SOCKETS.distBox],
  },
  { // supply 562 791 -> amplifier 12 V~ jack: the cord leaves the back of the supply and lies on the table
    id: 'supply', mat: 'black', radius: 0.18, ends: ['none', '4mm'],
    points: [SOCKETS.supplyBox, [28, 0.18, 23.2], [27.9, 0.18, 18], [27.0, 0.18, 13.5], [25.3, 0.8, 10.4], [24.3, 1.4, 9.2], SOCKETS.ampSupply],
  },
  { // lamp 1 -> universal choke 451 30
    id: 'lamp', mat: 'black', radius: 0.24, ends: ['4mm', '4mm'],
    points: [SOCKETS.lamp, [-30.4, 1.2, 0.0], [-29.6, r, 3.5], [-30.0, r, 9.0], [-33.4, 1.2, 9.8], [-33.4, 4.2, 8.8], SOCKETS.chokeOut],
  },
]

/** Boxes a cable may drape over (x0, x1, y top, z0, z1). None at present: every lead lies on the table or hangs between plugs. */
export const CABLE_SUPPORTS: ReadonlyArray<{ x0: number; x1: number; z0: number; z1: number; top: number }> = []
