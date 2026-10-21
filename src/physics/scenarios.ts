import { ANODE_ILLUM_FRACTION, T_ROOM_K, nuFromLambda } from './photocell.ts'
import { getLine, HG_LINES } from './constants.ts'
import type { HgLineId } from './constants.ts'
import { C_DA_F, R_DA_Ohm, steadyState_V, chargeCurve } from './circuit.ts'
import type { CircuitInputs } from './circuit.ts'

export interface Scenario {
  name: 'ideal' | 'lab'
  /** Circuit parameters except `line`. */
  params: Omit<CircuitInputs, 'line'>
  /** Reading time after releasing the key (s); Infinity = equilibrium. */
  wait_s: number
}

export const IDEAL: Scenario = {
  name: 'ideal',
  params: { stray_fraction: 0, R_cell_Ohm: 1e21, R_input_Ohm: 1e21, I_ref_A: 1e-9 }, // bright source (~4x the lab one): settles in ~1 min; T = 0, no anode current
  wait_s: Infinity,
}

export const LAB: Scenario = {
  name: 'lab',
  // Real-bench effects only here: stray light, leakage, anode (reverse) photocurrent, thermal cutoff tail at room
  // temperature, dielectric absorption of the capacitor. The IDEAL scenario has none of them (T = 0, no reverse current).
  params: {
    stray_fraction: 0.00047, R_cell_Ohm: 3.55e12, anode_fraction: ANODE_ILLUM_FRACTION, T_K: T_ROOM_K,
    C_da_F: C_DA_F, R_da_Ohm: R_DA_Ohm,
  },
  wait_s: 60,
}

export const SCENARIOS = { ideal: IDEAL, lab: LAB } as const

/** Expected (noise-free) meter reading for a line in a scenario, after the scenario's wait. */
export function expectedReading_V(s: Scenario, line: HgLineId): number {
  const inp: CircuitInputs = { ...s.params, line }
  if (!Number.isFinite(s.wait_s)) return steadyState_V(inp)
  const c = chargeCurve(inp, s.wait_s, 60)
  return c.U_V[c.U_V.length - 1]!
}

/** U0 vs nu data set for the four visible lines (nu_Hz, U_V). */
export function measureVisible(s: Scenario): { nu_Hz: number[]; U_V: number[] } {
  const ids: HgLineId[] = ['yellow', 'green', 'blue', 'violet']
  return {
    nu_Hz: ids.map((id) => nuFromLambda(getLine(id).lambda_nm)),
    U_V: ids.map((id) => expectedReading_V(s, id)),
  }
}

export { HG_LINES }
