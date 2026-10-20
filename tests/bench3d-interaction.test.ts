import { describe, expect, it } from 'vitest'
import { Apparatus, type MeterRange } from '../src/apparatus/index'
import {
  ARM_WHEEL_STEP, WINDOW_COVER_SPAN, armPositionFromPoint, createController, rangeFromAngle, rangeFromKnobPoint, steppedRange,
  windowCoverFromAlong, windowCoverFromPoint, type BenchActions,
} from '../src/views/bench3d/controller'
import { KNOB_RANGES, knobAngleDeg } from '../src/views/bench3d/electrics/layout'
import { ARM_PIVOT, WINDOW_LEN, WINDOW_U, armAimYaw, windowPoint } from '../src/views/bench3d/optics/helpers'

describe('pointer to arm position (inverse of windowPoint)', () => {
  it('round-trips every window position', () => {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, p = windowPoint(t)
      expect(armPositionFromPoint(p.x, p.z)).toBeCloseTo(t, 9)
    }
  })
  it('maps a pointer on the knob (on the arm axis, 5.6 cm from the pivot) to the position the arm then has', () => {
    for (const t of [0.1, 0.35, 0.5, 0.86]) {
      const yaw = armAimYaw(t)
      const x = ARM_PIVOT.x + 5.6 * Math.cos(yaw), z = ARM_PIVOT.z - 5.6 * Math.sin(yaw)
      expect(armPositionFromPoint(x, z)).toBeCloseTo(t, 6)
    }
  })
  it('clamps beyond the ends and falls back to the nearest edge point behind the pivot', () => {
    expect(armPositionFromPoint(windowPoint(0).x - 20 * WINDOW_U.x, windowPoint(0).z - 20 * WINDOW_U.z)).toBe(0)
    expect(armPositionFromPoint(windowPoint(1).x + 20 * WINDOW_U.x, windowPoint(1).z + 20 * WINDOW_U.z)).toBe(1)
    const behind = armPositionFromPoint(2 * ARM_PIVOT.x - windowPoint(0.5).x, 2 * ARM_PIVOT.z - windowPoint(0.5).z)
    expect(behind).toBeGreaterThanOrEqual(0)
    expect(behind).toBeLessThanOrEqual(1)
  })
})

describe('meter knob detents', () => {
  it('steps one detent and clamps at OFF and at the top range', () => {
    expect(steppedRange(3, 1)).toBe(10)
    expect(steppedRange(3, -1)).toBe(1)
    expect(steppedRange('OFF', -1)).toBe('OFF')
    expect(steppedRange('OFF', 1)).toBe(0.1)
    expect(steppedRange(30, 1)).toBe(30)
  })
  it('snaps a drag angle to the nearest detent, and an angle at a detent returns that detent', () => {
    for (const r of KNOB_RANGES) expect(rangeFromAngle(knobAngleDeg(r))).toBe(r)
    expect(rangeFromAngle(knobAngleDeg(3) + 14)).toBe(3)
    expect(rangeFromAngle(knobAngleDeg(3) + 16)).toBe(10)
    expect(rangeFromAngle(-179)).toBe('OFF')
    expect(rangeFromAngle(179)).toBe(30)
  })
  it('reads the angle from the pointer position in the knob frame (clockwise from up)', () => {
    expect(rangeFromKnobPoint(0, 1)).toBe(KNOB_RANGES[3]) // straight up = middle detent (1 V)
    expect(rangeFromKnobPoint(1, 0)).toBe(30) // 3 o'clock = +90 deg
    expect(rangeFromKnobPoint(-1, 0)).toBe('OFF')
  })
})

describe('window cover drag', () => {
  it('is 0 at the C end, 1 at the A end of the slider travel and linear between', () => {
    const half = (WINDOW_LEN * WINDOW_COVER_SPAN) / 2
    expect(windowCoverFromAlong(-half)).toBeCloseTo(0, 12)
    expect(windowCoverFromAlong(half)).toBeCloseTo(1, 12)
    expect(windowCoverFromAlong(0)).toBeCloseTo(0.5, 12)
    expect(windowCoverFromAlong(-100)).toBe(0)
    expect(windowCoverFromAlong(100)).toBe(1)
  })
  it('projects a world point onto the window edge', () => {
    const m = windowPoint(0.5)
    expect(windowCoverFromPoint(m.x, m.z)).toBeCloseTo(0.5, 12)
    // moving off the edge sideways changes nothing
    expect(windowCoverFromPoint(m.x + WINDOW_U.z * 7, m.z - WINDOW_U.x * 7)).toBeCloseTo(0.5, 9)
    const p = windowPoint(0.75)
    expect(windowCoverFromPoint(p.x, p.z)).toBeCloseTo(0.5 + 0.25 / WINDOW_COVER_SPAN, 9)
  })
})

describe('controller drives the apparatus', () => {
  const fake = () => {
    const calls: string[] = []
    const a: BenchActions = {
      armPosition: 0.5, windowCover: 0, lampOn: false, meterRange: 3 as MeterRange,
      setArm(p) { calls.push(`arm ${p.toFixed(4)}`); a.armPosition = p },
      setWindowCover(c) { calls.push(`cover ${c.toFixed(4)}`); a.windowCover = c },
      setLamp(on) { calls.push(`lamp ${on}`); a.lampOn = on },
      setRange(r) { calls.push(`range ${r}`); a.meterRange = r },
      pressKey() { calls.push('press') },
      releaseKey() { calls.push('release') },
    }
    return { a, calls }
  }
  it('key: press then release', () => {
    const { a, calls } = fake()
    const c = createController(a)
    c.pressKey(); c.releaseKey()
    expect(calls).toEqual(['press', 'release'])
  })
  it('lamp: toggles', () => {
    const { a, calls } = fake()
    const c = createController(a)
    c.toggleLamp(); c.toggleLamp()
    expect(calls).toEqual(['lamp true', 'lamp false'])
  })
  it('range: click steps, drag snaps, no call when nothing changes', () => {
    const { a, calls } = fake()
    const c = createController(a)
    c.stepRange(1)
    c.stepRange(-1); c.stepRange(-1)
    c.dragRange(-1, 0) // OFF side
    c.dragRange(-1, 0.01)
    expect(calls).toEqual(['range 10', 'range 3', 'range 1', 'range OFF'])
  })
  it('arm: drag keeps the grab offset (no jump), wheel is a fine step', () => {
    const { a, calls } = fake()
    const c = createController(a)
    const p = windowPoint(0.6)
    c.beginArmDrag(p.x, p.z) // grabbed 0.1 below where the pointer maps to
    const q = windowPoint(0.7)
    c.dragArm(q.x, q.z)
    expect(a.armPosition).toBeCloseTo(0.6, 9)
    c.nudgeArm(100)
    expect(a.armPosition).toBeCloseTo(0.6 - ARM_WHEEL_STEP, 9)
    c.nudgeArm(-100)
    expect(a.armPosition).toBeCloseTo(0.6, 9)
    expect(calls.length).toBe(3)
  })
  it('cover: drag sets the cover with the grab offset', () => {
    const { a } = fake()
    const c = createController(a)
    const mid = windowPoint(0.5)
    c.beginCoverDrag(mid.x, mid.z) // grip at 0 while the pointer maps to 0.5
    c.dragCover(mid.x + WINDOW_U.x * 3, mid.z + WINDOW_U.z * 3)
    expect(a.windowCover).toBeCloseTo(3 / (WINDOW_LEN * WINDOW_COVER_SPAN), 9)
  })
  it('works against the real Apparatus (aligning the yellow line by dragging the arm)', () => {
    const app = new Apparatus({ mode: 'explore' })
    const c = createController(app)
    const target = windowPoint(app.linePosition('yellow'))
    c.beginArmDrag(target.x, target.z)
    app.setArm(0.1)
    c.beginArmDrag(windowPoint(0.1).x, windowPoint(0.1).z)
    c.dragArm(target.x, target.z)
    expect(app.lineOnCell()).toBe('yellow')
    c.pressKey()
    expect(app.keyPressed).toBe(true)
    c.releaseKey()
    expect(app.keyPressed).toBe(false)
    c.stepRange(1)
    expect(app.meterRange).toBe(10)
    c.toggleLamp()
    expect(app.lampOn).toBe(true)
    c.beginCoverDrag(windowPoint(0.5).x, windowPoint(0.5).z)
    c.dragCover(windowPoint(0.75).x, windowPoint(0.75).z)
    expect(app.windowCover).toBeGreaterThan(0.2)
  })
})
