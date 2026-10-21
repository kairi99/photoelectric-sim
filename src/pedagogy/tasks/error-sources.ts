import type { GuidedTask } from '../task.ts'
import { settledLines } from '../task.ts'

export const task: GuidedTask = {
  id: 'error-sources',
  mode: 'explore',
  level: 3,
  controls: ['lamp', 'arm', 'dirty', 'stray', 'anode', 'key', 'speed', 'record', 'fit'],
  initial: {},
  // options: higher, same, lower
  predict: { kind: 'choice', answer: 2 },
  success: (a) => {
    const flagged = (m: { dirty: boolean; stray: boolean; anode: boolean }): boolean => m.dirty || m.stray || m.anode
    return (a.dirty || a.anode || (a.stray_fraction ?? 0) > 0) && settledLines(a, flagged).size >= 4 && a.fitResult() !== null
  },
  hints: [
    { when: (a) => !a.dirty && !a.anode && (a.stray_fraction ?? 0) <= 0, key: 'toggleError' },
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.lampOn && a.lineOnCell() === null, key: 'moveArm' },
    { when: (a) => a.measurements.length > 0 && settledLines(a, (m) => m.dirty || m.stray || m.anode).size < 4, key: 'moreLines' },
    { when: (a) => settledLines(a, (m) => m.dirty || m.stray || m.anode).size >= 4, key: 'openFit' },
  ],
}
