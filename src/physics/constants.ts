/** CODATA 2018 constants (exact SI definitions of h, e, c). */
export const H_Js = 6.62607015e-34 // Planck constant, J s
export const E_C = 1.602176634e-19 // elementary charge, C (also J per eV)
export const C_ms = 299792458 // speed of light, m/s

export type HgLineId = 'yellow' | 'green' | 'blue' | 'violet' | 'uv'

export interface HgLine {
  id: HgLineId
  /** Vacuum-ish wavelength of the line in nm (yellow is the 577/579 doublet mean). */
  lambda_nm: number
  /**
   * Relative line power on the cathode (dimensionless, green = 1). Empirical: lamp output x prism/lens
   * transmission (UV is absorbed by glass optics). Documented in PARAMETERS.md.
   */
  relPower: number
}

export const HG_LINES: readonly HgLine[] = [
  { id: 'yellow', lambda_nm: 578.0, relPower: 1.0 },
  { id: 'green', lambda_nm: 546.1, relPower: 1.0 },
  { id: 'blue', lambda_nm: 435.8, relPower: 1.0 },
  { id: 'violet', lambda_nm: 404.7, relPower: 0.6 },
  { id: 'uv', lambda_nm: 365.0, relPower: 0.05 },
]

export type CathodeId = 'photocell' | 'Cs' | 'Na' | 'K' | 'Zn'

export interface Cathode {
  id: CathodeId
  /** Effective threshold work function in eV: photons need h*nu > W_C_eV to emit. */
  W_C_eV: number
}

export const CATHODES: Readonly<Record<CathodeId, Cathode>> = {
  photocell: { id: 'photocell', W_C_eV: 1.9 }, // effective/as-built LD 558 77 K layer
  Cs: { id: 'Cs', W_C_eV: 2.1 },
  Na: { id: 'Na', W_C_eV: 2.36 },
  K: { id: 'K', W_C_eV: 2.29 },
  Zn: { id: 'Zn', W_C_eV: 4.3 },
}

/**
 * Effective work function of the ring anode in eV. U0 follows the ANODE barrier: current is zero when
 * h*nu = W_A + e*U0 (leaflet eq. VII). The ring is K-contaminated (evaporated cathode material), hence far below Pt.
 */
export const W_A_eV = 1.52

/** Look up a line by id (throws for unknown ids). */
export function getLine(id: HgLineId): HgLine {
  const l = HG_LINES.find((x) => x.id === id)
  if (!l) throw new Error(`unknown Hg line ${id}`)
  return l
}
