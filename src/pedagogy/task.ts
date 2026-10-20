// A guided task: predict -> act -> observe -> explain (write-guided-task skill). Its success condition asks the
// physics model or the apparatus, never a hand-tuned number. Pure and DOM-free so it can be tested in node.
import type { Apparatus, Controls, Mode } from '../apparatus/index.ts'
import type { HgLineId } from '../physics/index.ts'
import { IDEAL, LAB, steadyState_V } from '../physics/index.ts'

export type ControlId =
  | 'lamp' | 'arm' | 'windowCover' | 'beam' | 'key' | 'range' | 'speed'
  | 'cathode' | 'stray' | 'dirty' | 'roomLights' | 'record' | 'fit'

/** Contextual nudge keys; the text lives in the pedagogy dictionary under `hints.<key>`. */
export type HintKey =
  | 'lampOff' | 'moveArm' | 'meterOff' | 'meterRange' | 'pressKey' | 'releaseKey' | 'waitMore' | 'typeValue'
  | 'otherLine' | 'dimDown' | 'dimUp' | 'pickZinc' | 'toggleError' | 'moreLines' | 'openFit' | 'visibleLine'
  | 'warmUp' | 'speedUp'

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
  /** Controls the task needs; the others are dimmed, not disabled. */
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

/** Distinct visible lines among settled measurements that pass `keep`. */
export function settledLines(a: Apparatus, keep: (m: Apparatus['measurements'][number]) => boolean = () => true): Set<HgLineId> {
  const out = new Set<HgLineId>()
  for (const m of a.measurements) if (m.settled && m.lineId && m.lineId !== 'uv' && keep(m)) out.add(m.lineId)
  return out
}
