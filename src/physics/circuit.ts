import { photocurrent_A, photocurrentSlope_AperV, maxContributingU0_V } from './photocell.ts'
import type { PhotoOptions } from './photocell.ts'
import type { HgLineId } from './constants.ts'

/** Capacitor 100 pF plus ~20 pF cell, cable and electrometer input capacitance (estimate, PARAMETERS.md). */
export const C_TOTAL_F = 120e-12
export const R_CELL_CLEAN_Ohm = 1e14
export const R_CELL_DIRTY_Ohm = 1e12
/** Electrometer amplifier input resistance (leaflet-class device: > 1e13 Ohm). */
export const R_INPUT_Ohm = 1e13
/**
 * Time constant of the capacitor discharge while the key switch (short across the capacitor) is held (s). Assumed:
 * the real short is a few kOhm x ~120 pF (microseconds), so this is a deliberately slow, visible discharge; it is a
 * property of the short, not of the meter needle lag (NEEDLE_TAU_s in the apparatus).
 */
export const KEY_TAU_s = 0.05

/**
 * Dielectric absorption of the 100 pF capacitor (polystyrene/styroflex), modelled as one extra branch C_da in series with
 * R_da across the capacitor. Literature: polystyrene film capacitors show DA of about 0.01 to 0.05 % (the voltage that
 * creeps back after a short discharge, as a fraction of the charging voltage). C_DA_F = 0.036 pF gives a recovered
 * fraction C_da / (C_total + C_da) = 3.0e-4 (0.03 %), the middle of that range. The branch time constant tau_da =
 * R_da C_da = 20 s is ASSUMED (typical slow absorption times are seconds to minutes). PARAMETERS.md.
 */
export const C_DA_F = 0.036e-12
export const TAU_DA_s = 20
export const R_DA_Ohm = TAU_DA_s / C_DA_F

/** Largest voltage change allowed in one integration sub-step (V): numerical, not physical. */
export const MAX_STEP_V = 0.01

export interface CircuitInputs extends PhotoOptions {
  line: HgLineId
  keyPressed?: boolean
  C_F?: number
  R_cell_Ohm?: number // cell surface leakage (anode-cathode)
  R_input_Ohm?: number // electrometer input
  /** Dielectric-absorption branch (C_da in series with R_da across the capacitor); omit both for an ideal capacitor. */
  C_da_F?: number
  R_da_Ohm?: number
}

export interface CircuitState {
  U_V: number
  /** Voltage on the dielectric-absorption branch capacitor C_da (V); defaults to U_V (branch in equilibrium). */
  Uda_V?: number
}

/** Parallel combination of cell leakage and electrometer input resistance (Ohm). */
export function totalLeakage_Ohm(i: CircuitInputs): number {
  const a = i.R_cell_Ohm ?? R_CELL_CLEAN_Ohm
  const b = i.R_input_Ohm ?? R_INPUT_Ohm
  return (a * b) / (a + b)
}

/**
 * C dU/dt = I_photo(U) - U/R_total - (U - Uda)/R_da (Kirchhoff current law at the capacitor; the last term is the
 * dielectric-absorption branch, absent when R_da_Ohm is not given). Returns V/s.
 */
export function dUdt(U_V: number, i: CircuitInputs, Uda_V: number = U_V): number {
  const C = i.C_F ?? C_TOTAL_F
  const branch = i.R_da_Ohm && i.C_da_F ? (U_V - Uda_V) / i.R_da_Ohm : 0
  return (photocurrent_A(U_V, i.line, i) - U_V / totalLeakage_Ohm(i) - branch) / C
}

/** C_da dUda/dt = (U - Uda)/R_da, the charge flowing into the absorption branch. Returns V/s (0 without a branch). */
export function dUdaDt(U_V: number, Uda_V: number, i: CircuitInputs): number {
  return i.R_da_Ohm && i.C_da_F ? (U_V - Uda_V) / (i.R_da_Ohm * i.C_da_F) : 0
}

/**
 * Absorption-branch voltage after the key has been held for dt_s while the capacitor decays as U0 exp(-t/KEY_TAU_s):
 * the branch discharges with tau_da towards the (near-zero) capacitor voltage, and soaks up a little of the initial U0
 * (the integral of U over the decay is U0 KEY_TAU_s (1 - e^(-dt/KEY_TAU_s))). Closed form, no ODE.
 */
export function daKeyHeld_V(U0_V: number, Uda_V: number, dt_s: number, i: Pick<CircuitInputs, 'C_da_F' | 'R_da_Ohm'>): number {
  if (!i.R_da_Ohm || !i.C_da_F) return Uda_V
  const tau = i.R_da_Ohm * i.C_da_F
  const e = Math.exp(-dt_s / tau)
  return e * (Uda_V + (U0_V * KEY_TAU_s * (1 - Math.exp(-dt_s / KEY_TAU_s))) / tau)
}

function rk4(U: number, Uda: number, h: number, i: CircuitInputs): [number, number] {
  const a1 = dUdt(U, i, Uda), b1 = dUdaDt(U, Uda, i)
  const a2 = dUdt(U + 0.5 * h * a1, i, Uda + 0.5 * h * b1), b2 = dUdaDt(U + 0.5 * h * a1, Uda + 0.5 * h * b1, i)
  const a3 = dUdt(U + 0.5 * h * a2, i, Uda + 0.5 * h * b2), b3 = dUdaDt(U + 0.5 * h * a2, Uda + 0.5 * h * b2, i)
  const a4 = dUdt(U + h * a3, i, Uda + h * b3), b4 = dUdaDt(U + h * a3, Uda + h * b3, i)
  return [U + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4), Uda + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4)]
}

/**
 * Advance the capacitor voltage by dt_s. Key held: analytic exponential discharge (stiff, no ODE).
 * Otherwise RK4 with adaptive sub-steps limited to a fraction of the local time constant, so dt up to
 * many seconds is stable and accurate.
 */
export function step(state: CircuitState, i: CircuitInputs, dt_s: number): CircuitState {
  const Uda0 = state.Uda_V ?? state.U_V
  if (i.keyPressed) {
    return { U_V: state.U_V * Math.exp(-dt_s / KEY_TAU_s), Uda_V: daKeyHeld_V(state.U_V, Uda0, dt_s, i) }
  }
  const C = i.C_F ?? C_TOTAL_F
  const G_leak = 1 / totalLeakage_Ohm(i)
  let U = state.U_V
  let Uda = Uda0
  let t = 0
  while (t < dt_s) {
    const rate = (-photocurrentSlope_AperV(U, i.line, i) + G_leak) / C // 1/s
    let h = Math.min(dt_s - t, rate > 0 ? 0.1 / rate : dt_s)
    // The saturated plateau of F(U) has zero slope, so also limit the voltage change per sub-step (no jump over the kink).
    h = Math.min(h, MAX_STEP_V / Math.max(Math.abs(dUdt(U, i, Uda)), 1e-12))
    h = Math.max(h, Math.min(dt_s - t, 1e-3))
    ;[U, Uda] = rk4(U, Uda, h, i)
    t += h
  }
  return { U_V: U, Uda_V: Uda }
}

/** Equilibrium voltage where I_photo(U) = U/R_total, found by bisection (V). */
export function steadyState_V(i: CircuitInputs): number {
  const G = 1 / totalLeakage_Ohm(i)
  const hi0 = maxContributingU0_V(i.line, i)
  if (hi0 <= 0) return 0
  let lo = 0
  let hi = hi0
  for (let n = 0; n < 200; n++) {
    const mid = 0.5 * (lo + hi)
    if (photocurrent_A(mid, i.line, i) - mid * G > 0) lo = mid
    else hi = mid
  }
  return 0.5 * (lo + hi)
}

/** Charging curve after releasing the key from a discharged capacitor: n+1 samples t_s, U_V on [0, t_end_s]. */
export function chargeCurve(
  i: CircuitInputs,
  t_end_s: number,
  n: number,
  U0_V = 0,
): { t_s: number[]; U_V: number[] } {
  const t_s: number[] = []
  const U_V: number[] = []
  let s: CircuitState = { U_V: U0_V, Uda_V: U0_V }
  const dt = t_end_s / n
  const free = { ...i, keyPressed: false }
  for (let k = 0; k <= n; k++) {
    t_s.push(k * dt)
    U_V.push(s.U_V)
    if (k < n) s = step(s, free, dt)
  }
  return { t_s, U_V }
}
