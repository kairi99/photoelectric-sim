import { describe, expect, it } from 'vitest'
import { Apparatus } from '../src/apparatus/index.ts'
import {
  E_C, H_Js, METER_CLASS_PCT, compareToAccepted, groupStats, linearFit, lineSigma_V, meterClassError_V, mulberry32,
  needleSigma_V, roundWithUncertainty, systematicH_Js, weightedLinearFit,
} from '../src/physics/index.ts'

describe('weightedLinearFit', () => {
  it('matches a hand-computed case', () => {
    // points (0,1) s=1, (1,3) s=1, (2,4) s=0.5: w = 1, 1, 4 -> S=6, Sx=9, Sy=20, Sxx=17, Sxy=35
    // D = 6*17 - 81 = 21; slope = (6*35 - 9*20)/21 = 30/21; intercept = (17*20 - 9*35)/21 = 25/21
    const f = weightedLinearFit([0, 1, 2], [1, 3, 4], [1, 1, 0.5])
    expect(f.slope).toBeCloseTo(30 / 21, 12)
    expect(f.intercept).toBeCloseTo(25 / 21, 12)
    expect(f.sigma_slope).toBeCloseTo(Math.sqrt(6 / 21), 12)
    expect(f.sigma_intercept).toBeCloseTo(Math.sqrt(17 / 21), 12)
    // chi2 = sum w r^2 ; fit values 25/21, 55/21, 85/21 ; r = -4/21... computed directly
    const r = [1 - 25 / 21, 3 - 55 / 21, 4 - 85 / 21]
    expect(f.chi2).toBeCloseTo(r[0]! ** 2 + r[1]! ** 2 + 4 * r[2]! ** 2, 12)
    expect(f.dof).toBe(1)
    expect(f.chi2_red).toBeCloseTo(f.chi2, 12)
  })
  it('equal weights reduce to the unweighted fit', () => {
    const xs = [519, 549, 688, 741]
    const ys = [0.59, 0.7, 1.23, 1.4]
    const u = linearFit(xs, ys)
    const w = weightedLinearFit(xs, ys, [0.02, 0.02, 0.02, 0.02])
    expect(w.slope).toBeCloseTo(u.slope, 12)
    expect(w.intercept).toBeCloseTo(u.intercept, 10)
    // with the sigma equal to the rms residual the quoted error equals the unweighted one
    const rms = Math.sqrt(xs.reduce((a, x, i) => a + (ys[i]! - (u.slope * x + u.intercept)) ** 2, 0) / 2)
    expect(weightedLinearFit(xs, ys, xs.map(() => rms)).sigma_slope).toBeCloseTo(u.sigma_slope, 10)
  })
  it('two points: exact line, chi2_red undefined', () => {
    const f = weightedLinearFit([1, 2], [2, 4], [0.1, 0.3])
    expect(f.slope).toBeCloseTo(2, 12)
    expect(f.chi2_red).toBeNull()
  })
  it('recovers h and its sigma from synthetic noisy data (coverage over many runs)', () => {
    const rng = mulberry32(2026)
    const gauss = (): number => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())
    const nu = [519, 549, 688, 741].map((t) => t * 1e12)
    const sigma = 0.02
    const slopeTrue = H_Js / E_C
    let within1 = 0
    let chi = 0
    const N = 400
    for (let k = 0; k < N; k++) {
      const U = nu.map((n) => slopeTrue * n - 1.5 + sigma * gauss())
      const f = weightedLinearFit(nu, U, nu.map(() => sigma))
      if (Math.abs(f.slope - slopeTrue) <= f.sigma_slope) within1++
      chi += f.chi2_red!
    }
    expect(within1 / N).toBeGreaterThan(0.6) // ~68 % expected
    expect(within1 / N).toBeLessThan(0.76)
    expect(chi / N).toBeGreaterThan(0.85) // E[chi2_red] = 1 when the sigmas are right
    expect(chi / N).toBeLessThan(1.15)
  })
  it('rejects non-positive sigmas', () => {
    expect(() => weightedLinearFit([1, 2], [1, 2], [0, 1])).toThrow()
  })
})

describe('repeated readings', () => {
  it('mean, sample standard deviation and standard error', () => {
    const g = groupStats([0.58, 0.6, 0.62, 0.6], [0.02, 0.02, 0.02, 0.02])
    expect(g.n).toBe(4)
    expect(g.mean_V).toBeCloseTo(0.6, 12)
    expect(g.sd_V).toBeCloseTo(Math.sqrt((0.0004 + 0 + 0.0004 + 0) / 3), 12)
    expect(g.sem_V).toBeCloseTo(g.sd_V / 2, 12)
    expect(g.sigmaInstr_V).toBeCloseTo(0.02, 12)
  })
  it('error bar is max(s, sigma)/sqrt(n): never below what the needle resolves, one reading gives sigma', () => {
    expect(groupStats([0.6], [0.02]).sigmaLine_V).toBeCloseTo(0.02, 12)
    expect(groupStats([0.6], [0.02]).sd_V).toBe(0)
    expect(groupStats([0.6, 0.6, 0.6, 0.6], [0.02, 0.02, 0.02, 0.02]).sigmaLine_V).toBeCloseTo(0.01, 12) // s = 0 -> sigma/2
    expect(lineSigma_V(0.1, 0.02, 4)).toBeCloseTo(0.05, 12) // large scatter dominates
  })
  it('needs one sigma per reading', () => {
    expect(() => groupStats([1, 2], [0.1])).toThrow()
  })
})

describe('instrument uncertainty and systematics', () => {
  it('needle readability is a fifth of the smallest division: 0.02 V on 3 V, 0.004 V on 1 V', () => {
    expect(needleSigma_V(3)).toBeCloseTo(0.02, 12)
    expect(needleSigma_V(1)).toBeCloseTo(0.004, 12)
  })
  it('class error is a percentage of full scale: 0.075 V on 3 V', () => {
    expect(meterClassError_V(3)).toBeCloseTo(0.075, 12)
  })
  it('a pure gain error scales the slope (and h) by the same fraction; an offset leaves it unchanged', () => {
    const xs = [519, 549, 688, 741]
    const ys = xs.map((x) => 0.0037 * x - 1.3)
    const s0 = linearFit(xs, ys).slope
    expect(linearFit(xs, ys.map((y) => y * (1 + METER_CLASS_PCT / 100))).slope / s0).toBeCloseTo(1.025, 12)
    expect(linearFit(xs, ys.map((y) => y + 0.075)).slope / s0).toBeCloseTo(1, 12)
    expect(systematicH_Js(6e-34) / 6e-34).toBeCloseTo(0.025, 12)
  })
  it('apparatus: default sigma follows the instrument and the typed sigma is validated', () => {
    const lab = new Apparatus({ mode: 'lab' })
    lab.setRange(3)
    expect(lab.defaultSigma_V()).toBeCloseTo(0.02, 12)
    lab.setRange(1)
    expect(lab.defaultSigma_V()).toBeCloseTo(0.004, 12)
    expect(lab.record(0.5, 0.05)).toMatchObject({ ok: true, measurement: { sigma_V: 0.05 } })
    expect(lab.record(0.5, 0)).toEqual({ ok: false, error: 'invalid-uncertainty' })
    expect(lab.record(0.5, -1).ok).toBe(false)
    expect(lab.record(0.5)).toMatchObject({ ok: true, measurement: { sigma_V: 0.004, sigmaSys_V: 0.025 } })
    const ex = new Apparatus({ mode: 'explore' })
    ex.setLamp(true)
    expect(ex.record()).toMatchObject({ ok: true, measurement: { sigma_V: 0.001, sigmaSys_V: 0 } })
  })
  it('apparatus: the fit uses per-line means with weights and reports h with sigma and the systematic', () => {
    const a = new Apparatus({ mode: 'lab' })
    a.setRange(3)
    const rec = (line: 'yellow' | 'green' | 'blue' | 'violet', v: number): void => {
      a.setArm(a.linePosition(line))
      a.record(v)
    }
    rec('yellow', 0.58); rec('yellow', 0.6); rec('yellow', 0.62)
    rec('green', 0.7); rec('blue', 1.23); rec('violet', 1.4)
    const lines = a.lineSummaries()
    expect(lines.map((l) => l.lineId)).toEqual(['yellow', 'green', 'blue', 'violet'])
    expect(lines[0]!.n).toBe(3)
    expect(lines[0]!.mean_V).toBeCloseTo(0.6, 12)
    const f = a.fitResult()!
    expect(f.nLines).toBe(4)
    expect(f.n).toBe(6)
    expect(f.sigma_h_Js).toBeGreaterThan(0)
    expect(f.sigma_h_sys_Js).toBeCloseTo(f.h_Js * 0.025, 20)
    expect(f.offset_sys_V).toBeCloseTo(0.075, 12)
    expect(f.chi2_red).not.toBeNull()
    expect(f.vsAccepted.deviation_pct).toBeCloseTo(((f.h_Js - H_Js) / H_Js) * 100, 9)
  })
})

describe('comparison with the accepted value', () => {
  it.each([
    [6.6e-34, 0.3e-34, 'within1'],
    [6.0e-34, 0.4e-34, 'within2'], // 1.57 sigma
    [5.9e-34, 0.17e-34, 'beyond2'], // 4.3 sigma
    [7.6e-34, 0.4e-34, 'beyond2'],
  ])('h = %s +- %s is %s', (h, s, v) => {
    expect(compareToAccepted(h, s).verdict).toBe(v)
  })
  it('gives the signed deviation in percent and in sigma; the edges are inclusive', () => {
    const c = compareToAccepted(H_Js - 2 * 0.1e-34, 0.1e-34)
    expect(c.deviation_sigma).toBeCloseTo(-2, 9)
    expect(c.verdict).toBe('within2')
    expect(compareToAccepted(5.9e-34, 0.3e-34).deviation_pct).toBeCloseTo(((5.9e-34 - H_Js) / H_Js) * 100, 9)
  })
})

describe('roundWithUncertainty', () => {
  it('keeps two digits when the sigma starts with 1 or 2, else one', () => {
    expect(roundWithUncertainty(5.9123, 0.2678)).toMatchObject({ value: 5.91, sigma: 0.27, decimals: 2 })
    expect(roundWithUncertainty(5.9123, 0.3678)).toMatchObject({ value: 5.9, sigma: 0.4, decimals: 1 })
    expect(roundWithUncertainty(0.6043, 0.02)).toMatchObject({ value: 0.6, sigma: 0.02, decimals: 2 })
  })
  it('handles rounding up across a power of ten and large sigmas', () => {
    expect(roundWithUncertainty(1.234, 0.96)).toMatchObject({ sigma: 1, decimals: 0, value: 1 })
    expect(roundWithUncertainty(1234, 30).decimals).toBe(-1)
  })
})
