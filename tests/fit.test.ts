import { describe, expect, it } from 'vitest'
import { E_C, linearFit, mulberry32, planckFromFit, withReadingNoise } from '../src/physics/index.ts'

describe('linearFit', () => {
  it('recovers slope and intercept of exact synthetic data', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = xs.map((x) => 3.5 * x - 2)
    const f = linearFit(xs, ys)
    expect(f.slope).toBeCloseTo(3.5, 12)
    expect(f.intercept).toBeCloseTo(-2, 12)
    expect(f.r2).toBeCloseTo(1, 12)
    expect(f.sigma_slope).toBeLessThan(1e-12)
  })
  it('gives non-zero uncertainties for noisy data and h = e * slope', () => {
    const f = linearFit([0, 1, 2, 3], [0.1, 0.9, 2.2, 2.8])
    expect(f.sigma_slope).toBeGreaterThan(0)
    expect(f.r2).toBeLessThan(1)
    expect(planckFromFit(2)).toBeCloseTo(2 * E_C, 30)
  })
})

describe('noise', () => {
  it('RNG is deterministic per seed and differs between seeds', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43)
    const sa = [a(), a(), a()], sb = [b(), b(), b()]
    expect(sa).toEqual(sb)
    expect(c()).not.toBe(sa[0])
    sa.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) })
  })
  it('zero sigma returns expectation plus offset; noise is reproducible', () => {
    expect(withReadingNoise(1, mulberry32(1), 0)).toBe(1)
    expect(withReadingNoise(1, mulberry32(1), 0, 0.02)).toBeCloseTo(1.02, 12)
    expect(withReadingNoise(1, mulberry32(7), 0.01)).toBe(withReadingNoise(1, mulberry32(7), 0.01))
  })
})
