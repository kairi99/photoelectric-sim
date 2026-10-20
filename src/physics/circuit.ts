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

/** Largest voltage change allowed in one integration sub-step (V): numerical, not physical. */
export const MAX_STEP_V = 0.01

export interface CircuitInputs extends PhotoOptions {
  line: HgLineId
  keyPressed?: boolean
  C_F?: number
  R_cell_Ohm?: number // cell surface leakage (anode-cathode)
  R_input_Ohm?: number // electrometer input
}

export interface CircuitState {
  U_V: number
}

/** Parallel combination of cell leakage and electrometer input resistance (Ohm). */
export function totalLeakage_Ohm(i: CircuitInputs): number {
  const a = i.R_cell_Ohm ?? R_CELL_CLEAN_Ohm
  const b = i.R_input_Ohm ?? R_INPUT_Ohm
  return (a * b) / (a + b)
}

/** C dU/dt = I_photo(U) - U/R_total (Kirchhoff current law at the capacitor). Returns V/s. */
export function dUdt(U_V: number, i: CircuitInputs): number {
  const C = i.C_F ?? C_TOTAL_F
  return (photocurrent_A(U_V, i.line, i) - U_V / totalLeakage_Ohm(i)) / C
}

function rk4(U: number, h: number, i: CircuitInputs): number {
  const k1 = dUdt(U, i)
  const k2 = dUdt(U + 0.5 * h * k1, i)
  const k3 = dUdt(U + 0.5 * h * k2, i)
  const k4 = dUdt(U + h * k3, i)
  return U + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4)
}

/**
 * Advance the capacitor voltage by dt_s. Key held: analytic exponential discharge (stiff, no ODE).
 * Otherwise RK4 with adaptive sub-steps limited to a fraction of the local time constant, so dt up to
 * many seconds is stable and accurate.
 */
export function step(state: CircuitState, i: CircuitInputs, dt_s: number): CircuitState {
  if (i.keyPressed) return { U_V: state.U_V * Math.exp(-dt_s / KEY_TAU_s) }
  const C = i.C_F ?? C_TOTAL_F
  const G_leak = 1 / totalLeakage_Ohm(i)
  let U = state.U_V
  let t = 0
  while (t < dt_s) {
    const rate = (-photocurrentSlope_AperV(U, i.line, i) + G_leak) / C // 1/s
    let h = Math.min(dt_s - t, rate > 0 ? 0.1 / rate : dt_s)
    // The saturated plateau of F(U) has zero slope, so also limit the voltage change per sub-step (no jump over the kink).
    h = Math.min(h, MAX_STEP_V / Math.max(Math.abs(dUdt(U, i)), 1e-12))
    h = Math.max(h, Math.min(dt_s - t, 1e-3))
    U = rk4(U, h, i)
    t += h
  }
  return { U_V: U }
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
  let s: CircuitState = { U_V: U0_V }
  const dt = t_end_s / n
  const free = { ...i, keyPressed: false }
  for (let k = 0; k <= n; k++) {
    t_s.push(k * dt)
    U_V.push(s.U_V)
    if (k < n) s = step(s, free, dt)
  }
  return { t_s, U_V }
}
