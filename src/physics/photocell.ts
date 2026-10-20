import { C_ms, CATHODES, E_C, H_Js, HG_LINES, W_A_eV as W_A_DEFAULT_eV, getLine } from './constants.ts'
import type { CathodeId, HgLineId } from './constants.ts'

/** Saturation photocurrent of a unit-power, full-QE line (A). Empirical, see PARAMETERS.md. */
export const I_REF_A = 6.5e-11
/** Photon energy above threshold over which the quantum-yield factor ramps from 0 to 1 (eV). Empirical. */
export const QE_RAMP_eV = 1.0

export interface PhotoOptions {
  cathode?: CathodeId // default 'photocell'
  W_A_eV?: number // effective anode work function
  /** 0..1 neutral-density filter in the beam on the cathode (1 = none). Explore-only in the app; the real bench has none. */
  beamIntensity?: number
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

/**
 * Quantum-yield factor 0..1: zero below threshold, linear ramp over QE_RAMP_eV above it. The linear ramp is an
 * assumption; Fowler theory gives a quadratic yield near threshold.
 */
export function qeFactor(nu_Hz: number, W_C_eV: number): number {
  if (!emits(nu_Hz, W_C_eV)) return 0
  return Math.min(1, (photonEnergy_eV(nu_Hz) - W_C_eV) / QE_RAMP_eV)
}

/**
 * Retarding-field shape F(U) of the collected photocurrent (relative to saturation, 0..1) for photon energy h*nu,
 * cathode work function W_C and anode work function W_A (all energies in eV, U in V so e*U is U numerically in eV).
 *
 * An electron must reach the anode vacuum level, so it needs a total energy above the Fermi level of
 * max(W_C, W_A + e*U) (W_C to leave the cathode; W_A + e*U to climb onto the anode barrier, leaflet eq. VII).
 * With the emitted-energy spread s = h*nu - max(W_C, W_A):
 *   F(U) = ((h*nu - max(W_C, W_A + e*U)) / s)^2, clamped to [0, 1].
 * For W_A < W_C (the model's K-contaminated ring) F = 1 up to U = (W_C - W_A)/e (accelerating contact field),
 * then falls over the real spread h*nu - W_C and is 0 at U0 = (h*nu - W_A)/e. For W_A >= W_C it reduces to
 * (1 - U/U0)^2. The parabolic law is an ASSUMED DuBridge-like shape near cutoff (not a derived Fowler result);
 * see PARAMETERS.md.
 */
export function retardingShape(U_V: number, nu_Hz: number, W_C_eV: number, W_A_eV: number): number {
  const E = photonEnergy_eV(nu_Hz)
  const win = E - Math.max(W_C_eV, W_A_eV + U_V)
  if (win <= 0) return 0
  const spread = E - Math.max(W_C_eV, W_A_eV)
  if (spread <= 0) return 1 // only reachable for U < 0 with W_A >= E: field is accelerating, unity
  return Math.min(1, (win / spread) ** 2)
}

/** dF/dU (1/V) of retardingShape; 0 where F is clamped (saturated or cut off). */
export function retardingShapeSlope_perV(U_V: number, nu_Hz: number, W_C_eV: number, W_A_eV: number): number {
  const E = photonEnergy_eV(nu_Hz)
  const win = E - Math.max(W_C_eV, W_A_eV + U_V)
  const spread = E - Math.max(W_C_eV, W_A_eV)
  if (win <= 0 || spread <= 0 || W_A_eV + U_V <= W_C_eV || win >= spread) return 0
  return (-2 * win) / (spread * spread)
}

interface Contribution {
  I_sat_A: number
  nu_Hz: number
  W_C_eV: number
  W_A_eV: number
  U0_V: number
}

function contributions(line: HgLineId, o: PhotoOptions): Contribution[] {
  const W_C = CATHODES[o.cathode ?? 'photocell'].W_C_eV
  const W_A = o.W_A_eV ?? W_A_DEFAULT_eV
  const beam = Math.min(1, Math.max(0, o.beamIntensity ?? 1))
  const stray = Math.max(0, o.stray_fraction ?? 0)
  const Iref = o.I_ref_A ?? I_REF_A
  const out: Contribution[] = []
  for (const l of HG_LINES) {
    const own = l.id === line
    const weight = own ? 1 : stray
    if (weight === 0) continue
    const nu = nuFromLambda(l.lambda_nm)
    const P = o.relPower?.[l.id] ?? l.relPower
    const I_sat_A = Iref * P * beam * qeFactor(nu, W_C) * weight
    if (I_sat_A > 0) out.push({ I_sat_A, nu_Hz: nu, W_C_eV: W_C, W_A_eV: W_A, U0_V: limitVoltage_V(nu, W_A) })
  }
  return out
}

/**
 * Net photocurrent (A) into the capacitor at anode-cathode voltage U_V: sum over the selected line and the
 * stray-light lines of I_sat * F(U), each with its own U0. F is an assumed parabolic (DuBridge-like) shape near
 * cutoff, see retardingShape.
 */
export function photocurrent_A(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  getLine(line)
  let I = 0
  for (const c of contributions(line, opts)) I += c.I_sat_A * retardingShape(U_V, c.nu_Hz, c.W_C_eV, c.W_A_eV)
  return I
}

/** dI/dU (A/V) of photocurrent_A; used by the integrator for step control. Always <= 0. */
export function photocurrentSlope_AperV(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  let s = 0
  for (const c of contributions(line, opts)) s += c.I_sat_A * retardingShapeSlope_perV(U_V, c.nu_Hz, c.W_C_eV, c.W_A_eV)
  return s
}

/** Largest U0 among the contributions that actually emit (0 if none): upper bound for the capacitor voltage. */
export function maxContributingU0_V(line: HgLineId, opts: PhotoOptions = {}): number {
  return contributions(line, opts).reduce((m, c) => Math.max(m, c.U0_V), 0)
}
