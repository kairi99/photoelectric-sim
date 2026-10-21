// Teacher key generator: pure function from the physics model to Markdown (no DOM, no file access).
// scripts/teacher-key.ts writes the result to docs/teacher-key.md.
import {
  LAMP_DRIFT_REL, METER_CLASS_PCT, METER_GAIN_TYPICAL, STRAY_PRESET_FRACTION, ZERO_OFFSET_MAX_FRAC, ZERO_OFFSET_MIN_FRAC, ZERO_TOL_FRAC,
} from '../apparatus/index.ts'
import {
  ANODE_ILLUM_FRACTION, E_C, H_Js, IDEAL, LAB, R_CELL_DIRTY_Ohm, R_INPUT_Ohm, expectedReading_V, getLine, linearFit, nuFromLambda,
  planckFromFit, steadyState_V,
} from '../physics/index.ts'
import type { CircuitInputs, HgLineId, Scenario } from '../physics/index.ts'
import { TASKS } from './tasks/index.ts'
import { FIRST_U0_TOL_V } from './tasks/first-u0.ts'
import { PLANCK_REL_TOL } from './tasks/planck.ts'
import { BRIGHT_MIN, DIM_MAX } from './tasks/intensity.ts'
import { THRESHOLD_MAX_U_V, THRESHOLD_WAIT_s } from './tasks/threshold.ts'
import { VISIBLE_LINES, energyVars, expectedFitH_Js, photonEnergyText } from './task.ts'
import { fmt } from './strings.ts'
import { en } from './i18n/en.ts'

type Extra = Partial<Omit<CircuitInputs, 'line'>>
/** Explore with an error switch on: the real electrometer input resistance replaces the ideal 1e21 Ohm. */
const WITH_INPUT: Extra = { R_input_Ohm: R_INPUT_Ohm }

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
  'find-line': 'Lamp on, the violet line was on the cell at some point during the task, and now the yellow line is aligned (`lineOnCell() === "yellow"`).',
  'first-u0': `A valid (settled and discharged) yellow measurement within ±${FIRST_U0_TOL_V} V of the noise-free plateau of the mode (see table).`,
  intensity: `Two valid (settled and discharged) measurements of the same line, one at beam intensity ≥ ${BRIGHT_MIN} and one at ≤ ${DIM_MAX}.`,
  planck: `Four distinct valid lines (settled and discharged) and a fit with h within ${PLANCK_REL_TOL * 100} % of the Lab model value ${h34(expectedFitH_Js('lab'))}×10⁻³⁴ J·s (not of the true ${h34(H_Js)}).`,
  threshold: `Cathode Zn, lamp warm, the violet line aligned, key released ≥ ${THRESHOLD_WAIT_s} s ago and U < ${THRESHOLD_MAX_U_V * 1000} mV.`,
  'error-sources': 'Dirty, stray light or anode emission on, four distinct valid (settled and discharged) lines measured with the error active, and a fit available.',
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
    'Real runs approach the plateau asymptotically; the "settled" badge appears when the projected remaining rise (|dU/dt| times the local time constant) stays below 1 mV (or 0.1 % of U) for 5 s.',
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
    push(`| ${name(l)} | ${(nu / 1e12).toFixed(0)} | ${photonEnergyText(l, 'en')} | ${v(ex[i]!)} | ${v(lb[i]!)} | ${v(expectedReading_V(LAB, l))} |`)
  })
  push('', 'The leaflet example (Table 1) reads 0.59, 0.70, 1.23, 1.40 V, close to the lab column.', '')

  push('## Fitted h from the four visible lines', '', '| Case | h (×10⁻³⁴ J·s) | vs true | slope (V/THz) | intercept (V) |', '|---|---|---|---|---|')
  const row = (label: string, U: number[]): string => {
    const f = fitH(U)
    return `| ${label} | ${h34(f.h)} | ${pct(f.h)} | ${(f.slope * 1e12).toFixed(5)} | ${f.intercept.toFixed(3)} |`
  }
  push(row('Explore, clean', ex), row('Lab, clean', lb))
  push(row('Explore, dirty photocell', plateaus(IDEAL, { ...WITH_INPUT, R_cell_Ohm: R_CELL_DIRTY_Ohm })))
  push(row(`Explore, stray light (${STRAY_PRESET_FRACTION})`, plateaus(IDEAL, { ...WITH_INPUT, stray_fraction: STRAY_PRESET_FRACTION })))
  push(row(`Explore, anode emission (${ANODE_ILLUM_FRACTION})`, plateaus(IDEAL, { ...WITH_INPUT, anode_fraction: ANODE_ILLUM_FRACTION })))
  const hl = fitH(lb)
  const margin = (sign: number): number => {
    // worst case: +-0.02 V (needle reading) pushed in opposite directions at the ends of the line
    const err = [-1, -0.33, 0.33, 1].map((k) => sign * 0.02 * k)
    return fitH(lb.map((u, i) => u + err[i]!)).h
  }
  const lo = Math.min(margin(1), margin(-1))
  const hi = Math.max(margin(1), margin(-1))
  push(
    '',
    '### Why the clean Lab run is about −10 %',
    '',
    `The Lab bench is not ideal: the cell leaks (${(LAB.params.R_cell_Ohm! / 1e12).toFixed(2)}×10¹² Ω), the K-contaminated ring anode emits a back-current from scattered light (${ANODE_ILLUM_FRACTION * 100} % of each line reaches it), the Fermi–Dirac edge at room temperature fades the cutoff, and a small stray-light fraction (${LAB.params.stray_fraction}) from bluer lines lifts the yellow and green plateaus. Together these flatten the U0 vs ν line, so the clean Lab fit gives ${h34(hl.h)}×10⁻³⁴ J·s (${pct(hl.h)}). The leaflet's own bench gives 6.1×10⁻³⁴ (about −8 %). This is a property of the bench model, not an error of the student.`,
    '',
    `The \`planck\` task therefore tests h against the Lab model value ${h34(hl.h)}, with a ±${PLANCK_REL_TOL * 100} % window: ${h34(hl.h * (1 - PLANCK_REL_TOL))} to ${h34(hl.h * (1 + PLANCK_REL_TOL))}×10⁻³⁴ J·s. A needle misreading of up to 0.02 V in the worst pattern moves h only to ${h34(lo)}–${h34(hi)} (${((lo / hl.h - 1) * 100).toFixed(1)} % to ${((hi / hl.h - 1) * 100).toFixed(1)} %), so honest reading keeps a margin of about ${(PLANCK_REL_TOL * 100 - Math.max(Math.abs(lo / hl.h - 1), Math.abs(hi / hl.h - 1)) * 100).toFixed(1)} percentage points inside the limit. A single bad point (e.g. a line recorded without discharging) pushes the fit out of the window and triggers the hint.`,
  )
  push('', `True h = ${h34(H_Js)}×10⁻³⁴ J·s (e = ${(E_C / 1e-19).toFixed(4)}×10⁻¹⁹ C). The leaflet obtains 6.1×10⁻³⁴.`)
  push('The intercept of e·U0 vs ν is not the cathode work function (anode work function enters, leaflet eq. VII).', '')

  push('## Error sources: plateaus (explore)', '', '| Line | Clean (V) | Dirty (V) | Stray light (V) | Anode emission (V) |', '|---|---|---|---|---|')
  const dirty = plateaus(IDEAL, { ...WITH_INPUT, R_cell_Ohm: R_CELL_DIRTY_Ohm })
  const stray = plateaus(IDEAL, { ...WITH_INPUT, stray_fraction: STRAY_PRESET_FRACTION })
  const anodeP = plateaus(IDEAL, { ...WITH_INPUT, anode_fraction: ANODE_ILLUM_FRACTION })
  VISIBLE_LINES.forEach((l, i) => push(`| ${name(l)} | ${v(ex[i]!)} | ${v(dirty[i]!)} | ${v(stray[i]!)} | ${v(anodeP[i]!)} |`))
  push(
    '',
    '- **Dirty photocell** (leakage 10¹² Ω): every plateau sags, the high ones more, so the slope and h fall (see the table).',
    '- **Stray light** (preset): photocurrent from the other, higher-U0 lines keeps the capacitor charged, so the low-frequency plateaus are lifted most and the slope falls. Because the explore source is bright, a stray fraction of only a few 10⁻⁴ is enough; with more, yellow and green merge into one value.',
    '- **Anode emission** (the ring anode, work function far below the cathode, is hit by scattered light): its electrons are accelerated back to the cathode, so a reverse current flows that does not vanish at U0. Every plateau stops where the charging current falls to this back-current, below U0, and more for the high-frequency lines, so the slope and h fall.',
    '- In Explore, any error switch also puts in the electrometer input resistance (10¹³ Ω) instead of the ideal 10²¹ Ω. Without it any stray current would charge every line to the UV U0 and h would be ~0.',
    '- All three effects give a **lower** h, so the answer to the `error-sources` prediction is "Lower".',
    '',
    '## Lab instrument effects (not part of the plateaus above)',
    '',
    `- **Needle zero:** the analog needle starts with a seeded mechanical offset of ${(ZERO_OFFSET_MIN_FRAC * 3).toFixed(2)} to ${(ZERO_OFFSET_MAX_FRAC * 3).toFixed(2)} V (either sign) on the 3 V range. The student must zero it with the key held (the zero-adjust control). A reading recorded with the zero off by more than ${(ZERO_TOL_FRAC * 3 * 1000).toFixed(0)} mV triggers a coach nudge; the first-U0 tolerance (±${FIRST_U0_TOL_V} V) is of the same size as the offset, so a student who skips the zero adjust can miss it.`,
    `- **Meter accuracy:** class ${METER_CLASS_PCT} (percent of full scale) is the bound; this instrument's seeded gain error is drawn within ±${((METER_GAIN_TYPICAL * METER_CLASS_PCT)).toFixed(1)} % of the reading.`,
    `- **Lamp drift:** the line intensities wander slowly by up to ±${LAMP_DRIFT_REL * 100} % (tens of seconds); the plateau moves by well under 1 mV, far below the needle resolution.`,
    '- **Capacitor dielectric absorption:** about 0.03 % of the charging voltage creeps back after a short discharge, a fraction of a millivolt, invisible on the needle.',
    '',
    '## Photon energies and the zinc threshold',
    '',
    `Zn work function in the model: 4.3 eV. Violet photon: ${photonEnergyText('violet', 'en')} eV, so no emission, whatever the intensity.`,
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
      `- Teacher note: ${fmt(x.teacher, energyVars('en'))}`,
      '',
    )
  }
  return out.join('\n')
}
