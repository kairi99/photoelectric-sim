import type { GuidedTask } from '../task.ts'

export const THRESHOLD_WAIT_s = 30
export const THRESHOLD_MAX_U_V = 0.01

export const task: GuidedTask = {
  id: 'threshold',
  mode: 'explore',
  level: 3,
  controls: ['lamp', 'arm', 'cathode', 'key', 'speed'],
  initial: {},
  predict: { kind: 'choice', answer: 2 }, // yes, like potassium / yes, slowly / no
  success: (a) => {
    const r = a.readout()
    const line = r.lineOnCell
    return (
      a.cathode === 'Zn' && a.lampOn && r.lampBrightness >= 0.99 && line !== null && line !== 'uv' &&
      a.hasReleased && !a.keyPressed && r.elapsedSinceRelease_s >= THRESHOLD_WAIT_s &&
      r.U_V !== null && r.U_V < THRESHOLD_MAX_U_V
    )
  },
  hints: [
    { when: (a) => a.cathode !== 'Zn', key: 'pickZinc' },
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.lampOn && a.readout().lampBrightness < 0.99, key: 'warmUp' },
    { when: (a) => a.lampOn && (a.lineOnCell() === null || a.lineOnCell() === 'uv'), key: 'visibleLine' },
    { when: (a) => a.lampOn && !a.hasReleased, key: 'pressKey' },
    { when: (a) => a.keyPressed, key: 'releaseKey' },
    { when: (a) => a.hasReleased && !a.keyPressed, key: 'speedUp' },
  ],
}
