import { C_ms, CATHODES, E_C, H_Js, HG_LINES, W_A_eV as W_A_DEFAULT_eV, getLine } from './constants.ts'
import type { CathodeId, HgLineId } from './constants.ts'

/** Saturation photocurrent of a unit-power, full-QE line (A). Empirical, see PARAMETERS.md. */
export const I_REF_A = 8e-11
/** Photon energy above threshold over which the quantum-yield factor ramps from 0 to 1 (eV). Empirical. */
export const QE_RAMP_eV = 1.0

export interface PhotoOptions {
  cathode?: CathodeId // default 'photocell'
  W_A_eV?: number // effective anode work function
  dimming?: number // 0..1 emission-window dimming slider (1 = open)
  stray_fraction?: number // 0 = clean optics
  I_ref_A?: number
  /** Optional override of per-line relative power (id -> factor); defaults to HG_LINES. */
  relPower?: Partial<Record<HgLineId, number>>
}

/** nu = c / lambda (Hz). */
export function nuFromLambda(lambda_nm: number): number {
  return C_ms / (lambda_nm * 1e-9)
}

/** Photon energy h*nu in eV (Einstein relation). */
export function photonEnergy_eV(nu_Hz: number): number {
  return (H_Js * nu_Hz) / E_C
}

/** Ideal limit voltage U0 = max(0, (h nu - W_A)/e) in V (leaflet eq. VII; W_A anode work function). */
export function limitVoltage_V(nu_Hz: number, W_A_eV: number = W_A_DEFAULT_eV): number {
  return Math.max(0, photonEnergy_eV(nu_Hz) - W_A_eV)
}

/** True when h*nu exceeds the cathode threshold work function (Einstein, eq. III). */
export function emits(nu_Hz: number, W_C_eV: number): boolean {
  return photonEnergy_eV(nu_Hz) > W_C_eV
}

/** Quantum-yield factor 0..1: zero below threshold, linear ramp over QE_RAMP_eV above it. */
export function qeFactor(nu_Hz: number, W_C_eV: number): number {
  if (!emits(nu_Hz, W_C_eV)) return 0
  return Math.min(1, (photonEnergy_eV(nu_Hz) - W_C_eV) / QE_RAMP_eV)
}

/** Retarding-field shape F(U): 1 for U<0, (1-U/U0)^2 for 0<=U<U0 (Fowler-like), 0 for U>=U0. */
export function retardingShape(U_V: number, U0_V: number): number {
  if (U_V < 0) return 1
  if (U_V >= U0_V) return 0
  const r = 1 - U_V / U0_V
  return r * r
}

interface Contribution {
  I_sat_A: number
  U0_V: number
}

function contributions(line: HgLineId, o: PhotoOptions): Contribution[] {
  const W_C = CATHODES[o.cathode ?? 'photocell'].W_C_eV
  const W_A = o.W_A_eV ?? W_A_DEFAULT_eV
  const dim = Math.min(1, Math.max(0, o.dimming ?? 1))
  const stray = Math.max(0, o.stray_fraction ?? 0)
  const Iref = o.I_ref_A ?? I_REF_A
  const out: Contribution[] = []
  for (const l of HG_LINES) {
    const own = l.id === line
    const weight = own ? 1 : stray
    if (weight === 0) continue
    const nu = nuFromLambda(l.lambda_nm)
    const P = o.relPower?.[l.id] ?? l.relPower
    const I_sat_A = Iref * P * dim * qeFactor(nu, W_C) * weight
    if (I_sat_A > 0) out.push({ I_sat_A, U0_V: limitVoltage_V(nu, W_A) })
  }
  return out
}

/**
 * Net photocurrent (A) into the capacitor at anode-cathode voltage U_V: sum over the selected line and the
 * stray-light lines of I_sat * F(U), each with its own U0. Retarding-field shape follows Fowler-like emission
 * energy distributions, so the approach to U0 is asymptotic.
 */
export function photocurrent_A(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  getLine(line)
  let I = 0
  for (const c of contributions(line, opts)) I += c.I_sat_A * retardingShape(U_V, c.U0_V)
  return I
}

/** dI/dU (A/V) of photocurrent_A; used by the integrator for step control. Always <= 0. */
export function photocurrentSlope_AperV(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  let s = 0
  for (const c of contributions(line, opts)) {
    if (U_V >= 0 && U_V < c.U0_V && c.U0_V > 0) s += (-2 * c.I_sat_A * (1 - U_V / c.U0_V)) / c.U0_V
  }
  return s
}

/** Largest U0 among the contributions that actually emit (0 if none): upper bound for the capacitor voltage. */
export function maxContributingU0_V(line: HgLineId, opts: PhotoOptions = {}): number {
  return contributions(line, opts).reduce((m, c) => Math.max(m, c.U0_V), 0)
}
