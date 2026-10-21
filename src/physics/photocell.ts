import { C_ms, CATHODES, E_C, H_Js, HG_LINES, W_A_eV as W_A_DEFAULT_eV, getLine, linePower } from './constants.ts'
import type { CathodeId, HgLineId, OpticsId } from './constants.ts'

/** Saturation photocurrent of a unit-power, full-QE line (A). Empirical (FITTED), see PARAMETERS.md. */
export const I_REF_A = 2.56e-10
/**
 * Energy scale x0 (eV) of the Fowler-type quantum yield Y(x) = 1 - exp(-(x/x0)^2), x = h*nu - W_C: quadratic just above
 * threshold, saturating smoothly to 1. ASSUMED, see qeFactor and PARAMETERS.md.
 */
export const QE_RAMP_eV = 1.0
/** Boltzmann constant in eV/K (CODATA 2018: k_B = 1.380649e-23 J/K, e = 1.602176634e-19 C). */
export const K_B_eV_perK = 8.617333262e-5
/** Room temperature used by the Lab scenario (K): kT = 0.0257 eV. */
export const T_ROOM_K = 298
/** The thermal tail of the cutoff extends this many kT beyond the T = 0 limit voltage U0 (relative size e^-12 = 6e-6). */
export const THERMAL_MARGIN_kT = 12
/**
 * Fraction of each line's light that reaches the K-contaminated ring anode (scattered by the cathode and the lens
 * diaphragm). ASSUMED, Lab and the Explore "anode emission" toggle only. PARAMETERS.md.
 */
export const ANODE_ILLUM_FRACTION = 0.005

export interface PhotoOptions {
  cathode?: CathodeId // default 'photocell'
  W_A_eV?: number // effective anode work function
  /** 0..1 neutral-density filter in the beam on the cathode (1 = none). Explore-only in the app; the real bench has none. */
  beamIntensity?: number
  stray_fraction?: number // 0 = clean optics
  I_ref_A?: number
  /** Optional override of per-line relative power (id -> factor); defaults to lamp power x optics transmission. */
  relPower?: Partial<Record<HgLineId, number>>
  /** Optics train: glass lenses + flint prism (default) or fused quartz (UV passes). */
  optics?: OpticsId
  /** Fraction of each line's power reaching the anode (reverse photocurrent); 0 or undefined = no anode emission. */
  anode_fraction?: number
  /** Temperature (K) of the electron gas for the Fermi-Dirac tail of the cutoff; 0 or undefined = sharp T = 0 cutoff. */
  T_K?: number
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
 * Quantum-yield factor 0..1 of a surface with work function W_eV: zero at or below threshold, then
 *   Y(x) = 1 - exp(-(x / QE_RAMP_eV)^2),  x = h*nu - W_eV.
 * Fowler's theory of photoemission near threshold gives a yield proportional to (h*nu - W)^2 (leaving the
 * Fermi-edge electrons only just above threshold); Y follows that quadratic law for x << QE_RAMP_eV (Y ~ (x/x0)^2)
 * and saturates smoothly to 1 for x >> x0 (no kink, unlike the old linear ramp). The saturation form and the
 * scale x0 are ASSUMED (a real K layer peaks near 400 nm and then falls again); PARAMETERS.md. Used for the cathode
 * (W_C) and for the anode (W_A, reverse current).
 *
 * T = 0 threshold. The yield uses the sharp T = 0 threshold (x = h*nu - W) even in the 298 K Lab, where the retarding
 * shape F(U) carries the thermal smearing. Harmless: the smearing is ~kT = 0.026 eV, and even the weakest visible line
 * (yellow, h*nu - W_C = 0.245 eV) lies ~10 kT above W_C, where the thermal correction (pi kT)^2 / (3 x^2) is ~4 % at most.
 */
export function qeFactor(nu_Hz: number, W_eV: number): number {
  const x = photonEnergy_eV(nu_Hz) - W_eV
  if (x <= 0) return 0
  return 1 - Math.exp(-((x / QE_RAMP_eV) ** 2))
}

// ---- Fowler function and thermal smearing -----------------------------------------------------------------------------

/**
 * Fowler's function f(t) = -Li2(-e^t) = integral of ln(1 + e^s) ds from -inf to t (Fowler 1931; the photoemission
 * yield of a metal at temperature T is proportional to (kT)^2 f((h*nu - W)/kT)). Limits: f -> e^t for t -> -inf and
 * f -> t^2/2 + pi^2/6 for t -> +inf. Evaluated by a Taylor series for |t| <= 1, the alternating series
 * sum (-1)^(n+1) e^(nt)/n^2 for t < -1 and the reflection f(t) = pi^2/6 + t^2/2 - f(-t) for t > 1.
 */
export function fowlerF(t: number): number {
  if (t > 1) return Math.PI ** 2 / 6 + (t * t) / 2 - fowlerF(-t)
  if (t >= -1) {
    // integral of the Taylor series ln(1+e^s) = ln2 + s/2 + s^2/8 - s^4/192 + s^6/2880 - 17 s^8/645120 + 31 s^10/14515200 - ...
    const t2 = t * t
    return Math.PI ** 2 / 12 + Math.LN2 * t + t2 / 4 + (t2 * t) / 24 - (t2 * t2 * t) / 960 + (t2 * t2 * t2 * t) / 20160 - (17 * t2 * t2 * t2 * t2 * t) / 5806080 + (31 * t2 * t2 * t2 * t2 * t2 * t) / 159667200
  }
  const e = Math.exp(t)
  let sum = 0
  let p = 1
  for (let n = 1; n <= 80; n++) {
    p *= e
    const term = p / (n * n)
    sum += n % 2 === 1 ? term : -term
    if (term < 1e-18) break
  }
  return sum
}

/** ln(1 + e^t) without overflow. */
function softplus(t: number): number {
  return t > 30 ? t : Math.log1p(Math.exp(t))
}

/**
 * Thermally smeared "energy window" yield Phi_T(x) = 2 (kT)^2 f(x/kT) (eV^2) for an electron-energy margin x (eV):
 * the number of electrons that can overcome a barrier lying x below the photon energy, from the Fermi-Dirac
 * distribution of the metal. For T <= 0 it is the sharp parabola max(x, 0)^2; for x >> kT it equals x^2 (plus a
 * constant (pi kT)^2/3); for x < 0 it fades as e^(x/kT), the thermal tail.
 */
export function thermalWindow_eV2(x_eV: number, T_K: number): number {
  if (!(T_K > 0)) return x_eV > 0 ? x_eV * x_eV : 0
  const kT = K_B_eV_perK * T_K
  return 2 * kT * kT * fowlerF(x_eV / kT)
}

/** d(Phi_T)/dx (eV) = 2 kT ln(1 + e^(x/kT)); 2x for x > 0 and 0 otherwise at T = 0. */
export function thermalWindowSlope_eV(x_eV: number, T_K: number): number {
  if (!(T_K > 0)) return x_eV > 0 ? 2 * x_eV : 0
  const kT = K_B_eV_perK * T_K
  return 2 * kT * softplus(x_eV / kT)
}

/**
 * Retarding-field shape F(U) of the collected (cathode -> anode) photocurrent, relative to saturation, 0..1, for
 * photon energy h*nu, cathode work function W_C, anode work function W_A (all energies in eV, U in V so e*U is U
 * numerically in eV) and electron temperature T_K.
 *
 * An electron must reach the anode vacuum level, so it needs a total energy above the Fermi level of
 * max(W_C, W_A + e*U) (W_C to leave the cathode; W_A + e*U to climb onto the anode barrier, leaflet eq. VII).
 * With the margin x = h*nu - barrier, F = Phi_T(x) / Phi_T(h*nu - max(W_C, W_A)), clamped to [0, 1], where Phi_T is the
 * Fowler-type window yield (thermalWindow_eV2). At T = 0 this is the parabola
 *   F(U) = ((h*nu - max(W_C, W_A + e*U)) / (h*nu - max(W_C, W_A)))^2,
 * saturated (F = 1) up to U = (W_C - W_A)/e for the model's K-contaminated ring (W_A < W_C), then falling over the real
 * spread h*nu - W_C and exactly 0 at U0 = (h*nu - W_A)/e. For T > 0 the Fermi-Dirac edge smears the cutoff: F no longer
 * stops at U0 but fades as e^(-(U - U0)/kT) beyond it (a few kT), and is slightly rounded below it.
 *
 * Approximation: the criterion uses the electron energy along the NORMAL (planar Fowler-DuBridge picture). The LD cell
 * has a spherical cathode and a ring anode, so the real trajectories and the retarding field are not planar; the
 * planar form is a simplification, not a model of that geometry.
 */
export function retardingShape(U_V: number, nu_Hz: number, W_C_eV: number, W_A_eV: number, T_K = 0): number {
  const E = photonEnergy_eV(nu_Hz)
  const win = E - Math.max(W_C_eV, W_A_eV + U_V)
  const spread = E - Math.max(W_C_eV, W_A_eV)
  if (!(T_K > 0)) {
    if (win <= 0) return 0
    if (spread <= 0) return 1 // only reachable for U < 0 with W_A >= E: field is accelerating, unity
    return Math.min(1, (win / spread) ** 2)
  }
  const den = thermalWindow_eV2(spread, T_K)
  if (!(den > 0)) return 0
  return Math.min(1, thermalWindow_eV2(win, T_K) / den)
}

/** dF/dU (1/V) of retardingShape; 0 where F is clamped (saturated) or (T = 0) cut off. Always <= 0. */
export function retardingShapeSlope_perV(U_V: number, nu_Hz: number, W_C_eV: number, W_A_eV: number, T_K = 0): number {
  const E = photonEnergy_eV(nu_Hz)
  const win = E - Math.max(W_C_eV, W_A_eV + U_V)
  const spread = E - Math.max(W_C_eV, W_A_eV)
  if (W_A_eV + U_V <= W_C_eV) return 0
  if (!(T_K > 0)) {
    if (win <= 0 || spread <= 0 || win >= spread) return 0
    return (-2 * win) / (spread * spread)
  }
  const den = thermalWindow_eV2(spread, T_K)
  if (!(den > 0) || win >= spread) return 0
  return -thermalWindowSlope_eV(win, T_K) / den
}

/**
 * Shape R(U) of the REVERSE (anode -> cathode) photocurrent, relative to its saturation value, 0..1.
 *
 * Sign and field. The capacitor charges the anode NEGATIVE relative to the cathode by U (it collects the photoelectrons).
 * For electrons leaving the anode that is an ACCELERATING field: the anode pushes them towards the cathode, so the
 * field never retards them (the reverse current is the mirror of the forward one, with the field sign flipped). The only
 * barriers for an anode electron of energy epsilon above the anode Fermi level are the anode work function W_A
 * (to leave) and the cathode vacuum level, which lies W_C - e*U above (the contact potential W_C - W_A is partly
 * cancelled by the charged capacitor): epsilon >= max(W_A, W_C - e*U). With W_A < W_C the reverse current is therefore
 * partly retarded by the contact field at U = 0 and becomes exactly saturated for U >= (W_C - W_A)/e (= 0.373 V),
 * i.e. for all voltages of interest. It does NOT vanish at U0 (that is why it lowers the plateau). R = Phi_T(h*nu -
 * max(W_A, W_C - e*U)) / Phi_T(h*nu - W_A), clamped to [0, 1]. Increasing in U.
 */
export function reverseShape(U_V: number, nu_Hz: number, W_C_eV: number, W_A_eV: number, T_K = 0): number {
  const E = photonEnergy_eV(nu_Hz)
  const x = E - Math.max(W_A_eV, W_C_eV - U_V)
  const sat = E - W_A_eV
  if (sat <= 0 && !(T_K > 0)) return 0
  const den = thermalWindow_eV2(sat, T_K)
  if (!(den > 0)) return 0
  return Math.min(1, thermalWindow_eV2(x, T_K) / den)
}

/** dR/dU (1/V) of reverseShape; 0 where saturated. Always >= 0. */
export function reverseShapeSlope_perV(U_V: number, nu_Hz: number, W_C_eV: number, W_A_eV: number, T_K = 0): number {
  if (W_C_eV - U_V <= W_A_eV) return 0
  const E = photonEnergy_eV(nu_Hz)
  const x = E - (W_C_eV - U_V)
  const sat = E - W_A_eV
  if (sat <= 0 && !(T_K > 0)) return 0
  const den = thermalWindow_eV2(sat, T_K)
  if (!(den > 0) || x >= sat) return 0
  return thermalWindowSlope_eV(x, T_K) / den
}

interface Contribution {
  /** Saturated forward (cathode -> anode) current of this line (A). */
  I_sat_A: number
  /** Saturated reverse (anode -> cathode) current of this line (A); 0 without anode illumination. */
  I_rev_A: number
  nu_Hz: number
  W_C_eV: number
  W_A_eV: number
  U0_V: number
  T_K: number
}

function contributions(line: HgLineId, o: PhotoOptions): Contribution[] {
  const W_C = CATHODES[o.cathode ?? 'photocell'].W_C_eV
  const W_A = o.W_A_eV ?? W_A_DEFAULT_eV
  const beam = Math.min(1, Math.max(0, o.beamIntensity ?? 1))
  const stray = Math.max(0, o.stray_fraction ?? 0)
  const anode = Math.max(0, o.anode_fraction ?? 0)
  const T = Math.max(0, o.T_K ?? 0)
  const Iref = o.I_ref_A ?? I_REF_A
  const optics = o.optics ?? 'glass'
  const out: Contribution[] = []
  for (const l of HG_LINES) {
    const own = l.id === line
    const weight = own ? 1 : stray
    if (weight === 0) continue
    const nu = nuFromLambda(l.lambda_nm)
    const P = o.relPower?.[l.id] ?? linePower(l.id, optics)
    const I_sat_A = Iref * P * beam * qeFactor(nu, W_C) * weight
    const I_rev_A = anode > 0 ? Iref * P * beam * qeFactor(nu, W_A) * anode * weight : 0
    if (I_sat_A > 0 || I_rev_A > 0) out.push({ I_sat_A, I_rev_A, nu_Hz: nu, W_C_eV: W_C, W_A_eV: W_A, U0_V: I_sat_A > 0 ? limitVoltage_V(nu, W_A) : 0, T_K: T })
  }
  return out
}

/** Forward (cathode -> anode, charging) photocurrent (A) at anode-cathode voltage U_V, summed over the selected and stray lines. */
export function forwardCurrent_A(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  getLine(line)
  let I = 0
  for (const c of contributions(line, opts)) if (c.I_sat_A > 0) I += c.I_sat_A * retardingShape(U_V, c.nu_Hz, c.W_C_eV, c.W_A_eV, c.T_K)
  return I
}

/** Reverse (anode -> cathode, discharging) photocurrent (A), a positive number; 0 unless opts.anode_fraction > 0. */
export function reverseCurrent_A(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  getLine(line)
  let I = 0
  for (const c of contributions(line, opts)) if (c.I_rev_A > 0) I += c.I_rev_A * reverseShape(U_V, c.nu_Hz, c.W_C_eV, c.W_A_eV, c.T_K)
  return I
}

/**
 * Net photocurrent (A) charging the capacitor at anode-cathode voltage U_V: forward minus reverse current. Forward: sum
 * over the selected and stray-light lines of I_sat * F(U), each with its own U0 (retardingShape: Fowler-type parabola,
 * thermally smeared when T_K > 0). Reverse: the same light hitting the K-contaminated anode (reverseShape). Without
 * anode_fraction this is the forward current alone, zero at and above U0 for T = 0.
 */
export function photocurrent_A(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  return forwardCurrent_A(U_V, line, opts) - reverseCurrent_A(U_V, line, opts)
}

/** dI/dU (A/V) of photocurrent_A; used by the integrator for step control. Always <= 0. */
export function photocurrentSlope_AperV(U_V: number, line: HgLineId, opts: PhotoOptions = {}): number {
  let s = 0
  for (const c of contributions(line, opts)) {
    if (c.I_sat_A > 0) s += c.I_sat_A * retardingShapeSlope_perV(U_V, c.nu_Hz, c.W_C_eV, c.W_A_eV, c.T_K)
    if (c.I_rev_A > 0) s -= c.I_rev_A * reverseShapeSlope_perV(U_V, c.nu_Hz, c.W_C_eV, c.W_A_eV, c.T_K)
  }
  return s
}

/**
 * Upper bound (V) for the capacitor voltage: the largest U0 among the contributions that actually emit (0 if none),
 * plus THERMAL_MARGIN_kT x kT when the thermal tail is on (the forward current has faded to ~6e-6 of saturation there).
 */
export function maxContributingU0_V(line: HgLineId, opts: PhotoOptions = {}): number {
  const cs = contributions(line, opts).filter((c) => c.I_sat_A > 0)
  const m = cs.reduce((acc, c) => Math.max(acc, c.U0_V), 0)
  if (m <= 0) return 0
  const T = Math.max(0, opts.T_K ?? 0)
  return m + THERMAL_MARGIN_kT * K_B_eV_perK * T
}
