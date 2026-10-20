import { E_C } from './constants.ts'

export interface LinearFit {
  slope: number
  intercept: number
  sigma_slope: number
  sigma_intercept: number
  r2: number
}

/** Ordinary least squares y = slope*x + intercept with standard errors (n-2 dof; sigma 0 for n<=2). */
export function linearFit(xs: readonly number[], ys: readonly number[]): LinearFit {
  const n = xs.length
  if (n < 2 || ys.length !== n) throw new Error('linearFit needs >=2 matching points')
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let k = 0; k < n; k++) {
    sxx += (xs[k]! - mx) ** 2
    sxy += (xs[k]! - mx) * (ys[k]! - my)
    syy += (ys[k]! - my) ** 2
  }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  let ssr = 0
  for (let k = 0; k < n; k++) ssr += (ys[k]! - (slope * xs[k]! + intercept)) ** 2
  const s2 = n > 2 ? ssr / (n - 2) : 0
  return {
    slope,
    intercept,
    sigma_slope: Math.sqrt(s2 / sxx),
    sigma_intercept: Math.sqrt(s2 * (1 / n + (mx * mx) / sxx)),
    r2: syy === 0 ? 1 : 1 - ssr / syy,
  }
}

/** h = e * slope of U0 vs nu (leaflet eq. V); slope in V/Hz, result in J s. */
export function planckFromFit(slope_VperHz: number): number {
  return E_C * slope_VperHz
}
