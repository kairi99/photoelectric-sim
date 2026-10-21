// Measurement uncertainty, repeated readings and the weighted U0-vs-nu fit. Pure, DOM-free, no randomness.
// Unit in the name: U_V, nu_Hz, sigma_V. Standard references: Taylor, "An Introduction to Error Analysis"
// (weighted least squares, ch. 8; comparison of a result with an accepted value, ch. 5) and the GUM (JCGM 100).
import { E_C, H_Js } from './constants.ts'

// ---- instrument uncertainty ----------------------------------------------------------------------------------

/**
 * ASSUMED. Class of the analog multimeter, % of full scale (the usual way an analog instrument is specified).
 * The limit of error is treated conservatively as a standard uncertainty. PARAMETERS.md.
 */
export const METER_CLASS_PCT = 2.5
/** ASSUMED. A student reads the needle to about this fraction of the smallest scale division (a fifth). */
export const NEEDLE_READABILITY_FRACTION = 0.2
/** Fine ticks per labelled division on the analog scale (src/views/benchkit.ts scaleTicks draws 5). */
export const NEEDLE_FINE_TICKS_PER_DIV = 5
/** ASSUMED. Explore digital readout: resolution and jitter, 1 mV (the explore reading noise is 0.5 mV). */
export const DIGITAL_SIGMA_V = 0.001

/** Divisions on a range's scale: 3-type ranges (0.3, 3, 30 V) have 6, 1-type ranges (0.1, 1, 10 V) have 10. */
function scaleDivisions(range_V: number): number {
  return [0.3, 3, 30].includes(range_V) ? 6 : 10
}

/**
 * Smallest scale division (the fine tick) of a range, V: 0.1 V on the 3 V range, 0.02 V on the 1 V range.
 */
export function smallestDivision_V(range_V: number): number {
  return range_V / (scaleDivisions(range_V) * NEEDLE_FINE_TICKS_PER_DIV)
}

/**
 * Reading uncertainty of the analog needle, V: NEEDLE_READABILITY_FRACTION of the smallest division.
 * 3 V range: 0.02 V (the "honest needle reading" of the guided tasks); 1 V range: 0.004 V.
 */
export function needleSigma_V(range_V: number): number {
  return NEEDLE_READABILITY_FRACTION * smallestDivision_V(range_V)
}

/** Class error of the meter on a range, V (absolute, as specified: a percentage of full scale). 3 V range: 0.075 V. */
export function meterClassError_V(range_V: number): number {
  return (METER_CLASS_PCT / 100) * range_V
}

// ---- repeated readings ---------------------------------------------------------------------------------------

export interface GroupStats {
  n: number
  mean_V: number
  /** Sample standard deviation s (n-1 dof); 0 for n = 1. */
  sd_V: number
  /** Standard error of the mean s / sqrt(n); 0 for n = 1 (one reading says nothing about the spread). */
  sem_V: number
  /** Instrument uncertainty of one reading of this group (rms of the individual sigmas). */
  sigmaInstr_V: number
  /** Uncertainty of the mean used as the error bar and in the fit weights, see lineSigma_V. */
  sigmaLine_V: number
}

/**
 * Uncertainty of the mean of n readings of the same line:
 *
 *     sigma_line = max(s, sigma_instr) / sqrt(n)
 *
 * Reasoning. Each reading carries the instrument's reading error sigma_instr (needle readability), which is random
 * from one reading to the next, so averaging n readings cuts it to sigma_instr/sqrt(n). The scatter s of the readings
 * is an empirical estimate of the total random error of one reading (readability plus noise plus small drifts), so
 * s/sqrt(n) is the standard error of the mean. For small n, s is itself very uncertain (n = 2 can give s near 0 by
 * luck), so s must not be allowed to shrink the error bar below what the instrument can resolve: taking the larger
 * of the two avoids that and is continuous in n (n = 1 gives sigma_instr, as it should, with s = 0).
 * Averaging never reduces the systematic (gain) error of the meter, see systematicH_Js.
 */
export function lineSigma_V(sd_V: number, sigmaInstr_V: number, n: number): number {
  return Math.max(sd_V, sigmaInstr_V) / Math.sqrt(n)
}

/** Mean, spread, standard error and fit uncertainty of repeated readings; sigmas holds each reading's instrument sigma. */
export function groupStats(values_V: readonly number[], sigmas_V: readonly number[]): GroupStats {
  const n = values_V.length
  if (n < 1 || sigmas_V.length !== n) throw new Error('groupStats needs >=1 reading and one sigma per reading')
  const mean = values_V.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(values_V.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  const sigmaInstr = Math.sqrt(sigmas_V.reduce((a, b) => a + b * b, 0) / n)
  return {
    n,
    mean_V: mean,
    sd_V: sd,
    sem_V: sd / Math.sqrt(n),
    sigmaInstr_V: sigmaInstr,
    sigmaLine_V: lineSigma_V(sd, sigmaInstr, n),
  }
}

// ---- weighted fit --------------------------------------------------------------------------------------------

export interface WeightedFit {
  slope: number
  intercept: number
  /** Statistical 1-sigma of the slope / intercept from the given point uncertainties (not rescaled by chi2). */
  sigma_slope: number
  sigma_intercept: number
  chi2: number
  /** Degrees of freedom n - 2. */
  dof: number
  /** chi2 / dof; null when dof < 1 (two points always fit exactly). ~1 means error bars match the scatter. */
  chi2_red: number | null
  /** Weighted coefficient of determination. */
  r2: number
}

/**
 * Weighted least squares y = slope*x + intercept with weights w = 1/sigma^2 (Taylor ch. 8):
 * slope = (S Sxy - Sx Sy) / D, intercept = (Sxx Sy - Sx Sxy) / D, D = S Sxx - Sx^2,
 * sigma_slope^2 = S / D, sigma_intercept^2 = Sxx / D. With equal sigmas the slope and intercept equal linearFit's.
 * chi2_red well below 1 means the error bars are larger than the scatter (conservative readability); well above 1
 * means they are too small or the points are not on a line (a systematic effect, e.g. leakage).
 */
export function weightedLinearFit(xs: readonly number[], ys: readonly number[], sigmas: readonly number[]): WeightedFit {
  const n = xs.length
  if (n < 2 || ys.length !== n || sigmas.length !== n) throw new Error('weightedLinearFit needs >=2 matching points')
  if (sigmas.some((s) => !(s > 0) || !Number.isFinite(s))) throw new Error('weightedLinearFit needs sigma > 0')
  let S = 0, Sx = 0, Sy = 0, Sxx = 0, Sxy = 0
  for (let k = 0; k < n; k++) {
    const w = 1 / sigmas[k]! ** 2
    S += w
    Sx += w * xs[k]!
    Sy += w * ys[k]!
    Sxx += w * xs[k]! ** 2
    Sxy += w * xs[k]! * ys[k]!
  }
  const D = S * Sxx - Sx * Sx
  const slope = (S * Sxy - Sx * Sy) / D
  const intercept = (Sxx * Sy - Sx * Sxy) / D
  const ybar = Sy / S
  let chi2 = 0
  let tot = 0
  for (let k = 0; k < n; k++) {
    const w = 1 / sigmas[k]! ** 2
    chi2 += w * (ys[k]! - (slope * xs[k]! + intercept)) ** 2
    tot += w * (ys[k]! - ybar) ** 2
  }
  const dof = n - 2
  return {
    slope,
    intercept,
    sigma_slope: Math.sqrt(S / D),
    sigma_intercept: Math.sqrt(Sxx / D),
    chi2,
    dof,
    chi2_red: dof >= 1 ? chi2 / dof : null,
    r2: tot === 0 ? 1 : Math.max(0, 1 - chi2 / tot),
  }
}

// ---- systematic uncertainty ----------------------------------------------------------------------------------

/**
 * Systematic uncertainty of h from the meter's accuracy class, J s.
 *
 * Why it is NOT added to the per-point error bars: a calibration (gain) error of the multimeter acts on every
 * reading in the same direction and by the same fraction, so the errors of different points are fully correlated.
 * Error bars (and the 1/sigma^2 weights) assume independent errors; a common factor cannot make the points scatter
 * away from the line, it can only tilt the whole line. Adding it to every bar would also change the weights and
 * the chi2 for no reason.
 *
 * Rule. The class limit is an absolute error of METER_CLASS_PCT % of full scale. Split it into the two ways a meter
 * can be off:
 *  - gain error (U_read = (1 + g) U): scales the slope by (1 + g), so sigma_h/h = |g|. The class guarantee
 *    |g U| <= class * FS for every U up to FS means |g| <= METER_CLASS_PCT %, whatever the range. This is the bound
 *    returned here: sigma_h,sys = h * METER_CLASS_PCT / 100.
 *  - offset error (U_read = U + d): shifts all points equally, so the intercept moves by d (up to 0.075 V on the
 *    3 V range) but the slope, and h, do not change. It therefore does not contribute to h (see meterClassError_V
 *    for the intercept).
 * Since the unknown real error is a mix of both, the gain bound is the conservative value for h.
 */
export function systematicH_Js(h_Js: number): number {
  return (Math.abs(h_Js) * METER_CLASS_PCT) / 100
}

// ---- comparison with the accepted value ----------------------------------------------------------------------

export type Agreement = 'within1' | 'within2' | 'beyond2'
export interface Comparison {
  /** (h - accepted) / accepted, percent. */
  deviation_pct: number
  /** (h - accepted) / sigma, signed; Infinity if sigma is 0 and the values differ. */
  deviation_sigma: number
  verdict: Agreement
}

/** Compare a result with the accepted value in units of its (statistical) standard uncertainty. */
export function compareToAccepted(h_Js: number, sigma_Js: number, accepted_Js: number = H_Js): Comparison {
  const diff = h_Js - accepted_Js
  const nSigma = sigma_Js > 0 ? diff / sigma_Js : diff === 0 ? 0 : Math.sign(diff) * Infinity
  const a = Math.abs(nSigma)
  return {
    deviation_pct: (diff / accepted_Js) * 100,
    deviation_sigma: nSigma,
    verdict: a <= 1 ? 'within1' : a <= 2 ? 'within2' : 'beyond2',
  }
}

/** h = e * slope, with the slope's uncertainty carried over (eq. V). */
export function hFromSlope(slope_VperHz: number, sigmaSlope_VperHz: number): { h_Js: number; sigma_h_Js: number } {
  return { h_Js: E_C * slope_VperHz, sigma_h_Js: E_C * sigmaSlope_VperHz }
}

// ---- presentation of "value +- sigma" ------------------------------------------------------------------------

export interface Rounded {
  value: number
  sigma: number
  /** Decimal places of both (negative: rounded to tens, hundreds ...). */
  decimals: number
}

/**
 * Round sigma to 1 or 2 significant digits (2 when its leading digit is 1 or 2, where one digit would lose too
 * much: 0.14 -> 0.14, 0.36 -> 0.4) and the value to the same decimal place.
 */
export function roundWithUncertainty(value: number, sigma: number): Rounded {
  if (!(sigma > 0) || !Number.isFinite(sigma)) return { value, sigma: 0, decimals: 3 }
  const exp = Math.floor(Math.log10(sigma))
  const lead = Math.floor(sigma / 10 ** exp)
  let sig = lead <= 2 ? 2 : 1
  let decimals = sig - 1 - exp
  let s = Math.round(sigma * 10 ** decimals) / 10 ** decimals
  // two digits that end in 0 (0.020) are really one significant digit (0.02)
  if (sig === 2 && Math.round(s * 10 ** decimals) % 10 === 0) {
    sig = 1
    decimals -= 1
    s = Math.round(sigma * 10 ** decimals) / 10 ** decimals
  }
  // rounding up can add a digit (0.96 -> 1.0): re-evaluate once
  if (Math.floor(Math.log10(s)) > exp) {
    sig = 1
    decimals = -Math.floor(Math.log10(s)) + sig - 1
    s = Math.round(sigma * 10 ** decimals) / 10 ** decimals
  }
  return { value: Math.round(value * 10 ** decimals) / 10 ** decimals, sigma: s, decimals }
}
