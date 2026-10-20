import { describe, expect, it } from 'vitest'
import {
  CATHODES, E_C, H_Js, HG_LINES, chargeCurve, emits, expectedReading_V, getLine, IDEAL, LAB, limitVoltage_V,
  linearFit, measureVisible, nuFromLambda, photocurrent_A, photonEnergy_eV, planckFromFit, step, steadyState_V,
  W_A_eV, maxContributingU0_V, retardingShape, R_INPUT_Ohm,
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
  it('LAB steady states are within 0.05 V of Table 1 and give h in 5.7-6.4e-34', () => {
    const U = visible.map((id) => steadyState_V({ ...LAB.params, line: id }))
    visible.forEach((id, k) => expect(Math.abs(U[k]! - TABLE1[id]!)).toBeLessThan(0.05))
    const h = planckFromFit(linearFit(visible.map(nuOf), U).slope)
    expect(h).toBeGreaterThan(5.7e-34)
    expect(h).toBeLessThan(6.4e-34)
  })
  it('the 60 s reading is within 20 mV of the steady state (leaflet: wait 30 s to 1 min)', () => {
    for (const id of visible)
      expect(Math.abs(at(id, 60) - steadyState_V({ ...LAB.params, line: id }))).toBeLessThan(0.02)
  })
  it('in LAB, a weaker beam lowers the plateau by the documented amount (leakage balance depends on I_sat)', () => {
    // PARAMETERS.md: beamIntensity 1 vs 0.25 -> yellow 0.592/0.553, green 0.702/0.655, blue 1.218/1.126, violet 1.407/1.290 V.
    const doc: Record<string, [number, number]> = { yellow: [0.592, 0.553], green: [0.702, 0.655], blue: [1.218, 1.126], violet: [1.407, 1.290] }
    for (const id of visible) {
      const full = steadyState_V({ ...LAB.params, line: id })
      const weak = steadyState_V({ ...LAB.params, line: id, beamIntensity: 0.25 })
      expect(Math.abs(full - doc[id]![0])).toBeLessThan(0.002)
      expect(Math.abs(weak - doc[id]![1])).toBeLessThan(0.002)
    }
    const h = (b: number) => planckFromFit(linearFit(visible.map(nuOf), visible.map((id) => steadyState_V({ ...LAB.params, line: id, beamIntensity: b }))).slope)
    expect(h(0.25) / h(1)).toBeGreaterThan(0.88)
    expect(h(0.25) / h(1)).toBeLessThan(0.94)
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
