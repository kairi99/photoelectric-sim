// Teacher key generator: pure function from the physics model to Markdown (no DOM, no file access).
// scripts/teacher-key.ts writes the result to docs/teacher-key.md.
import { STRAY_PRESET_FRACTION } from '../apparatus/index.ts'
import {
  E_C, H_Js, IDEAL, LAB, R_CELL_DIRTY_Ohm, expectedReading_V, getLine, linearFit, nuFromLambda, photonEnergy_eV,
  planckFromFit, steadyState_V,
} from '../physics/index.ts'
import type { CircuitInputs, HgLineId, Scenario } from '../physics/index.ts'
import { TASKS } from './tasks/index.ts'
import { FIRST_U0_TOL_V } from './tasks/first-u0.ts'
import { PLANCK_REL_TOL } from './tasks/planck.ts'
import { BRIGHT_MIN, DIM_MAX } from './tasks/intensity.ts'
import { THRESHOLD_MAX_U_V, THRESHOLD_WAIT_s } from './tasks/threshold.ts'
import { VISIBLE_LINES } from './task.ts'
import { en } from './i18n/en.ts'

type Extra = Partial<Omit<CircuitInputs, 'line'>>

function plateaus(s: Scenario, extra: Extra = {}): number[] {
  return VISIBLE_LINES.map((line) => steadyState_V({ ...s.params, ...extra, line }))
}
function fitH(U_V: number[]): { h: number; slope: number; intercept: number } {
  const f = linearFit(VISIBLE_LINES.map((l) => nuFromLambda(getLine(l).lambda_nm)), U_V)
  return { h: planckFromFit(f.slope), slope: f.slope, intercept: f.intercept }
}
const v = (x: number): string => x.toFixed(3)
const h34 = (h: number): string => (h / 1e-34).toFixed(2)
const pct = (h: number): string => `${(((h - H_Js) / H_Js) * 100).toFixed(1)} %`
const name = (l: HgLineId): string => `${l} ${getLine(l).lambda_nm.toFixed(0)} nm`

const SUCCESS: Record<string, string> = {
  'find-line': 'Lamp on and the yellow line aligned on the cell (`lineOnCell() === "yellow"`).',
  'first-u0': `A settled yellow measurement within ±${FIRST_U0_TOL_V} V of the noise-free plateau of the mode (see table).`,
  intensity: `Two settled measurements of the same line, one at dimming ≥ ${BRIGHT_MIN} and one at ≤ ${DIM_MAX}.`,
  planck: `Four distinct settled lines and a fit with h within ${PLANCK_REL_TOL * 100} % of ${h34(H_Js)}×10⁻³⁴ J·s.`,
  threshold: `Cathode Zn, lamp warm, a visible line aligned, key released ≥ ${THRESHOLD_WAIT_s} s ago and U < ${THRESHOLD_MAX_U_V * 1000} mV.`,
  'error-sources': 'Dirty or stray light on, four distinct settled lines measured with the error active, and a fit available.',
}

export function teacherKey(): string {
  const out: string[] = []
  const push = (...l: string[]): void => { out.push(...l) }
  push(
    '# Teacher key',
    '',
    '_Generated from the physics model by `npm run teacher-key`. Do not edit by hand; edit the model or the tasks._',
    '',
    'Values are noise-free equilibrium plateaus (what a student should read, to within needle reading of about 0.02 V).',
    'Real runs approach the plateau asymptotically; the "settled" badge appears when the rate is below 1 mV/s.',
    '',
    '## Expected plateaus U0',
    '',
    '| Line | ν (THz) | hν (eV) | Explore U0 (V) | Lab U0 (V, equilibrium) | Lab U0 (V, after 60 s) |',
    '|---|---|---|---|---|---|',
  )
  const ex = plateaus(IDEAL)
  const lb = plateaus(LAB)
  VISIBLE_LINES.forEach((l, i) => {
    const nu = nuFromLambda(getLine(l).lambda_nm)
    push(`| ${name(l)} | ${(nu / 1e12).toFixed(0)} | ${photonEnergy_eV(nu).toFixed(2)} | ${v(ex[i]!)} | ${v(lb[i]!)} | ${v(expectedReading_V(LAB, l))} |`)
  })
  push('', 'The leaflet example (Table 1) reads 0.59, 0.70, 1.23, 1.40 V, close to the lab column.', '')

  push('## Fitted h from the four visible lines', '', '| Case | h (×10⁻³⁴ J·s) | vs true | slope (V/THz) | intercept (V) |', '|---|---|---|---|---|')
  const row = (label: string, U: number[]): string => {
    const f = fitH(U)
    return `| ${label} | ${h34(f.h)} | ${pct(f.h)} | ${(f.slope * 1e12).toFixed(5)} | ${f.intercept.toFixed(3)} |`
  }
  push(row('Explore, clean', ex), row('Lab, clean', lb))
  push(row('Explore, dirty photocell', plateaus(IDEAL, { R_cell_Ohm: R_CELL_DIRTY_Ohm })))
  push(row(`Explore, stray light (${STRAY_PRESET_FRACTION})`, plateaus(IDEAL, { stray_fraction: STRAY_PRESET_FRACTION })))
  push('', `True h = ${h34(H_Js)}×10⁻³⁴ J·s (e = ${(E_C / 1e-19).toFixed(4)}×10⁻¹⁹ C). The leaflet obtains 6.1×10⁻³⁴.`)
  push('The intercept of e·U0 vs ν is not the cathode work function (anode work function enters, leaflet eq. VII).', '')

  push('## Error sources: plateaus (explore)', '', '| Line | Clean (V) | Dirty (V) | Stray light (V) |', '|---|---|---|---|')
  const dirty = plateaus(IDEAL, { R_cell_Ohm: R_CELL_DIRTY_Ohm })
  const stray = plateaus(IDEAL, { stray_fraction: STRAY_PRESET_FRACTION })
  VISIBLE_LINES.forEach((l, i) => push(`| ${name(l)} | ${v(ex[i]!)} | ${v(dirty[i]!)} | ${v(stray[i]!)} |`))
  push(
    '',
    '- **Dirty photocell** (leakage 10¹² Ω): every plateau sags, the high ones more, so the slope and h fall slightly.',
    '- **Stray light** (preset): the highest-U0 component (the UV line) charges the capacitor too and drags every reading towards one value, the low-frequency lines most. The slope collapses, so h is far too low. Real stray light is weaker but pushes the same way.',
    '- Both effects give a **lower** h, so the answer to the `error-sources` prediction is "Lower".',
    '',
    '## Photon energies and the zinc threshold',
    '',
    `Zn work function in the model: 4.3 eV. Violet photon: ${photonEnergy_eV(nuFromLambda(getLine('violet').lambda_nm)).toFixed(2)} eV, so no emission, whatever the intensity.`,
    '',
    '## Tasks',
    '',
  )
  for (const t of TASKS) {
    const x = en.task[t.id as keyof typeof en.task]
    const ans = t.predict.kind === 'choice' ? `**${x.options[t.predict.answer]}**` : 'free number (h in 10⁻³⁴ J·s, recalled at the end, no check)'
    push(
      `### \`${t.id}\` — ${x.title}`,
      '',
      `Level ${t.level} · ${t.mode} mode · concept: ${x.concept}`,
      '',
      `- Prediction answer: ${ans}`,
      `- Success: ${SUCCESS[t.id] ?? ''}`,
      `- Teacher note: ${x.teacher}`,
      '',
    )
  }
  return out.join('\n')
}
