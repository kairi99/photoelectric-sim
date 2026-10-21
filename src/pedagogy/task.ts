// A guided task: predict -> act -> observe -> explain (write-guided-task skill). Its success condition asks the
// physics model or the apparatus, never a hand-tuned number. Pure and DOM-free so it can be tested in node.
import type { Apparatus, Controls, Mode } from '../apparatus/index.ts'
import type { HgLineId } from '../physics/index.ts'
import type { Lang } from '../i18n.ts'
import { IDEAL, LAB, getLine, linearFit, nuFromLambda, photonEnergy_eV, planckFromFit, steadyState_V } from '../physics/index.ts'

export type ControlId =
  | 'lamp' | 'arm' | 'windowCover' | 'beam' | 'key' | 'range' | 'speed'
  | 'cathode' | 'stray' | 'dirty' | 'roomLights' | 'record' | 'fit'

/** Contextual nudge keys; the text lives in the pedagogy dictionary under `hints.<key>`. */
export type HintKey =
  | 'lampOff' | 'moveArm' | 'meterOff' | 'meterRange' | 'pressKey' | 'releaseKey' | 'waitMore' | 'typeValue'
  | 'otherLine' | 'dimDown' | 'dimUp' | 'pickZinc' | 'toggleError' | 'moreLines' | 'openFit'
  | 'warmUp' | 'speedUp' | 'fitOff' | 'findViolet' | 'putViolet'

export interface TaskHint {
  when: (a: Apparatus) => boolean
  key: HintKey
}

export type Prediction =
  | { kind: 'choice'; answer: number }
  | { kind: 'number'; unit: string; tolerance?: number }

export interface GuidedTask {
  /** Also the key of its strings in the pedagogy dictionary. */
  id: string
  mode: Mode
  /** 1 intro, 2 core, 3 challenge. */
  level: 1 | 2 | 3
  /** Controls the task needs; the 3D bench highlights them. Nothing is dimmed or disabled. */
  controls: ControlId[]
  /** Applied after reset() through load(). */
  initial: Partial<Controls>
  predict: Prediction
  success: (a: Apparatus) => boolean
  hints: TaskHint[]
}

/** Start from the device defaults of the task's mode, then the task's settings. */
export function applyInitial(a: Apparatus, task: Pick<GuidedTask, 'mode' | 'initial'>): void {
  if (a.mode !== task.mode) a.setMode(task.mode)
  else a.reset()
  a.load(task.initial)
}

export const VISIBLE_LINES: readonly HgLineId[] = ['yellow', 'green', 'blue', 'violet']

/** Noise-free plateau (V) a line settles to in the apparatus' current mode (physics model, no magic numbers). */
export function expectedPlateau_V(mode: Mode, line: HgLineId): number {
  const s = mode === 'lab' ? LAB : IDEAL
  return steadyState_V({ ...s.params, line })
}

/** Noise-free fitted h (J s) the four visible plateaus of the mode give: what a careful student should get. */
export function expectedFitH_Js(mode: Mode): number {
  const f = linearFit(
    VISIBLE_LINES.map((l) => nuFromLambda(getLine(l).lambda_nm)),
    VISIBLE_LINES.map((l) => expectedPlateau_V(mode, l)),
  )
  return planckFromFit(f.slope)
}

type Meas = Apparatus['measurements'][number]
/** A measurement that can count: the plateau was reached and the capacitor was discharged after the line was set. */
export const isValid = (m: Meas): boolean => m.settled && m.dischargedSinceAlign

/** Distinct visible lines among valid (settled and discharged) measurements that pass `keep`. */
export function settledLines(a: Apparatus, keep: (m: Meas) => boolean = () => true): Set<HgLineId> {
  const out = new Set<HgLineId>()
  for (const m of a.measurements) if (isValid(m) && m.lineId && m.lineId !== 'uv' && keep(m)) out.add(m.lineId)
  return out
}

/** The one formatter for photon energies hν (eV, 2 decimals, from the model) used in cards and the teacher key. */
export function photonEnergyText(line: HgLineId, lang: Lang): string {
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(photonEnergy_eV(nuFromLambda(getLine(line).lambda_nm)))
}
/** Values for the {Ey} {Ev} {Euv} placeholders of the task strings. */
export function energyVars(lang: Lang): Record<string, string> {
  return { Ey: photonEnergyText('yellow', lang), Ev: photonEnergyText('violet', lang), Euv: photonEnergyText('uv', lang) }
}

/** Lines that were on the cell with the lamp on, in order, since the log started (applyInitial resets it). */
export function alignedLampOn(a: Apparatus): HgLineId[] {
  let lamp = false
  const out: HgLineId[] = []
  for (const e of a.procedureLog) {
    if (e.action === 'lampOn') lamp = true
    else if (e.action === 'lampOff') lamp = false
    else if (e.action === 'lineAligned' && lamp) out.push(e.detail as HgLineId)
  }
  return out
}
