/** CODATA 2018 constants (exact SI definitions of h, e, c). */
export const H_Js = 6.62607015e-34 // Planck constant, J s
export const E_C = 1.602176634e-19 // elementary charge, C (also J per eV)
export const C_ms = 299792458 // speed of light, m/s

export type HgLineId = 'yellow' | 'green' | 'blue' | 'violet' | 'uv'

/** Optics between lamp and cell: ordinary glass (lenses + direct-vision flint prism) or UV-transmitting fused quartz. */
export type OpticsId = 'glass' | 'quartz'

/**
 * Relative power of each Hg line in the arc itself (dimensionless, 546 nm = 1.0). ASSUMED typical shape of a
 * high-pressure Hg arc spectrum from lamp-maker spectra (546 strongest of the visible lines, the 577/579 doublet and
 * 436 slightly weaker, 405 about half, the 365/366 triplet comparable to 436). No source was available to verify the
 * numbers, so they are labelled ASSUMED in PARAMETERS.md.
 */
export const HG_LAMP_POWER: Readonly<Record<HgLineId, number>> = {
  yellow: 0.8,
  green: 1.0,
  blue: 0.75,
  violet: 0.4,
  uv: 0.9,
}

/**
 * Optical transmission (0..1) of the whole train per line. Glass: lenses plus a direct-vision (flint) prism, which
 * absorbs more and more towards the violet and almost completely at 365 nm. Quartz: fused silica optics, near-flat
 * and UV-transparent. ASSUMED typical values (PARAMETERS.md), not measured on the LD optics.
 */
export const OPTICS_TRANSMISSION: Readonly<Record<OpticsId, Readonly<Record<HgLineId, number>>>> = {
  glass: { yellow: 0.9, green: 0.9, blue: 0.85, violet: 0.78, uv: 0.01 },
  quartz: { yellow: 0.92, green: 0.92, blue: 0.92, violet: 0.92, uv: 0.9 },
}

/** Relative line power on the cathode with the given optics: lamp power x transmission. */
export function linePower(id: HgLineId, optics: OpticsId = 'glass'): number {
  return HG_LAMP_POWER[id] * OPTICS_TRANSMISSION[optics][id]
}

export interface HgLine {
  id: HgLineId
  /** Vacuum-ish wavelength of the line in nm (yellow is the 577/579 doublet mean). */
  lambda_nm: number
  /**
   * Relative power on the cathode through glass optics (= lamp power x glass transmission, see HG_LAMP_POWER and
   * OPTICS_TRANSMISSION). Documented in PARAMETERS.md.
   */
  relPower: number
}

const line = (id: HgLineId, lambda_nm: number): HgLine => ({ id, lambda_nm, relPower: linePower(id, 'glass') })

export const HG_LINES: readonly HgLine[] = [
  line('yellow', 578.0),
  line('green', 546.1),
  line('blue', 435.8),
  line('violet', 404.7),
  line('uv', 365.0),
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
export const W_A_eV = 1.527

/** Look up a line by id (throws for unknown ids). */
export function getLine(id: HgLineId): HgLine {
  const l = HG_LINES.find((x) => x.id === id)
  if (!l) throw new Error(`unknown Hg line ${id}`)
  return l
}
