import { nuFromLambda } from './photocell.ts'
import { getLine, HG_LINES } from './constants.ts'
import type { HgLineId } from './constants.ts'
import { steadyState_V, chargeCurve } from './circuit.ts'
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
  params: { stray_fraction: 0, R_cell_Ohm: 1e21, R_input_Ohm: 1e21, I_ref_A: 1e-9 }, // bright source: settles in ~1 min
  wait_s: Infinity,
}

export const LAB: Scenario = {
  name: 'lab',
  params: { stray_fraction: 0.002, R_cell_Ohm: 4e12 },
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
