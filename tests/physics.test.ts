import { describe, expect, it } from 'vitest'
import {
  CATHODES, E_C, H_Js, HG_LINES, chargeCurve, emits, expectedReading_V, getLine, IDEAL, LAB, limitVoltage_V,
  linearFit, measureVisible, nuFromLambda, photocurrent_A, photonEnergy_eV, planckFromFit, step, steadyState_V,
  W_A_eV, maxContributingU0_V,
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
      for (let k = 1; k < c.U_V.length; k++) expect(c.U_V[k]!).toBeGreaterThanOrEqual(c.U_V[k - 1]! - 1e-12)
      expect(Math.max(...c.U_V)).toBeLessThanOrEqual(cap + 1e-9)
    }
  })
  it('dimming to 25 % keeps the ideal U0 but at least doubles the 90 % time', () => {
    const base: CircuitInputs = { ...IDEAL.params, line: 'green' }
    const dim: CircuitInputs = { ...base, dimming: 0.25 }
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
  it('in LAB, dimming slightly changes the plateau (leakage balance depends on I_sat)', () => {
    const a = steadyState_V({ ...LAB.params, line: 'violet' })
    const b = steadyState_V({ ...LAB.params, line: 'violet', dimming: 0.25 })
    expect(b).toBeLessThan(a)
  })
})
