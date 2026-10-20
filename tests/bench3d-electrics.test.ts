import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { needleAngleDeg, scaleTicks } from '../src/views/benchkit'
import {
  CABLES, DIAL_PIVOT_PX, KNOB_RANGES, METER_TERMINALS, SOCKETS, dialTickLayout, knobAngleDeg, needleTargetDeg, needleTargetFraction,
} from '../src/views/bench3d/electrics/layout'
import { easeTo, stepNeedle } from '../src/views/bench3d/electrics/dynamics'
import { cableCurve } from '../src/views/bench3d/electrics/cableCurve'
import { buildElectrics } from '../src/views/bench3d/electrics'
import { PartRegistry } from '../src/views/bench3d/parts'
import { units } from '../src/views/bench3d/units'

describe('multimeter knob detents', () => {
  it('OFF is the far left and each range is one 30 degree step to the right', () => {
    expect(KNOB_RANGES).toEqual(['OFF', 0.1, 0.3, 1, 3, 10, 30])
    expect(KNOB_RANGES.map(knobAngleDeg)).toEqual([-90, -60, -30, 0, 30, 60, 90])
  })
})

describe('needle', () => {
  it('uses the 2D dial angle mapping', () => {
    for (const f of [0, 0.1, 0.5, 0.87, 1]) {
      expect(needleTargetDeg({ meterRange: 3, needleFraction: f, overRange: false })).toBeCloseTo(needleAngleDeg(f), 9)
    }
  })
  it('rests at the left stop when OFF and pins at the right stop when over range', () => {
    expect(needleTargetDeg({ meterRange: 'OFF', needleFraction: 0.7, overRange: false })).toBe(needleAngleDeg(0))
    expect(needleTargetFraction({ meterRange: 1, needleFraction: 1.4, overRange: true })).toBe(1)
    expect(needleTargetDeg({ meterRange: 1, needleFraction: 0.3, overRange: true })).toBe(needleAngleDeg(1))
  })
  it('settles in about 0.4 s with a small overshoot, and never passes the stops', () => {
    const s = { x: 0, v: 0 }
    let t = 0, peak = 0, last = 0
    while (stepNeedle(s, 0.6, 1 / 60) && t < 3) {
      t += 1 / 60; peak = Math.max(peak, s.x)
      if (Math.abs(s.x - 0.6) > 0.02 * 0.6) last = t // last time outside the 2 % band
    }
    expect(last).toBeGreaterThan(0.2)
    expect(last).toBeLessThan(0.5)
    expect(t).toBeLessThan(1.2)
    expect(peak).toBeGreaterThan(0.6)
    expect(peak).toBeLessThan(0.66)
    const p = { x: 0.9, v: 0 }
    for (let i = 0; i < 60; i++) stepNeedle(p, 1, 1 / 60)
    expect(p.x).toBeLessThanOrEqual(1)
  })
  it('easeTo converges and snaps', () => {
    let x = 0
    for (let i = 0; i < 60; i++) x = easeTo(x, 1, 1 / 60, 0.07)
    expect(x).toBe(1)
  })
})

describe('dial ticks', () => {
  it('reuses scaleTicks (same fractions, majors and numerals) and the 2D angles', () => {
    for (const range of [0.1, 0.3, 1, 3, 10, 30]) {
      const a = scaleTicks(range), b = dialTickLayout(range)
      expect(b.length).toBe(a.length)
      b.forEach((t, i) => {
        expect(t.fraction).toBe(a[i]!.fraction)
        expect(t.major).toBe(a[i]!.major)
        expect(t.label).toBe(a[i]!.label)
        expect(t.angleDeg).toBeCloseTo(needleAngleDeg(a[i]!.fraction), 9)
        expect(t.innerR).toBeLessThan(1)
      })
    }
  })
  it('keeps the numerals inside the canvas', () => {
    const maxHalf = DIAL_PIVOT_PX.r * (1 + 14 / 120) * Math.sin((55 * Math.PI) / 180)
    expect(DIAL_PIVOT_PX.x + maxHalf + 50).toBeLessThan(1280)
    expect(DIAL_PIVOT_PX.y - DIAL_PIVOT_PX.r * (1 + 14 / 120) - 45).toBeGreaterThan(0)
  })
})

describe('cables', () => {
  const curve = (pts: readonly (readonly number[])[], radius = 0.2) => cableCurve(THREE, { points: pts as never, radius })
  it('end on the bench socket coordinates', () => {
    const by = Object.fromEntries(CABLES.map((c) => [c.id, c]))
    const ends = (id: string) => { const c = curve(by[id]!.points, by[id]!.radius); return [c.getPoint(0).toArray(), c.getPoint(1).toArray()] }
    expect(ends('bnc')[0]).toEqual([13.3, 3, 0.5].map((v) => expect.closeTo(v, 9))) // 8.1 BNC cathode
    expect(ends('anode')[0]).toEqual([...SOCKETS.s82b].map((v) => expect.closeTo(v, 9))) // second 4 mm socket of 8.2
    expect(ends('bridge')[0]).toEqual([13.3, 6.5, -4.5].map((v) => expect.closeTo(v, 9))) // 8.2 ring anode
    expect(ends('bridge')[1]).toEqual([...SOCKETS.s82b].map((v) => expect.closeTo(v, 9)))
    expect(ends('lamp')[0]).toEqual([...SOCKETS.lamp].map((v) => expect.closeTo(v, 9))) // lamp
    for (const c of CABLES) {
      const cv = curve(c.points, c.radius)
      cv.getPoint(0).toArray().forEach((v, i) => expect(v).toBeCloseTo(c.points[0]![i]!, 9))
      cv.getPoint(1).toArray().forEach((v, i) => expect(v).toBeCloseTo(c.points[c.points.length - 1]![i]!, 9))
    }
    expect(ends('red')[1]).toEqual([...METER_TERMINALS.red].map((v) => expect.closeTo(v, 9)))
    expect(ends('blue')[1]).toEqual([...METER_TERMINALS.black].map((v) => expect.closeTo(v, 9)))
  })
  it('stay above the table and never sink below a cable radius', () => {
    for (const c of CABLES) {
      const cv = curve(c.points, c.radius)
      for (let i = 0; i <= 200; i++) expect(cv.getPoint(i / 200).y).toBeGreaterThan(c.radius - 0.02)
    }
  })
})

// ---- builder smoke test with a stubbed canvas (no WebGL) ----------------------------------------------------
function withDom<T>(fn: () => T): T {
  const g = new Proxy({}, { get: (_t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => undefined), set: () => true })
  const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => g }) }
  const old = (globalThis as { document?: unknown }).document
  ;(globalThis as { document?: unknown }).document = doc
  try { return fn() } finally { (globalThis as { document?: unknown }).document = old }
}
const mat = () => new THREE.MeshStandardMaterial()
function build() {
  const scene = new THREE.Scene()
  const materials = {
    housing: mat(), enclosure: mat(), metal: mat(), rubber: mat(), glass: mat(), glassLite: mat(),
    cable: { red: mat(), blue: mat(), black: mat(), yellowGreen: mat() },
  } as never
  const parts = new PartRegistry(THREE, () => {})
  const ctx = { scene, three: THREE, materials, parts, units, requestRender: () => {}, lang: () => 'en', preset: () => 'overview', hovering: () => false }
  const model = withDom(() => buildElectrics(ctx as never))
  return { scene, parts, model }
}

describe('electrics builder', () => {
  it('registers every part with its control and stays under the triangle budget', () => {
    const { scene, parts, model } = build()
    for (const id of ['choke', 'amplifier', 'capacitor', 'key', 'supply', 'meter', 'meterKnob', 'cables'] as const) expect(parts.getPart(id), id).toBeDefined()
    expect(parts.getPart('key')!.controlId).toBe('key')
    expect(parts.getPart('meter')!.controlId).toBe('range')
    expect(parts.getPart('meterKnob')!.controlId).toBe('range')
    expect(parts.getPart('meterKnob')!.object.userData.dragHandle).toBe('range')
    const key = parts.getPart('key')!.object
    let handle = 0
    key.traverse((o) => { if (o.userData.pressHandle === 'key') handle++ })
    expect(handle).toBeGreaterThan(0)
    const tri = scene.children[0]!.userData.triangles as number
    expect(tri).toBeGreaterThan(1000)
    expect(tri).toBeLessThan(50000)
    model.dispose()
  })
  it('moves the key cap down when pressed and turns the knob to the detent', () => {
    const { parts, model } = build()
    const r = (o: object) => ({ meterRange: 3, needleFraction: 0.5, overRange: false, keyPressed: false, ...o }) as never
    const cap = parts.getPart('key')!.object.getObjectByName('key-cap')!
    const knob = parts.getPart('meterKnob')!.object
    withDom(() => model.update(r({}), {} as never))
    const up = cap.position.y
    expect(knob.rotation.z).toBeCloseTo(-(30 * Math.PI) / 180, 6)
    withDom(() => model.update(r({ keyPressed: true, meterRange: 'OFF' }), {} as never))
    for (let i = 0; i < 120; i++) model.tick?.(1 / 60)
    expect(cap.position.y).toBeLessThan(up - 0.4)
    expect(knob.rotation.z).toBeCloseTo((90 * Math.PI) / 180, 2)
    model.dispose()
  })
})
