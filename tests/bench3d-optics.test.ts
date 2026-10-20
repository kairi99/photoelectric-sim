import { describe, expect, it } from 'vitest'
import { ARM_SPAN_DEG, armAngleDeg } from '../src/views/benchkit'
import { DEG, yawToward } from '../src/views/bench3d/units'
import {
  ARM_OMEGA, ARM_PIVOT, KNOB_TURNS, TRI_A, TRI_C, WINDOW_LEN, WINDOW_U,
  armAimYaw, armSwingRad, dampStep, knobAngleRad, windowPoint,
} from '../src/views/bench3d/optics/helpers'

describe('window spot mapping', () => {
  it('maps 0 to the C end, 1 to the A end and 0.5 to the midpoint', () => {
    expect(windowPoint(0).x).toBeCloseTo(TRI_C.x, 12)
    expect(windowPoint(0).z).toBeCloseTo(TRI_C.z, 12)
    expect(windowPoint(1).x).toBeCloseTo(TRI_A.x, 12)
    expect(windowPoint(1).z).toBeCloseTo(TRI_A.z, 12)
    expect(windowPoint(0.5).x).toBeCloseTo((TRI_A.x + TRI_C.x) / 2, 12)
    expect(windowPoint(0.5).z).toBeCloseTo((TRI_A.z + TRI_C.z) / 2, 12)
  })
  it('is linear along A-C and clamps', () => {
    const p = windowPoint(0.25), q = windowPoint(0.75)
    expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeCloseTo(WINDOW_LEN / 2, 10)
    expect(windowPoint(-1)).toEqual(windowPoint(0))
    expect(windowPoint(2)).toEqual(windowPoint(1))
    expect(Math.hypot(WINDOW_U.x, WINDOW_U.z)).toBeCloseTo(1, 12)
  })
})

describe('arm angle', () => {
  it('uses the 2D convention: zero at 0.5, endpoints at +-ARM_SPAN/2, same sense', () => {
    expect(armSwingRad(0.5)).toBe(-0)
    expect(armSwingRad(1)).toBeCloseTo(-(ARM_SPAN_DEG / 2) * DEG, 12)
    expect(armSwingRad(0)).toBeCloseTo((ARM_SPAN_DEG / 2) * DEG, 12)
    for (const p of [0, 0.2, 0.5, 0.86, 1]) expect(armSwingRad(p)).toBeCloseTo(-armAngleDeg(p) * DEG, 12)
  })
  it('the 3D arm yaw falls with position (clockwise from above, like 2D) and aims at the window spot', () => {
    expect(armAimYaw(1)).toBeLessThan(armAimYaw(0.5))
    expect(armAimYaw(0.5)).toBeLessThan(armAimYaw(0))
    for (const p of [0, 0.2, 0.5, 0.86, 1]) {
      const w = windowPoint(p)
      expect(armAimYaw(p)).toBeCloseTo(yawToward(w.x - ARM_PIVOT.x, w.z - ARM_PIVOT.z), 12)
    }
  })
})

describe('knob and smoothing', () => {
  it('rotates in proportion to the arm position', () => {
    expect(knobAngleRad(0.5)).toBeCloseTo(0, 12)
    const d = knobAngleRad(0.7) - knobAngleRad(0.6)
    expect(knobAngleRad(0.9) - knobAngleRad(0.8)).toBeCloseTo(d, 12)
    expect(knobAngleRad(1) - knobAngleRad(0)).toBeCloseTo(-KNOB_TURNS * 2 * Math.PI, 12)
    expect(Math.sign(d)).toBe(Math.sign(armSwingRad(0.7) - armSwingRad(0.6)))
  })
  it('critically damped step converges without overshoot and is stable for large dt', () => {
    let s = { x: 0, v: 0 }
    let max = 0
    for (let i = 0; i < 60; i++) { s = dampStep(s.x, s.v, 1, ARM_OMEGA, 1 / 60); max = Math.max(max, s.x) }
    expect(max).toBeLessThanOrEqual(1 + 1e-9)
    expect(s.x).toBeGreaterThan(0.999)
    expect(dampStep(0, 0, 1, ARM_OMEGA, 10).x).toBeCloseTo(1, 6)
  })
})
