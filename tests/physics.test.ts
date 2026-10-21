import { describe, expect, it } from 'vitest'
import {
  CATHODES, E_C, H_Js, HG_LINES, chargeCurve, emits, expectedReading_V, getLine, IDEAL, LAB, limitVoltage_V,
  linearFit, measureVisible, nuFromLambda, photocurrent_A, photonEnergy_eV, planckFromFit, step, steadyState_V,
  W_A_eV, maxContributingU0_V, retardingShape, R_INPUT_Ohm, ANODE_ILLUM_FRACTION, C_DA_F, C_TOTAL_F, K_B_eV_perK,
  forwardCurrent_A, fowlerF, linePower, photocurrentSlope_AperV, qeFactor, retardingShapeSlope_perV, reverseCurrent_A,
} from '../src/physics/index.ts'
import type { CircuitInputs, HgLineId } from '../src/physics/index.ts'

const nuOf = (id: HgLineId) => nuFromLambda(getLine(id).lambda_nm)
const visible: HgLineId[] = ['yellow', 'green', 'blue', 'violet']
const TABLE1: Record<string, number> = { yellow: 0.59, green: 0.7, blue: 1.23, violet: 1.4 }

function timeTo(frac: number, inp: CircuitInputs, U0: number): number {
  const c = chargeCurve(inp, 4000, 4000)
  const k = c.U_V.findIndex((u) => u >= frac * U0)
  return k < 0 ? Infinity : c.t_s[k]!
}

describe('photocell', () => {
  it('limit voltage equals (h nu - W_A)/e (eq. VII)', () => {
    for (const l of HG_LINES) {
      const nu = nuOf(l.id)
      expect(limitVoltage_V(nu, W_A_eV)).toBeCloseTo(Math.max(0, (H_Js * nu) / E_C - W_A_eV), 12)
    }
    expect(limitVoltage_V(nuOf('yellow'), 10)).toBe(0)
    expect(photonEnergy_eV(nuOf('violet'))).toBeGreaterThan(3)
  })
  it('photocurrent is zero at and above U0, monotone decreasing below', () => {
    const U0 = limitVoltage_V(nuOf('blue'))
    expect(photocurrent_A(U0, 'blue')).toBe(0)
    expect(photocurrent_A(U0 + 0.5, 'blue')).toBe(0)
    let prev = Infinity
    for (let U = -0.5; U <= U0 + 0.2; U += 0.01) {
      const I = photocurrent_A(U, 'blue')
      expect(I).toBeLessThanOrEqual(prev + 1e-30)
      prev = I
    }
    expect(photocurrent_A(0, 'blue')).toBeGreaterThan(photocurrent_A(0.5, 'blue'))
  })
  it('no photocurrent when h nu < W_C: Zn with visible lines gives no charging', () => {
    for (const id of visible) {
      expect(emits(nuOf(id), CATHODES.Zn.W_C_eV)).toBe(false)
      expect(photocurrent_A(0, id, { cathode: 'Zn' })).toBe(0)
      expect(steadyState_V({ line: id, cathode: 'Zn' })).toBe(0)
    }
  })
})

describe('ideal scenario', () => {
  it('long-time U equals the ideal U0 within 1 mV for each line', () => {
    for (const l of HG_LINES) {
      const U = expectedReading_V(IDEAL, l.id)
      expect(Math.abs(U - limitVoltage_V(nuOf(l.id)))).toBeLessThan(1e-3)
    }
  })
  it('fit of ideal U0 vs nu recovers h within 0.1 %', () => {
    const d = measureVisible(IDEAL)
    const h = planckFromFit(linearFit(d.nu_Hz, d.U_V).slope)
    expect(Math.abs(h / H_Js - 1)).toBeLessThan(1e-3)
  })
})

describe('charging dynamics', () => {
  it('curve is monotone non-decreasing and never exceeds the contributing max U0', () => {
    for (const s of [IDEAL, LAB]) for (const id of visible) {
      const inp: CircuitInputs = { ...s.params, line: id }
      const c = chargeCurve(inp, 120, 240)
      const cap = maxContributingU0_V(id, inp)
      for (let k = 1; k < c.U_V.length; k++) expect(c.U_V[k]!).toBeGreaterThanOrEqual(c.U_V[k - 1]! - 1e-9)
      expect(Math.max(...c.U_V)).toBeLessThanOrEqual(cap + 1e-9)
    }
  })
  it('beam intensity 25 % keeps the ideal U0 but at least doubles the 90 % time', () => {
    const base: CircuitInputs = { ...IDEAL.params, line: 'green' }
    const dim: CircuitInputs = { ...base, beamIntensity: 0.25 }
    expect(Math.abs(steadyState_V(dim) - steadyState_V(base))).toBeLessThan(1e-3)
    const U0 = limitVoltage_V(nuOf('green'))
    // Use a long-lived equilibrium reference: both curves are run to 4000 s, 90 % of U0 is reached by both.
    expect(timeTo(0.9, dim, U0)).toBeGreaterThanOrEqual(2 * timeTo(0.9, base, U0))
  })
  it('dirty cell plateau is clearly lower than clean', () => {
    const clean = steadyState_V({ ...LAB.params, line: 'violet', R_cell_Ohm: 1e14, stray_fraction: 0 })
    const dirty = steadyState_V({ ...LAB.params, line: 'violet', R_cell_Ohm: 1e12, stray_fraction: 0 })
    expect(dirty).toBeLessThan(clean - 0.1)
  })
  it('stray light raises the 60 s reading of yellow more than violet', () => {
    const gain = (id: HgLineId) => {
      const f = (stray: number) => {
        const c = chargeCurve({ ...LAB.params, line: id, stray_fraction: stray }, 60, 60)
        return c.U_V[60]!
      }
      return f(0.05) - f(0)
    }
    expect(gain('yellow')).toBeGreaterThan(gain('violet'))
    expect(gain('yellow')).toBeGreaterThan(0.01)
  })
  it('key switch held for 1 s from 1.5 V discharges below 1 mV', () => {
    const s = step({ U_V: 1.5 }, { ...LAB.params, line: 'violet', keyPressed: true }, 1)
    expect(s.U_V).toBeLessThan(1e-3)
  })
  it('RK4 result is step-size independent (dt 0.05 vs 0.5 s) within 1 mV at 60 s', () => {
    for (const id of visible) {
      const inp: CircuitInputs = { ...LAB.params, line: id }
      const run = (dt: number) => {
        let s = { U_V: 0 }
        for (let k = 0; k < Math.round(60 / dt); k++) s = step(s, inp, dt)
        return s.U_V
      }
      expect(Math.abs(run(0.05) - run(0.5))).toBeLessThan(1e-3)
    }
  })
})

describe('lab calibration (leaflet Table 1, steady state)', () => {
  const at = (id: HgLineId, t: number) => {
    const c = chargeCurve({ ...LAB.params, line: id }, t, Math.round(t))
    return c.U_V[c.U_V.length - 1]!
  }
  it('LAB plateaus: the meter stops moving between 60 s and 600 s', () => {
    for (const id of visible) {
      expect(Math.abs(at(id, 120) - at(id, 60))).toBeLessThan(0.01)
      expect(Math.abs(at(id, 600) - at(id, 60))).toBeLessThan(0.02)
    }
  })
  it('LAB steady states are within 0.01 V of Table 1 (4 fitted parameters, 4 points: a consistency check) and give h in 5.7-6.4e-34', () => {
    const U = visible.map((id) => steadyState_V({ ...LAB.params, line: id }))
    visible.forEach((id, k) => expect(Math.abs(U[k]! - TABLE1[id]!)).toBeLessThan(0.01))
    const h = planckFromFit(linearFit(visible.map(nuOf), U).slope)
    expect(h).toBeGreaterThan(5.7e-34)
    expect(h).toBeLessThan(6.4e-34)
  })
  it('the 60 s reading is within 20 mV of the steady state (leaflet: wait 30 s to 1 min)', () => {
    for (const id of visible)
      expect(Math.abs(at(id, 60) - steadyState_V({ ...LAB.params, line: id }))).toBeLessThan(0.02)
  })
  it('in LAB, a weaker beam lowers the plateau by the documented amount (leakage balance depends on I_sat)', () => {
    // PARAMETERS.md: beamIntensity 1 vs 0.25 -> yellow 0.588/0.553, green 0.704/0.673, blue 1.226/1.174, violet 1.401/1.309 V.
    const doc: Record<string, [number, number]> = { yellow: [0.588, 0.553], green: [0.704, 0.673], blue: [1.226, 1.174], violet: [1.401, 1.309] }
    for (const id of visible) {
      const full = steadyState_V({ ...LAB.params, line: id })
      const weak = steadyState_V({ ...LAB.params, line: id, beamIntensity: 0.25 })
      expect(Math.abs(full - doc[id]![0])).toBeLessThan(0.002)
      expect(Math.abs(weak - doc[id]![1])).toBeLessThan(0.002)
    }
    const h = (b: number) => planckFromFit(linearFit(visible.map(nuOf), visible.map((id) => steadyState_V({ ...LAB.params, line: id, beamIntensity: b }))).slope)
    expect(h(0.25) / h(1)).toBeGreaterThan(0.90) // documented: -6.3 %
    expect(h(0.25) / h(1)).toBeLessThan(0.96)
  })
})

describe('retarding shape with contact potential (W_A < W_C)', () => {
  const W_C = CATHODES.photocell.W_C_eV
  const nu = nuOf('blue')
  const U0 = limitVoltage_V(nu)
  it('is saturated up to (W_C - W_A)/e, 0 at U0 and falls over the real spread h nu - W_C', () => {
    const Usat = W_C - W_A_eV
    expect(Usat).toBeGreaterThan(0)
    expect(retardingShape(0, nu, W_C, W_A_eV)).toBe(1)
    expect(retardingShape(Usat - 1e-9, nu, W_C, W_A_eV)).toBe(1)
    expect(retardingShape(U0, nu, W_C, W_A_eV)).toBe(0)
    const spread = photonEnergy_eV(nu) - W_C
    expect(retardingShape(Usat + spread / 2, nu, W_C, W_A_eV)).toBeCloseTo(0.25, 12)
  })
  it('reduces to (1 - U/U0)^2 when W_A >= W_C', () => {
    const W_A = 2.0, Wc = 1.9
    const u0 = limitVoltage_V(nu, W_A)
    for (const f of [0, 0.2, 0.5, 0.9]) expect(retardingShape(f * u0, nu, Wc, W_A)).toBeCloseTo((1 - f) ** 2, 12)
  })
})

describe('what the intercept means', () => {
  it('ideal U0 does not depend on the cathode (Cs and photocell agree for blue, violet, green)', () => {
    for (const id of ['green', 'blue', 'violet'] as HgLineId[]) {
      const a = steadyState_V({ ...IDEAL.params, line: id, cathode: 'photocell' })
      const b = steadyState_V({ ...IDEAL.params, line: id, cathode: 'Cs' })
      expect(Math.abs(a - b)).toBeLessThan(1e-3)
      expect(Math.abs(a - limitVoltage_V(nuOf(id)))).toBeLessThan(1e-3)
    }
  })
  it('yellow emits with the photocell (1.9 eV) but not with pure K (2.29 eV)', () => {
    expect(emits(nuOf('yellow'), CATHODES.photocell.W_C_eV)).toBe(true)
    expect(emits(nuOf('yellow'), CATHODES.K.W_C_eV)).toBe(false)
    expect(photocurrent_A(0, 'yellow', { cathode: 'photocell' })).toBeGreaterThan(0)
    expect(photocurrent_A(0, 'yellow', { cathode: 'K' })).toBe(0)
  })
  it('the ideal fit intercept is -W_A/e (the anode, not the cathode)', () => {
    const d = measureVisible(IDEAL)
    const f = linearFit(d.nu_Hz, d.U_V)
    expect(Math.abs(f.intercept + W_A_eV)).toBeLessThan(2e-3)
    expect(Math.abs(f.intercept + CATHODES.photocell.W_C_eV)).toBeGreaterThan(0.3)
  })
})

describe('explore error sources with the finite electrometer input resistance', () => {
  const fitH = (extra: object) => {
    const U = visible.map((id) => steadyState_V({ ...IDEAL.params, ...extra, line: id }))
    return { U, h: planckFromFit(linearFit(visible.map(nuOf), U).slope) }
  }
  it('stray light with the ideal 1e21 Ohm drives every line towards the UV U0 (why the input resistance is needed)', () => {
    const { U } = fitH({ stray_fraction: 1e-3 })
    expect(Math.max(...U) - Math.min(...U)).toBeLessThan(0.5)
  })
  it('input resistance alone (no stray) keeps h within 3 % of true in the bright explore source', () => {
    expect(Math.abs(fitH({ R_input_Ohm: R_INPUT_Ohm }).h / H_Js - 1)).toBeLessThan(0.03)
  })
})

describe('Hg line intensities (lamp power x optics transmission)', () => {
  const rel = (id: HgLineId, optics: 'glass' | 'quartz' = 'glass') => linePower(id, optics)
  it('through glass the green 546 nm line is the strongest visible line and violet the weakest', () => {
    const vis = visible.map((id) => rel(id))
    expect(rel('green')).toBe(Math.max(...vis))
    expect(rel('violet')).toBe(Math.min(...vis))
    expect(rel('yellow')).toBeGreaterThan(rel('blue'))
    expect(rel('blue')).toBeGreaterThan(rel('violet'))
  })
  it('HG_LINES.relPower is the glass value and the line ids and wavelengths are unchanged', () => {
    expect(HG_LINES.map((l) => [l.id, l.lambda_nm])).toEqual([['yellow', 578], ['green', 546.1], ['blue', 435.8], ['violet', 404.7], ['uv', 365]])
    for (const l of HG_LINES) expect(l.relPower).toBeCloseTo(rel(l.id), 12)
  })
  it('glass absorbs the 365 nm line (at least 20x weaker than violet); quartz lets it through (UV within a factor 2 of green)', () => {
    expect(rel('uv', 'glass')).toBeLessThan(rel('violet') / 20)
    expect(rel('uv', 'quartz')).toBeGreaterThan(rel('green', 'quartz') / 2)
    for (const id of visible) expect(rel(id, 'quartz')).toBeGreaterThanOrEqual(rel(id, 'glass'))
  })
  it('quartz optics raise the UV photocurrent by more than 20x and leave the ideal U0 values alone', () => {
    const glass = photocurrent_A(0, 'uv', { ...IDEAL.params })
    const quartz = photocurrent_A(0, 'uv', { ...IDEAL.params, optics: 'quartz' })
    expect(quartz).toBeGreaterThan(20 * glass)
    expect(Math.abs(steadyState_V({ ...IDEAL.params, optics: 'quartz', line: 'uv' }) - limitVoltage_V(nuOf('uv')))).toBeLessThan(2e-3)
  })
})

describe('Fowler-type quantum yield', () => {
  const W = CATHODES.photocell.W_C_eV
  const nuAbove = (x_eV: number) => (E_C * (W + x_eV)) / H_Js
  it('is zero at and below threshold, positive above, monotone and below 1', () => {
    expect(qeFactor(nuAbove(0), W)).toBe(0)
    expect(qeFactor(nuAbove(-0.2), W)).toBe(0)
    let prev = 0
    for (let x = 0.01; x <= 3; x += 0.01) {
      const y = qeFactor(nuAbove(x), W)
      expect(y).toBeGreaterThan(prev)
      expect(y).toBeLessThan(1)
      prev = y
    }
  })
  it('follows (h nu - W)^2 near threshold: doubling the excess energy quadruples the yield', () => {
    const r = qeFactor(nuAbove(0.1), W) / qeFactor(nuAbove(0.05), W)
    expect(r).toBeGreaterThan(3.9)
    expect(r).toBeLessThan(4.05)
  })
  it('saturates smoothly: the slope falls continuously and the yield exceeds 0.95 well above threshold', () => {
    expect(qeFactor(nuAbove(2.0), W)).toBeGreaterThan(0.95)
    const d = (x: number) => (qeFactor(nuAbove(x + 0.01), W) - qeFactor(nuAbove(x), W)) / 0.01
    expect(d(1.5)).toBeLessThan(d(1.0))
    expect(d(1.0)).toBeLessThan(d(0.5))
    // no kink: neighbouring slopes differ by little
    for (let x = 0.05; x < 2.5; x += 0.05) expect(Math.abs(d(x + 0.05) - d(x))).toBeLessThan(0.15)
  })
})

describe('Fowler function and the thermal (Fermi-Dirac) tail of the cutoff', () => {
  const T = 298
  it('fowlerF matches the integral of ln(1 + e^s) and is continuous across its branches', () => {
    for (const t of [-6, -2, -1.0001, -0.5, 0, 0.5, 1, 2.5, 8]) {
      let sum = 0
      const n = 20000
      const a = -40
      const h = (t - a) / n
      for (let k = 0; k < n; k++) { const s = a + (k + 0.5) * h; sum += Math.log1p(Math.exp(s)) * h }
      expect(Math.abs(fowlerF(t) - sum)).toBeLessThan(1e-6)
    }
    // branch seams at |t| = 1: the Taylor series is truncated at order 11 (error ~1e-8), far below anything the model resolves
    for (const t0 of [-1, 1]) expect(Math.abs(fowlerF(t0 + 1e-9) - fowlerF(t0 - 1e-9))).toBeLessThan(5e-8)
  })
  it('at T = 0 the shape and slope are the sharp parabola (ideal unchanged)', () => {
    const nu = nuOf('blue')
    const U0 = limitVoltage_V(nu)
    expect(retardingShape(U0, nu, 1.9, W_A_eV, 0)).toBe(0)
    expect(retardingShape(U0 + 0.1, nu, 1.9, W_A_eV)).toBe(0)
    expect(retardingShape(0.6, nu, 1.9, W_A_eV, 0)).toBeCloseTo(((photonEnergy_eV(nu) - W_A_eV - 0.6) / (photonEnergy_eV(nu) - 1.9)) ** 2, 12)
  })
  it('at room temperature the collected current fades smoothly past U0: positive, monotone, ~e-fold per kT', () => {
    const nu = nuOf('blue')
    const U0 = limitVoltage_V(nu)
    const kT = K_B_eV_perK * T
    expect(kT).toBeCloseTo(0.0257, 3)
    const F = (U: number) => retardingShape(U, nu, 1.9, W_A_eV, T)
    expect(F(U0)).toBeGreaterThan(0)
    expect(F(U0)).toBeLessThan(2e-3) // already tiny at the sharp-cutoff voltage
    let prev = Infinity
    for (let U = 0; U <= U0 + 0.4; U += 0.002) {
      const f = F(U)
      expect(f).toBeLessThanOrEqual(prev + 1e-15)
      prev = f
    }
    expect(F(U0 + 3 * kT) / F(U0 + 2 * kT)).toBeGreaterThan(Math.exp(-1) * 0.85)
    expect(F(U0 + 3 * kT) / F(U0 + 2 * kT)).toBeLessThan(Math.exp(-1) * 1.15)
    // slope matches a numerical derivative, so the step control sees the real slope
    for (const U of [0.5, U0 - 0.05, U0, U0 + 0.05]) {
      const num = (F(U + 1e-5) - F(U - 1e-5)) / 2e-5
      expect(retardingShapeSlope_perV(U, nu, 1.9, W_A_eV, T)).toBeCloseTo(num, 3)
    }
  })
  it('the steady state stays below the upper bound that includes the tail margin, and the cutoff creeps only by about kT', () => {
    for (const id of visible) {
      const p = { ...IDEAL.params, R_input_Ohm: R_INPUT_Ohm, R_cell_Ohm: 1e21, T_K: T, line: id }
      const U = steadyState_V(p)
      const U0 = limitVoltage_V(nuOf(id))
      expect(U).toBeLessThan(maxContributingU0_V(id, p))
      expect(U).toBeGreaterThan(U0 - 0.01)
      expect(U).toBeLessThan(U0 + 6 * K_B_eV_perK * T)
    }
  })
  it('with the ideal 1e21 Ohm leak a thermal tail lets U creep past U0 (why the ideal scenario keeps T = 0)', () => {
    const id: HgLineId = 'green'
    const U = steadyState_V({ ...IDEAL.params, T_K: T, line: id })
    expect(U).toBeGreaterThan(limitVoltage_V(nuOf(id)) + 0.03)
  })
  it('the integrator stays stable and finite with the tail on (Lab, 10 min, large steps)', () => {
    for (const id of visible) {
      let s = { U_V: 0 } as { U_V: number; Uda_V?: number }
      for (let k = 0; k < 20; k++) s = step(s, { ...LAB.params, line: id }, 30)
      expect(Number.isFinite(s.U_V)).toBe(true)
      expect(s.U_V).toBeLessThanOrEqual(maxContributingU0_V(id, { ...LAB.params }))
      expect(Math.abs(s.U_V - steadyState_V({ ...LAB.params, line: id }))).toBeLessThan(1e-3)
    }
  })
})

describe('reverse (anode) photocurrent', () => {
  const T0 = { ...LAB.params, T_K: 0 }
  it('is absent without anode illumination, positive with it, and saturated for U >= (W_C - W_A)/e', () => {
    expect(reverseCurrent_A(1, 'blue', { ...T0, anode_fraction: 0 })).toBe(0)
    const Usat = CATHODES.photocell.W_C_eV - W_A_eV
    const R = (U: number) => reverseCurrent_A(U, 'blue', T0)
    expect(R(Usat + 0.01)).toBeGreaterThan(0)
    expect(R(Usat + 0.01)).toBeCloseTo(R(1.2), 12)
    expect(R(0)).toBeLessThan(R(Usat)) // contact field partly retards it at U = 0
  })
  it('lowers the net current: sign is opposite to the charging current, and it survives at U0 where the forward current is zero', () => {
    const U0 = limitVoltage_V(nuOf('violet'))
    const p = { ...IDEAL.params, anode_fraction: 0.01 }
    expect(photocurrent_A(U0, 'violet', p)).toBeLessThan(0)
    expect(forwardCurrent_A(U0, 'violet', p)).toBe(0)
    expect(photocurrent_A(0, 'violet', p)).toBeLessThan(forwardCurrent_A(0, 'violet', p))
    expect(photocurrent_A(0, 'violet', p)).toBeGreaterThan(0)
  })
  it('lowers every plateau, keeps them strictly ordered, and lowers the fitted h', () => {
    const base = { ...IDEAL.params, R_input_Ohm: R_INPUT_Ohm }
    const U = (a: number) => visible.map((id) => steadyState_V({ ...base, anode_fraction: a, line: id }))
    const clean = U(0), rev = U(ANODE_ILLUM_FRACTION)
    visible.forEach((_, k) => expect(rev[k]!).toBeLessThan(clean[k]! - 1e-4))
    for (let k = 1; k < 4; k++) expect(rev[k]!).toBeGreaterThan(rev[k - 1]! + 0.05)
    const h = (u: number[]) => planckFromFit(linearFit(visible.map(nuOf), u).slope)
    expect(h(rev)).toBeLessThan(h(clean))
  })
  it('slope of the net current stays <= 0 (integrator step control) and matches a numerical derivative', () => {
    const p = { ...LAB.params, line: 'blue' as HgLineId }
    for (const U of [0, 0.2, 0.5, 1.0, 1.2, 1.3]) {
      const s = photocurrentSlope_AperV(U, 'blue', p)
      expect(s).toBeLessThanOrEqual(0)
      const num = (photocurrent_A(U + 1e-6, 'blue', p) - photocurrent_A(U - 1e-6, 'blue', p)) / 2e-6
      expect(Math.abs(s - num)).toBeLessThan(Math.abs(num) * 0.02 + 1e-16)
    }
  })
})

describe('dielectric absorption of the capacitor (soak-back)', () => {
  const dark: CircuitInputs = { ...LAB.params, relPower: { yellow: 0, green: 0, blue: 0, violet: 0, uv: 0 }, line: 'violet', R_cell_Ohm: 1e21, R_input_Ohm: 1e21 }
  const soak = (hold_s: number) => {
    let s: { U_V: number; Uda_V?: number } = { U_V: 1.4, Uda_V: 1.4 }
    s = step(s, { ...dark, keyPressed: true }, hold_s)
    let peak = 0
    for (let t = 0; t < 900; t++) { s = step(s, dark, 1); peak = Math.max(peak, s.U_V) }
    return peak
  }
  it('some voltage creeps back after a short discharge, bounded by the capacitor DA fraction (~0.03 %)', () => {
    const peak = soak(1)
    const bound = (1.4 * C_DA_F) / (C_TOTAL_F + C_DA_F)
    expect(peak).toBeGreaterThan(0.5 * bound)
    expect(peak).toBeLessThan(bound)
    expect(peak / 1.4).toBeLessThan(5e-4) // polystyrene: 0.01 to 0.05 %
  })
  it('vanishes after a long discharge (many absorption time constants)', () => {
    expect(soak(300)).toBeLessThan(0.01 * soak(1))
  })
  it('does not change the steady state', () => {
    for (const id of visible) {
      const a = steadyState_V({ ...LAB.params, line: id })
      const b = steadyState_V({ ...LAB.params, C_da_F: undefined, R_da_Ohm: undefined, line: id })
      expect(a).toBe(b)
    }
  })
})
