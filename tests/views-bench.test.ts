import { describe, expect, it } from 'vitest'
import { strings as bench } from '../src/views/strings/bench'
import { strings as panel } from '../src/views/strings/panel'
import {
  ARM_SPAN_DEG, armAngleDeg, armPositionFromAngle, formatStopwatch, needleAngleDeg, opacityFromIntensity, scaleTicks, fill,
} from '../src/views/benchkit'

function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('bench and panel strings', () => {
  it('bench en and es have identical keys', () => {
    expect(keys(bench.es).sort()).toEqual(keys(bench.en).sort())
  })
  it('panel en and es have identical keys', () => {
    expect(keys(panel.es).sort()).toEqual(keys(panel.en).sort())
  })
  it('placeholders match between languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    const flat = (o: object): Record<string, string> =>
      Object.fromEntries(Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? Object.entries(flat(v)).map(([k2, v2]) => [`${k}.${k2}`, v2]) : [[k, v]]))
    for (const s of [bench, panel]) {
      const en = flat(s.en), es = flat(s.es)
      for (const k of Object.keys(en)) expect(ph(es[k]!), k).toBe(ph(en[k]!))
    }
  })
})

describe('bench drawing helpers', () => {
  it('maps arm position to a symmetric angle and back', () => {
    expect(armAngleDeg(0.5)).toBe(0)
    expect(armAngleDeg(0)).toBe(-ARM_SPAN_DEG / 2)
    expect(armAngleDeg(1)).toBe(ARM_SPAN_DEG / 2)
    for (const p of [0, 0.2, 0.5, 0.86, 1]) expect(armPositionFromAngle(armAngleDeg(p))).toBeCloseTo(p, 12)
  })
  it('clamps out-of-range angles', () => {
    expect(armPositionFromAngle(500)).toBe(1)
    expect(armPositionFromAngle(-500)).toBe(0)
  })
  it('needle angle spans the dial and clamps', () => {
    expect(needleAngleDeg(0)).toBeLessThan(0)
    expect(needleAngleDeg(0.5)).toBe(0)
    expect(needleAngleDeg(2)).toBe(needleAngleDeg(1))
  })
  it('scale ticks match the range type', () => {
    expect(scaleTicks(3).filter((t) => t.major)).toHaveLength(7)
    // fine ticks: 0.1 V steps on the 3 V range, 0.02 V on the 1 V range
    expect(scaleTicks(3)).toHaveLength(31)
    expect(scaleTicks(1)).toHaveLength(51)
    expect(scaleTicks(1).filter((t) => t.major)).toHaveLength(11)
    expect(scaleTicks(0.3).at(-1)?.fraction).toBe(1)
    expect(scaleTicks(3).filter((t) => t.label !== null).map((t) => t.label)).toEqual(['0', '1', '2', '3'])
  })
  it('opacity is monotone and bounded', () => {
    expect(opacityFromIntensity(0)).toBe(0)
    expect(opacityFromIntensity(0.25)).toBeLessThan(opacityFromIntensity(0.5))
    expect(opacityFromIntensity(10)).toBe(1)
  })
  it('formats the stopwatch and templates', () => {
    expect(formatStopwatch(65.43)).toBe('1:05.4')
    expect(formatStopwatch(-3)).toBe('0:00.0')
    expect(fill('{a} and {b}', { a: 1, b: 'x' })).toBe('1 and x')
  })
})

import { announceDue, quantiseReading_V, readingDecimals, readingResolution_V } from '../src/views/benchkit'
describe('accessible meter reading', () => {
  it('resolution is half a fine tick', () => {
    expect(readingResolution_V(3)).toBeCloseTo(0.05, 12)
    expect(readingResolution_V(1)).toBeCloseTo(0.01, 12)
    expect(readingResolution_V(10)).toBeCloseTo(0.1, 12)
    expect(readingResolution_V(0.3)).toBeCloseTo(0.005, 12)
  })
  it('quantises and never goes negative', () => {
    expect(quantiseReading_V(1.4132, 3)).toBeCloseTo(1.4, 12)
    expect(quantiseReading_V(1.427, 3)).toBeCloseTo(1.45, 12)
    expect(quantiseReading_V(0.4137, 1)).toBeCloseTo(0.41, 12)
    expect(quantiseReading_V(-0.02, 3)).toBe(0)
  })
  it('decimals', () => {
    expect(readingDecimals(3)).toBe(2)
    expect(readingDecimals(1)).toBe(2)
    expect(readingDecimals(0.3)).toBe(3)
  })
  it('announces only on change and after the gap', () => {
    expect(announceDue('a', 'a', 0, 5000)).toBe(false)
    expect(announceDue('a', 'b', 0, 500)).toBe(false)
    expect(announceDue('a', 'b', 0, 1000)).toBe(true)
    expect(announceDue('', 'b', -Infinity, 0)).toBe(true)
  })
})
