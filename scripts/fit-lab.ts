// Re-fits the 4 Lab calibration parameters (W_A, I_REF_A, LAB.stray_fraction, LAB.R_cell_Ohm) to leaflet Table 1.
// Run with: node scripts/fit-lab.ts   (Node 24+ strips types natively). Prints the fit and the resulting tables;
// copy the numbers into src/physics/{constants,photocell,scenarios}.ts and PARAMETERS.md by hand (nothing is written).
//
// 4 free parameters for 4 data points: agreement with Table 1 is a consistency check, not a validation.
// Cost = sum of squared steady-state residuals (scale 10 mV) + timing penalty (U(50 s) within 1.5 mV of the plateau,
// so the leaflet's 30 s to 1 min wait works) + penalty for h outside 5.7 to 6.4e-34 + tiny regularisation of stray >= 0.
import {
  H_Js, LAB, chargeCurve, getLine, linearFit, nuFromLambda, planckFromFit, steadyState_V,
} from '../src/physics/index.ts'
import type { CircuitInputs, HgLineId } from '../src/physics/index.ts'

const LINES: HgLineId[] = ['yellow', 'green', 'blue', 'violet']
const TABLE1 = [0.59, 0.70, 1.23, 1.40]
const NU = LINES.map((l) => nuFromLambda(getLine(l).lambda_nm))

export interface Params { W_A_eV: number; I_ref_A: number; stray_fraction: number; R_cell_Ohm: number }

function inputs(p: Params, line: HgLineId): CircuitInputs {
  return { ...LAB.params, W_A_eV: p.W_A_eV, I_ref_A: p.I_ref_A, stray_fraction: p.stray_fraction, R_cell_Ohm: p.R_cell_Ohm, line }
}
export function evaluate(p: Params) {
  const ss = LINES.map((l) => steadyState_V(inputs(p, l)))
  const u50 = LINES.map((l) => {
    const c = chargeCurve(inputs(p, l), 50, 50)
    return c.U_V[c.U_V.length - 1]!
  })
  const h = planckFromFit(linearFit(NU, ss).slope)
  return { ss, u50, h }
}
function cost(x: number[]): number {
  const p: Params = { W_A_eV: x[0]!, I_ref_A: Math.exp(x[1]!), stray_fraction: Math.max(0, x[2]!), R_cell_Ohm: Math.exp(x[3]!) }
  if (x[2]! < 0 || p.W_A_eV < 1.0 || p.W_A_eV > 1.9) return 1e9
  const { ss, u50, h } = evaluate(p)
  let c = 0
  ss.forEach((u, i) => { c += ((u - TABLE1[i]!) / 0.01) ** 2 })
  u50.forEach((u, i) => { c += (Math.max(0, Math.abs(u - ss[i]!) - 0.0015) / 0.001) ** 2 })
  // Taming the (I, R) ridge: only the product R*I is fixed by Table 1; take the smallest I that still meets the timing
  // constraint, i.e. the cleanest cell (largest R_cell) the data allow.
  c += 0.02 * x[1]!
  if (h < 5.7e-34) c += ((5.7e-34 - h) / 1e-35) ** 2
  if (h > 6.4e-34) c += ((h - 6.4e-34) / 1e-35) ** 2
  return c
}

function nelderMead(f: (x: number[]) => number, x0: number[], steps: number[], iters = 600): number[] {
  const n = x0.length
  let pts = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? v + steps[i]! : v)))]
  let fs = pts.map(f)
  for (let it = 0; it < iters; it++) {
    const order = fs.map((_, i) => i).sort((a, b) => fs[a]! - fs[b]!)
    pts = order.map((i) => pts[i]!); fs = order.map((i) => fs[i]!)
    const cen = x0.map((_, j) => pts.slice(0, n).reduce((s, p) => s + p[j]!, 0) / n)
    const at = (k: number) => cen.map((c, j) => c + k * (pts[n]![j]! - c))
    const xr = at(-1), fr = f(xr)
    if (fr < fs[0]!) { const xe = at(-2), fe = f(xe); if (fe < fr) { pts[n] = xe; fs[n] = fe } else { pts[n] = xr; fs[n] = fr } }
    else if (fr < fs[n - 1]!) { pts[n] = xr; fs[n] = fr }
    else {
      const xc = at(fr < fs[n]! ? -0.5 : 0.5), fc = f(xc)
      if (fc < Math.min(fr, fs[n]!)) { pts[n] = xc; fs[n] = fc }
      else for (let i = 1; i <= n; i++) { pts[i] = pts[i]!.map((v, j) => pts[0]![j]! + 0.5 * (v - pts[0]![j]!)); fs[i] = f(pts[i]!) }
    }
  }
  const best = fs.indexOf(Math.min(...fs))
  return pts[best]!
}

const start = [Number(process.argv[2] ?? 1.529), Math.log(Number(process.argv[3] ?? 6.5e-11)), Number(process.argv[4] ?? 0.002), Math.log(Number(process.argv[5] ?? 2.2e12))]
let x = start
for (let r = 0; r < 3; r++) {
  x = nelderMead(cost, x, [0.02, 0.15, 0.0005, 0.15])
  console.error('round', r, cost(x).toFixed(3), x.map((v) => v.toPrecision(5)).join(' '))
}
const best: Params = { W_A_eV: x[0]!, I_ref_A: Math.exp(x[1]!), stray_fraction: Math.max(0, x[2]!), R_cell_Ohm: Math.exp(x[3]!) }
const e = evaluate(best)
console.log('cost', cost(x).toFixed(3))
console.log('W_A_eV', best.W_A_eV.toFixed(4), 'I_REF_A', best.I_ref_A.toExponential(3), 'stray', best.stray_fraction.toFixed(5), 'R_cell', best.R_cell_Ohm.toExponential(3))
console.log('steady', e.ss.map((u) => u.toFixed(3)).join(' '), 'U(50s)', e.u50.map((u) => u.toFixed(3)).join(' '))
console.log('residual vs Table 1', e.ss.map((u, i) => (u - TABLE1[i]!).toFixed(3)).join(' '))
console.log('h = %s e-34 (%s %% vs true)', (e.h / 1e-34).toFixed(3), (((e.h - H_Js) / H_Js) * 100).toFixed(1))
